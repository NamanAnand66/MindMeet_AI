import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import OpenAI from "openai";
import { env } from "../config/env.js";
import { getSupabase } from "../config/supabase.js";
import { AppError } from "../utils/AppError.js";
import { answerQuestion } from "./llmRouter.js";

let openaiClient;

const getNvidiaNimApiKey = () => env.NVIDIA_NIM_API_KEY || env.NVIDIA_API_KEY;

const getEmbeddingProvider = () => {
  if (env.EMBEDDING_PROVIDER !== "auto") return env.EMBEDDING_PROVIDER;
  if (env.OPENAI_API_KEY) return "openai";
  if (getNvidiaNimApiKey()) return "nvidia_nim";
  throw new AppError("Embeddings require an OpenAI or NVIDIA NIM API key.", 500);
};

const normalizeEmbeddingDimensions = (embedding) => {
  if (embedding.length === env.EMBEDDING_DIMENSIONS) return embedding;

  if (embedding.length < env.EMBEDDING_DIMENSIONS) {
    return [...embedding, ...Array(env.EMBEDDING_DIMENSIONS - embedding.length).fill(0)];
  }

  throw new AppError(
    `Embedding dimension mismatch: provider returned ${embedding.length}, but the database expects ${env.EMBEDDING_DIMENSIONS}.`,
    500
  );
};

const embedText = async (text) => {
  const provider = getEmbeddingProvider();

  if (provider === "openai") {
    if (!env.OPENAI_API_KEY) {
      throw new AppError("EMBEDDING_PROVIDER is openai, but OPENAI_API_KEY is missing.", 500);
    }

    openaiClient ||= new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await openaiClient.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: env.EMBEDDING_DIMENSIONS
    });
    return normalizeEmbeddingDimensions(response.data[0].embedding);
  }

  const apiKey = getNvidiaNimApiKey();
  if (!apiKey) {
    throw new AppError("EMBEDDING_PROVIDER is nvidia_nim, but NVIDIA_NIM_API_KEY is missing.", 500);
  }

  const response = await fetch(`${env.NVIDIA_NIM_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: [text],
      model: env.NVIDIA_NIM_EMBEDDING_MODEL,
      input_type: "passage"
    })
  });

  if (!response.ok) {
    throw new AppError("NVIDIA NIM embedding request failed.", 502, await response.text());
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new AppError("NVIDIA NIM returned no embedding.", 502);
  }

  return normalizeEmbeddingDimensions(embedding);
};

export const indexMeetingTranscript = async ({ meetingId, transcriptText }) => {
  const supabase = getSupabase();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1100,
    chunkOverlap: 180
  });

  const chunks = await splitter.createDocuments([transcriptText]);
  const rows = [];

  for (const [index, chunk] of chunks.entries()) {
    const content = chunk.pageContent;
    rows.push({
      meeting_id: meetingId,
      chunk_index: index,
      content,
      embedding: await embedText(content)
    });
  }

  if (rows.length === 0) return [];

  const { data, error } = await supabase.from("transcript_chunks").insert(rows).select();
  if (error) {
    throw new AppError("Failed to index transcript chunks.", 502, error.message);
  }

  return data;
};

export const searchArchive = async ({ question, meetingId = null, matchCount = 6 }) => {
  const supabase = getSupabase();
  const embedding = await embedText(question);
  const { data, error } = await supabase.rpc("match_transcript_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_meeting_id: meetingId
  });

  if (error) {
    throw new AppError("Vector search failed.", 502, error.message);
  }

  const context = (data ?? [])
    .map((row) => `Meeting ${row.meeting_id}, chunk ${row.chunk_index}:\n${row.content}`)
    .join("\n\n---\n\n");

  const response = await answerQuestion({ question, context });

  return {
    ...response,
    sources: data ?? []
  };
};
