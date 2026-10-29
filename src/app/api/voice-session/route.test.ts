import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/data/memory";
import { setRepositoryForTests } from "@/lib/data/store";
import { POST as startVoice } from "@/app/api/voice-session/route";
import { PATCH as updateAppointment } from "@/app/api/appointments/[id]/route";
import { buildSessionConfig, createRealtimeAnswer, encodeRealtimeCall, ensureSdpLineEnding, safeUpstreamDescription } from "@/lib/openai/realtime-session";
import { DEFAULT_CLINIC } from "@/lib/clinic/default-clinic";
import { resetRateLimits } from "@/lib/utils/rate-limit";
import { voiceSessionSchema } from "@/lib/validation/schemas";

const store = new MemoryStore();

beforeEach(async () => {
  await store.resetDemo();
  setRepositoryForTests(store);
  resetRateLimits();
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_REALTIME_MODEL", "");
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("DEMO_ADMIN_PASSWORD", "");
  vi.stubEnv("SESSION_SECRET", "");
});

afterEach(() => {
  setRepositoryForTests(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("voice service failures", () => {
  it("does not open a call or contact OpenAI when the key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: "v=0\r\noffer", consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Voice service not configured.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await store.listCalls()).toHaveLength(0);
  });

  it("keeps the API key on the server during session setup", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    const fetchMock = vi.fn(async () => new Response("v=0\r\nanswer", { status: 200 }));
    const answer = await createRealtimeAnswer({
      sdp: "v=0\r\noffer",
      clinic: DEFAULT_CLINIC,
      safetyId: "demo",
      fetchImpl: fetchMock,
    });
    expect(answer.startsWith("v=")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test-secret",
      Accept: "application/sdp",
    });
    expect(String((init.headers as Record<string, string>)["Content-Type"])).toContain("multipart/form-data; boundary=");
    const body = String(init.body);
    expect(body).toContain("Content-Type: application/sdp");
    expect(body).toContain("Content-Type: application/json");
    expect(body).toContain("v=0\r\noffer");
    const session = JSON.parse(multipartPart(body, "session"));
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.input.turn_detection.create_response).toBe(true);
    expect(session.tools.map((tool: { name: string }) => tool.name)).toContain("create_appointment_request");
    expect(body).not.toContain("sk-test-secret");
    expect(buildSessionConfig(DEFAULT_CLINIC).audio.output.voice).toBe("marin");
  });

  it("returns a sanitized voice_unavailable error when the upstream call is rejected", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    const logged: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "invalid_request_error",
                message: "Session was not parsed. Key sk-test-secret. v=0\r\na=ice-ufrag:not-for-logs",
              },
            }),
            { status: 400 },
          ),
      ),
    );
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: "v=0\r\noffer", consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("voice_unavailable");
    expect(body.error).toBe("The voice service could not start a session.");
    expect(body.error).not.toContain("sk-test-secret");
    const diagnostic = logged.flat().join(" ");
    expect(diagnostic).toContain("HTTP 400");
    expect(diagnostic).toContain("invalid_request_error");
    expect(diagnostic).not.toContain("sk-test-secret");
    expect(diagnostic).not.toContain("a=ice-ufrag");
  });

  it("describes an upstream failure without copying SDP or keys", () => {
    const description = safeUpstreamDescription(
      400,
      JSON.stringify({ error: { code: "missing_model", message: "model missing sk-live-secret" } }),
    );
    expect(description).toBe("HTTP 400 missing_model: model missing [redacted]");
    expect(safeUpstreamDescription(400, "v=0\r\na=fingerprint:AA:BB")).toBe("HTTP 400 non-json body");
    const encoded = encodeRealtimeCall("v=0\r\noffer", { type: "realtime", model: "gpt-realtime-2.1" });
    expect(encoded.contentType).toMatch(/^multipart\/form-data; boundary=kynexRealtime/);
    expect(multipartPart(encoded.body, "sdp")).toBe("v=0\r\noffer\r\n");
    expect(encoded.body).toContain('Content-Type: application/json\r\n\r\n{"type":"realtime","model":"gpt-realtime-2.1"}');
  });

  it("forwards the browser offer with its trailing line ending", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    const offer = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n";
    expect(voiceSessionSchema.parse({ sdp: offer, consent: true }).sdp).toBe(offer);
    const fetchMock = vi.fn(async () => new Response("v=0\r\nanswer\r\n", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: offer, consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(multipartPart(String(init.body), "sdp")).toBe(offer);
  });

  it("keeps the final CRLF on the SDP answer Chrome will play", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    const upstream = "v=0\r\na=ice-pwd:example\r\n";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(upstream, { status: 200 })));
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: "v=0\r\noffer\r\n", consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { sdp: string };
    expect(payload.sdp).toBe(upstream);
    expect(ensureSdpLineEnding("v=0\r\na=ice-pwd:example")).toBe(upstream);
  });

  it("tells the caller when the voice credentials are rejected", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Incorrect API key provided: sk-test-secret" } }), { status: 401 })),
    );
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: "v=0\r\noffer", consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("voice_unauthorized");
    expect(body.error).toBe("The voice service rejected the server credentials.");
    expect(body.error).not.toContain("sk-test-secret");
  });

  it("strips wrapping quotes before the key is sent to the model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "\"sk-test-secret\"");
    const fetchMock = vi.fn(async () => new Response("v=0\r\nanswer", { status: 200 }));
    await createRealtimeAnswer({
      sdp: "v=0\r\noffer",
      clinic: DEFAULT_CLINIC,
      safetyId: "demo",
      fetchImpl: fetchMock,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test-secret" });
  });

  it("treats an invalid_api_key body as rejected credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "invalid_api_key", message: "Incorrect API key provided: sk-test-secret" } }), { status: 401 })),
    );
    const response = await startVoice(
      new Request("http://localhost:3000/api/voice-session", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({ sdp: "v=0\r\noffer", consent: true, storeTranscript: false }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string; error: string };
    expect(body.code).toBe("voice_unauthorized");
    expect(body.error).not.toContain("sk-test-secret");
  });
});

function multipartPart(body: string, name: string): string {
  const marker = `name="${name}"\r\nContent-Type: `;
  const start = body.indexOf(marker);
  if (start < 0) throw new Error(`Missing multipart part ${name}`);
  const valueStart = body.indexOf("\r\n\r\n", start);
  const valueEnd = body.indexOf("\r\n--", valueStart + 4);
  return body.slice(valueStart + 4, valueEnd);
}

describe("appointment administration", () => {
  it("refuses to confirm an appointment without an admin session", async () => {
    const created = await store.createCall({ callerConsent: true, storeTranscript: false });
    const appointment = await store.createAppointment({
      demoCallId: created.call.id,
      callerName: "Asha Menon",
      callerPhone: "+919876543210",
      requestedService: "General consultation",
      requestedDoctor: null,
      preferredDate: "2026-10-23",
      preferredTime: "11:00 AM",
      notes: null,
    });
    const response = await updateAppointment(
      new Request("http://localhost:3000/api/appointments/" + appointment.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      }),
      { params: Promise.resolve({ id: appointment.id }) },
    );
    expect(response.status).toBe(503);
    const saved = await store.listAppointments();
    expect(saved[0]?.status).toBe("new");
  });
});
