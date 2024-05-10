import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { Document } from "langchain/document";
import { writeFile, unlink } from "fs/promises"; //using fs because we need a filepath to write to to process docs
import { UnstructuredLoader } from "langchain/document_loaders/fs/unstructured"; //recognized teh semantic usefl parts of a pdf eg title and then chunks it accordingly
import { formatDocumentsAsString } from "langchain/util/document";
import dotenv from "dotenv";
import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  NOTES_TOOL_SCHEMA,
  NOTE_PROMPT,
  outPutParser,
  ArxivPaperNote,
} from "prompts.js";
import { Supabasedatabase } from "database.js";

dotenv.config();


async function deletePages(
  pdf: Buffer,
  pagesToDelete: number[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdf);

  let numToOffsetBy = 1;
  for (const pageNum of pagesToDelete) {
    pdfDoc.removePage(pageNum - numToOffsetBy);
    numToOffsetBy++;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function loadPdfFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return response.data;
}

async function convertPdfToLangChainDocuments(
  pdf: Buffer
): Promise<Array<Document>> {
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error("UNSTRUCTURED_API_KEY not set");
  }

  const randomName = Math.random().toString(36).substring(7);
  await writeFile(`pdfs/${randomName}.pdf`, pdf, "binary");
  const loader = new UnstructuredLoader(`pdfs/${randomName}.pdf`, {
    apiKey: process.env.UNSTRUCTURED_API_KEY,
    strategy: "hi_res",
  });

  const documents = await loader.load();
  //await unlink(`pdfs/${randomName}.pdf`); // basically deleting the file after processing
  return documents;
}

async function generateNotes(documents: Array<Document>): Promise<Array<ArxivPaperNote>> {
  const documentsAsString = formatDocumentsAsString(documents); //maps each doc and joins at new line and returns a string because LLMS only take strings and not doc objects
  const model = new ChatOpenAI({
    modelName: "gpt-4-1106-preview",//"gpt-3.5-turbo", //gpt-4-1106-preview
    temperature: 0.0, //0.0 is deterministic (only looks at pdfs, no creativity)
    openAIApiKey: process.env.OPENAI_API_KEY,
  }); 
  const modelWithTool = model.bind({
    tools: [NOTES_TOOL_SCHEMA] //bind langchain tools with model specs
  })

  const chain = NOTE_PROMPT.pipe(modelWithTool).pipe(outPutParser); //pipe the prompt to the model
    const response = await chain.invoke({
        paper : documentsAsString
    });
    return response;
}

async function main({
  paperUrl,
  name,
  pagesToDelete,
}: {
  paperUrl: string;
  name: string;
  pagesToDelete?: number[];
}) {
  if (!paperUrl.endsWith(".pdf")) {
    throw new Error("Not a pdf file");
  }
  let pdfAsBuffer = await loadPdfFromUrl(paperUrl);

  if (pagesToDelete && pagesToDelete.length > 0) {
    // delete pages
    pdfAsBuffer = await deletePages(pdfAsBuffer, pagesToDelete);
  }

  const documents = await convertPdfToLangChainDocuments(pdfAsBuffer);
  console.log(documents);
  const notes = await generateNotes(documents);
  console.log(notes);
  console.log(notes.length);
  const database = await Supabasedatabase.fromDocuments(documents);
  await database.addPaper({
    paperUrl,
    name,
    paper: formatDocumentsAsString(documents),
    notes,
  });
}


main({
  paperUrl: "https://arxiv.org/pdf/2311.05556.pdf",
  name: "test",
  pagesToDelete: [],
});