import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/data/memory";
import { setRepositoryForTests } from "@/lib/data/store";
import { POST as startVoice } from "@/app/api/voice-session/route";
import { PATCH as updateAppointment } from "@/app/api/appointments/[id]/route";
import { buildSessionConfig, createRealtimeAnswer } from "@/lib/openai/realtime-session";
import { DEFAULT_CLINIC } from "@/lib/clinic/default-clinic";
import { resetRateLimits } from "@/lib/utils/rate-limit";

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
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test-secret" });
    const session = JSON.parse(String((init.body as FormData).get("session")));
    expect(session.model).toBe("gpt-realtime-2.1");
    expect(session.output_modalities).toEqual(["audio"]);
    expect(session.audio.input.turn_detection.create_response).toBe(true);
    expect(session.tools.map((tool: { name: string }) => tool.name)).toContain("create_appointment_request");
    expect(JSON.stringify(session)).not.toContain("sk-test-secret");
    expect(buildSessionConfig(DEFAULT_CLINIC).audio.output.voice).toBe("marin");
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
});

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
