import { isAdminRequest } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data/store";
import { errorResponse, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      return jsonError(401, "unauthorized", "Only a demo administrator can add sample records.");
    }
    await getRepository().insertSamples();
    return Response.json({
      inserted: true,
      notice: "Sample records were added. They are labelled and are not included in the activity counts.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
