import { adminConfigured } from "@/lib/auth/admin";
import { storageMode } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)?.trim();
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
  return Response.json({
    voice: process.env.OPENAI_API_KEY?.trim() ? "configured" : "not_configured",
    database: storageMode(),
    admin: adminConfigured() ? "configured" : "not_configured",
    publicKey: anon ? "set" : "missing",
    serviceKeyDistinct: Boolean(service && anon && service !== anon),
  });
}
