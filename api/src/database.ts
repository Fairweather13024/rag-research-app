import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import {
  Database,
} from "./generated/db.js";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "notes/prompts.js";

export const ARXIV_PAPERS_TABLE = "arxiv_papers";
export const ARXIV_EMBEDDINGS_TABLE = "arxiv_embeddings";
export const ARXIV_QA_TABLE = "arxiv_question_answering";

export class Supabasedatabase {
  vectorStore: SupabaseVectorStore;
  client: SupabaseClient<Database, "public", any>;
  constructor(
    vectorStore: SupabaseVectorStore,
    client: SupabaseClient<Database, "public", any>
  ) {
    this.vectorStore = vectorStore;
    this.client = client;
  }
  static async fromExistingIndex(): Promise<Supabasedatabase> {
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;
    if (!privateKey) throw new Error(`Missing SUPABASE_PRIVATE_KEY`);

    const url = process.env.SUPABASE_PROJECT_URL;
    if (!url) throw new Error(`Missing SUPABASE_URL`);

    const client = createClient<Database>(url, privateKey);

    const vectorStore = await SupabaseVectorStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      {
        client,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );

    return new this(vectorStore, client);
  }
  static async fromDocuments(
    documents: Array<Document>
  ): Promise<Supabasedatabase> {
    const privateKey = process.env.SUPABASE_PRIVATE_KEY;
    const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
    if (!privateKey || !supabaseUrl) {
      throw new Error("Please provide Supabase private key and url");
    }
    const supabase = createClient(supabaseUrl, privateKey);
    const vectorStore = await SupabaseVectorStore.fromDocuments(
      documents,
      new OpenAIEmbeddings(),
      {
        client: supabase,
        tableName: ARXIV_EMBEDDINGS_TABLE,
        queryName: "match_documents",
      }
    );
    return new this(vectorStore, supabase);
  }
  async addPaper({
    paperUrl,
    name,
    paper,
    notes,
  }: {
    paperUrl: string;
    name: string;
    paper: string;
    notes: ArxivPaperNote[];
  }) {
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .insert({
        arxiv_url: paperUrl,
        name,
        paper,
        notes,
      })
      .select();
    if (error) {
      throw error;
    }
    console.log(data);
    return data;
  }

  async getPaper(
    url: string
  ): Promise<Database["public"]["Tables"]["arxiv_papers"]["Row"] | null> {
    const { data, error } = await this.client
      .from(ARXIV_PAPERS_TABLE)
      .select()
      .eq("arxiv_url", url);

    if (error || !data) {
      console.error("Error getting paper from database");
      return null;
    }
    return data[0];
  }

  async saveQa(
    question: string,
    answer: string,
    context: string,
    followupQuestions: string[]
  ) {
    const { error } = await this.client.from(ARXIV_QA_TABLE).insert({
      question,
      answer,
      context,
      followup_questions: followupQuestions,
    });
    if (error) {
      console.error("Error saving QA to database");
      throw error;
    }
  }
}
