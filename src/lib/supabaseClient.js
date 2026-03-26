import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      "Supabase no esta configurado. Define REACT_APP_SUPABASE_URL y REACT_APP_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}
