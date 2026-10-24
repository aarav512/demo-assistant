import { describe, expect, it } from "vitest";
import { clinicSettingsSchema, createAppointmentRequestSchema } from "@/lib/validation/schemas";
import { isTodayOrFuture } from "@/lib/utils/dates";

const now = new Date("2026-10-22T12:00:00.000Z");

function request(overrides: Record<string, unknown> = {}) {
  return createAppointmentRequestSchema(now).safeParse({
    callerName: "Asha Menon",
    callerPhone: "9876543210",
    requestedService: "General consultation",
    requestedDoctor: "Dr. Ananya Rao",
    preferredDate: "2026-10-23",
    preferredTime: "11:00 AM",
    notes: "First visit",
    detailsConfirmed: true,
    ...overrides,
  });
}

describe("appointment requests", () => {
  it("accepts a complete future request and normalises the phone", () => {
    const parsed = request();
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.callerPhone).toBe("+919876543210");
  });

  it("rejects a past date", () => {
    expect(isTodayOrFuture("2026-10-21", now)).toBe(false);
    const parsed = request({ preferredDate: "2026-10-21" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.path.join(".") === "preferredDate")).toBe(true);
  });

  it("rejects an impossible calendar date", () => {
    expect(request({ preferredDate: "2026-02-31" }).success).toBe(false);
  });

  it("requires a caller name and phone", () => {
    expect(request({ callerName: "A" }).success).toBe(false);
    expect(request({ callerPhone: "12345" }).success).toBe(false);
  });

  it("requires either a doctor or a service", () => {
    expect(request({ requestedDoctor: "", requestedService: "" }).success).toBe(false);
  });

  it("requires the caller to confirm before saving", () => {
    expect(request({ detailsConfirmed: false }).success).toBe(false);
  });

  it("rejects an empty clinic name", () => {
    expect(clinicSettingsSchema.safeParse({ clinicName: "A" }).success).toBe(false);
  });
});
