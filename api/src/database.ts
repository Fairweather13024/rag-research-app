import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import {
  Database,
  ARXIV_EMBEDDINGS_TABLE,
  ARXIV_PAPERS_TABLE,
} from "./generated/db.js";
import { Document } from "langchain/document";
import { ArxivPaperNote } from "prompts.js";

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
}
