// src/integrations/supabase/client.ts (YOUR version)
import { createClient } from "@supabase/supabase-js";

// Use YOUR Supabase URL and key (from .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or key. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
