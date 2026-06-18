import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { actionItemsSystemPrompt, qaSystemPrompt, summarySystemPrompt } from "../prompts/meetingPrompts.js";

let openaiClient;
let anthropicClient;
let nvidiaNimClient;
let groqClient;

const getNvidiaNimApiKey = () => env.NVIDIA_NIM_API_KEY || env.NVIDIA_API_KEY;

const getProvider = () => {
  if (env.LLM_PROVIDER !== "auto") {
    const configuredKeys = {
      openai: env.OPENAI_API_KEY,
      claude: env.CLAUDE_API_KEY,
      nvidia_nim: getNvidiaNimApiKey(),
      groq: env.GROQ_API_KEY
    };

    if (!configuredKeys[env.LLM_PROVIDER]) {
      throw new AppError(`LLM_PROVIDER is ${env.LLM_PROVIDER}, but its API key is missing.`, 500);
    }

    return env.LLM_PROVIDER;
  }

  if (env.OPENAI_API_KEY) return "openai";
  if (env.CLAUDE_API_KEY) return "claude";
  if (getNvidiaNimApiKey()) return "nvidia_nim";
  if (env.GROQ_API_KEY) return "groq";
  throw new AppError("No LLM provider configured. Add OpenAI, Claude, Nvidia NIM, or Groq credentials.", 500);
};

const parseJson = (content, fallback) => {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/```json\s*([\s\S]*?)```|(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      return JSON.parse(match[1] || match[2]);
    }
    return fallback;
  }
};

const callOpenAI = async ({ system, user, responseFormat = "text" }) => {
  openaiClient ||= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openaiClient.chat.completions.create({
    model: env.OPENAI_MODEL,
    temperature: 0.2,
    response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  return response.choices?.[0]?.message?.content ?? "";
};

const callClaude = async ({ system, user }) => {
  anthropicClient ||= new Anthropic({ apiKey: env.CLAUDE_API_KEY });
  const response = await anthropicClient.messages.create({
    model: env.CLAUDE_MODEL,
    max_tokens: 1800,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: user }]
  });

  return response.content?.map((part) => part.text ?? "").join("") ?? "";
};

const callNvidiaNim = async ({ system, user, responseFormat = "text" }) => {
  nvidiaNimClient ||= new OpenAI({
    apiKey: getNvidiaNimApiKey(),
    baseURL: env.NVIDIA_NIM_BASE_URL
  });

  try {
    const response = await nvidiaNimClient.chat.completions.create({
      model: env.NVIDIA_NIM_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 1800,
      response_format: responseFormat === "json" ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    return response.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    throw new AppError("NVIDIA NIM request failed.", 502, error.error?.message || error.message);
  }
};

const callGroq = async ({ system, user }) => {
  groqClient ||= new Groq({ apiKey: env.GROQ_API_KEY });
  const response = await groqClient.chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  return response.choices?.[0]?.message?.content ?? "";
};

const callLLM = async (payload) => {
  const provider = getProvider();
  if (provider === "openai") return { provider, content: await callOpenAI(payload) };
  if (provider === "claude") return { provider, content: await callClaude(payload) };
  if (provider === "nvidia_nim") return { provider, content: await callNvidiaNim(payload) };
  return { provider, content: await callGroq(payload) };
};

export const summarizeMeeting = async (transcriptText) => {
  const { provider, content } = await callLLM({
    system: summarySystemPrompt,
    user: `Transcript:\n${transcriptText}`,
    responseFormat: "json"
  });

  return {
    provider,
    summary: parseJson(content, {
      attendees: [],
      keyDecisions: [],
      discussionPoints: [],
      blockers: [],
      openQuestions: [],
      nextSteps: []
    })
  };
};

export const extractActionItems = async (transcriptText) => {
  const { provider, content } = await callLLM({
    system: actionItemsSystemPrompt,
    user: `Transcript:\n${transcriptText}`,
    responseFormat: "json"
  });

  const parsed = parseJson(content, []);
  return {
    provider,
    actionItems: Array.isArray(parsed) ? parsed : parsed.actionItems ?? []
  };
};

export const answerQuestion = async ({ question, context }) => {
  const { provider, content } = await callLLM({
    system: qaSystemPrompt,
    user: `Question:\n${question}\n\nTranscript context:\n${context}`
  });

  return {
    provider,
    answer: content.trim()
  };
};
