export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: string, error: string): Response {
  return Response.json({ error, code }, { status });
}

export async function readJson(request: Request, maxBytes = 40_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) {
    throw new HttpError(413, "too_large", "That request was too large.");
  }
  if (!text.trim()) {
    throw new HttpError(400, "invalid_json", "The request could not be read.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "invalid_json", "The request could not be read.");
  }
}

export function logSafe(error: unknown): void {
  if (!(error instanceof Error)) {
    console.error("Unexpected failure");
    return;
  }
  if (/sk-|ek_|bearer|api[_ ]?key|secret|\+91\d{10}/i.test(error.message)) {
    console.error("Unexpected failure", error.name);
    return;
  }
  console.error("Unexpected failure", error.name, error.message.slice(0, 180));
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
  logSafe(error);
  return jsonError(500, "server_error", "Something went wrong. Please try again.");
}
