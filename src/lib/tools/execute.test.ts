import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/memory";
import { executeTool } from "@/lib/tools/execute";

const now = new Date("2026-10-22T12:00:00.000Z");

async function readyCall() {
  const store = new MemoryStore();
  const created = await store.createCall({ callerConsent: true, storeTranscript: false });
  return { store, call: created.call };
}

describe("receptionist tools", () => {
  it("does not save an appointment when the date is in the past", async () => {
    const { store, call } = await readyCall();
    const result = await executeTool({
      store,
      call,
      name: "create_appointment_request",
      openaiCallId: "call_past",
      now,
      arguments: {
        callerName: "Asha Menon",
        callerPhone: "9876543210",
        requestedService: "General consultation",
        preferredDate: "2026-10-21",
        preferredTime: "11:00 AM",
        detailsConfirmed: true,
      },
    });
    expect(result.output).toMatchObject({ saved: false });
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it("returns the same result for a duplicate tool call and saves once", async () => {
    const { store, call } = await readyCall();
    const args = {
      callerName: "Asha Menon",
      callerPhone: "9876543210",
      requestedDoctor: "Dr. Ananya Rao",
      preferredDate: "2026-10-23",
      preferredTime: "11:00 AM",
      detailsConfirmed: true,
    };
    const first = await executeTool({ store, call, name: "create_appointment_request", openaiCallId: "call_once", now, arguments: args });
    const second = await executeTool({ store, call, name: "create_appointment_request", openaiCallId: "call_once", now, arguments: args });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.output).toEqual(first.output);
    expect(await store.listAppointments()).toHaveLength(1);
  });

  it("collapses the same appointment details from a second tool call", async () => {
    const { store, call } = await readyCall();
    const args = {
      callerName: "Asha Menon",
      callerPhone: "98765 43210",
      requestedService: "Dermatology",
      preferredDate: "2026-10-24",
      preferredTime: "4:30 PM",
      detailsConfirmed: true,
    };
    await executeTool({ store, call, name: "create_appointment_request", openaiCallId: "call_a", now, arguments: args });
    const again = await executeTool({ store, call, name: "create_appointment_request", openaiCallId: "call_b", now, arguments: args });
    expect(again.output).toMatchObject({ duplicate: true, saved: true });
    expect(await store.listAppointments()).toHaveLength(1);
  });

  it("refuses an unknown tool without writing an appointment", async () => {
    const { store, call } = await readyCall();
    const result = await executeTool({
      store,
      call,
      name: "drop_table",
      openaiCallId: "call_bad",
      arguments: { sql: "delete from demo_calls" },
    });
    expect(result.output).toMatchObject({ error: "That action is not available." });
    expect(await store.listAppointments()).toHaveLength(0);
  });

  it("does not invent appointment slots", async () => {
    const { store, call } = await readyCall();
    const result = await executeTool({
      store,
      call,
      name: "get_available_demo_slots",
      openaiCallId: "call_slots",
      now,
      arguments: { preferredDate: "2026-10-23" },
    });
    expect(result.output).toMatchObject({ calendarConnected: false, demonstration: true });
    expect(JSON.stringify(result.output)).not.toContain("slotId");
  });

  it("keeps sample records out of the activity counts", async () => {
    const store = new MemoryStore();
    await store.insertSamples();
    const created = await store.createCall({ callerConsent: true, storeTranscript: false });
    await store.endCall(created.call.id, {
      outcome: "completed",
      summary: "A real demo call.",
      summaryDetail: {
        reason: "Hours",
        questionsAnswered: [],
        callerName: null,
        callerPhoneStored: false,
        requestedService: null,
        requestedDoctor: null,
        appointmentRequested: false,
        followUpAction: "None",
        humanAssistanceNeeded: false,
        narrative: "A real demo call.",
      },
      transcript: null,
    });
    const metrics = await store.metrics();
    expect(metrics.callsCompleted).toBe(1);
    expect(metrics.appointmentRequests).toBe(0);
  });
});
