import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "./env.js";

let supabaseClient;

export const getSupabase = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClient;
};

export const storageBucket = env.SUPABASE_STORAGE_BUCKET;
