import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError, readJson } from "@/lib/http";
import { executeTool } from "@/lib/tools/execute";
import { allowRequest } from "@/lib/utils/rate-limit";
import { originAllowed } from "@/lib/utils/origin";
import { toolRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!originAllowed(request)) return jsonError(403, "forbidden", "That action was refused.");
    const parsed = toolRequestSchema.safeParse(await readJson(request, 20_000));
    if (!parsed.success) return jsonError(400, "invalid_request", "That action could not be checked.");
    if (!allowRequest(`tool:${parsed.data.callId}`, 40, 60_000)) {
      return jsonError(429, "rate_limited", "Too many actions were attempted for this demo.");
    }
    const store = getRepository();
    const call = await store.getCallForToken(parsed.data.callId, parsed.data.callToken);
    if (!call) return jsonError(404, "not_found", "That demo call was not found.");
    if (call.outcome !== "in_progress") {
      return jsonError(409, "call_closed", "This demo call has already ended.");
    }
    const result = await executeTool({
      store,
      call,
      name: parsed.data.name,
      arguments: parsed.data.arguments,
      openaiCallId: parsed.data.openaiCallId,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
