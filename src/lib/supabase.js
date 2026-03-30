import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let browserClient;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return browserClient;
}

export async function saveWorkshopResponse(payload) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return {
      data: null,
      error: new Error("Supabase environment variables are missing."),
    };
  }

  const { data, error } = await client
    .from("workshop_responses")
    .insert(payload)
    .select("id")
    .single();

  return { data, error };
}
