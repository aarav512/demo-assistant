import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)?.trim();
  if (!url || !service) return null;
  if (anon && anon === service) {
    console.error("Refusing database access because the service key matches the public key.");
    return null;
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function databaseConfigured(): boolean {
  return createServiceClient() !== null;
}
