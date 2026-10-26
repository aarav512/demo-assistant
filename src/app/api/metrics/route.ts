import { getRepository, storageMode } from "@/lib/data/store";
import { errorResponse } from "@/lib/http";
import { adminConfigured } from "@/lib/auth/admin";
import { openAiApiKey } from "@/lib/openai/server-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const metrics = await getRepository().metrics();
    return Response.json({
      ...metrics,
      storage: storageMode(),
      voice: (await openAiApiKey()) ? "configured" : "not_configured",
      admin: adminConfigured() ? "configured" : "not_configured",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
