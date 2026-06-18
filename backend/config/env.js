import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendEnvPath = resolve(currentDir, "../.env");

dotenv.config({ path: backendEnvPath });

const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  LLM_PROVIDER: z.enum(["auto", "openai", "claude", "nvidia_nim", "groq"]).default("auto"),
  EMBEDDING_PROVIDER: z.enum(["auto", "openai", "nvidia_nim"]).default("auto"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default("meeting-recordings"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().max(250).default(50),
  DEEPGRAM_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  CLAUDE_API_KEY: optionalString,
  CLAUDE_MODEL: z.string().default("claude-3-5-sonnet-latest"),
  NVIDIA_NIM_API_KEY: optionalString,
  NVIDIA_NIM_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_NIM_CHAT_MODEL: z.string().default("meta/llama-3.1-70b-instruct"),
  NVIDIA_NIM_EMBEDDING_MODEL: z.string().default("nvidia/nv-embedqa-e5-v5"),
  NVIDIA_API_KEY: optionalString,
  NVIDIA_CHAT_MODEL: z.string().default("meta/llama-3.1-70b-instruct"),
  NVIDIA_EMBEDDING_MODEL: z.string().default("nvidia/nv-embedqa-e5-v5"),
  GROQ_API_KEY: optionalString,
  GROQ_MODEL: z.string().default("llama-3.1-70b-versatile")
});

export const env = envSchema.parse(process.env);

export const requireEnv = (key) => {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};
