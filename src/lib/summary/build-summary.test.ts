import { describe, expect, it } from "vitest";
import { buildCallSummary } from "@/lib/summary/build-summary";
import type { DemoCall } from "@/types/domain";

const call: DemoCall = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  startedAt: "2026-10-22T12:00:00.000Z",
  endedAt: null,
  durationSeconds: null,
  callerName: null,
  callerPhone: null,
  callerConsent: true,
  storeTranscript: false,
  callReason: null,
  summary: null,
  summaryDetail: null,
  outcome: "in_progress",
  transcript: null,
  humanFollowUp: false,
  followUpStatus: "none",
  failureReason: null,
  isSample: false,
  createdAt: "2026-10-22T12:00:00.000Z",
};

describe("call summaries", () => {
  it("explains a failure instead of inventing a conversation", () => {
    const summary = buildCallSummary({
      call,
      appointments: [],
      enquiries: [],
      outcome: "failed",
      failureReason: "The voice service could not start.",
    });
    expect(summary.narrative).toContain("could not start");
    expect(summary.appointmentRequested).toBe(false);
  });
});
