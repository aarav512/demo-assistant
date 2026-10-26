import { getCloudflareContext } from "@opennextjs/cloudflare";

const cloudflareContextSymbol = Symbol.for("__cloudflare-context__");

/**
 * Read a server-only value. Worker secrets win over values baked in at build time.
 * Never log the return value.
 */
export async function serverEnv(name: string): Promise<string> {
  const fromBinding = cloudflareBinding(name);
  if (fromBinding) return fromBinding;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const value = (env as Record<string, unknown>)[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    } catch {
      // Unit tests and local Node have no Worker request context.
    }
  }
  return process.env[name]?.trim() ?? "";
}

export function normalizeApiKey(value: string): string {
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/^bearer\s+/i, "").trim();
  return key;
}

export async function openAiApiKey(): Promise<string> {
  return normalizeApiKey(await serverEnv("OPENAI_API_KEY"));
}

export async function openAiRealtimeModel(fallback: string): Promise<string> {
  return (await serverEnv("OPENAI_REALTIME_MODEL")) || fallback;
}

function cloudflareBinding(name: string): string {
  const context = (globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>)[cloudflareContextSymbol];
  const value = context?.env?.[name];
  return typeof value === "string" ? value.trim() : "";
}
