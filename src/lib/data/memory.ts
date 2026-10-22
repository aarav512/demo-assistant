import { randomBytes } from "crypto";
import { DEFAULT_CLINIC } from "@/lib/clinic/default-clinic";
import { hashToken, tokenMatches } from "@/lib/auth/tokens";
import type {
  AppointmentRequest,
  ClinicSettings,
  DemoCall,
  Enquiry,
  Metrics,
} from "@/types/domain";
import type {
  AppointmentKey,
  CreateCallInput,
  EndCallInput,
  NewAppointment,
  NewEnquiry,
  Repository,
} from "@/lib/data/repository";

type StoredCall = DemoCall & { accessTokenHash: string };

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStore implements Repository {
  readonly mode = "memory" as const;
  private calls: StoredCall[] = [];
  private appointments: AppointmentRequest[] = [];
  private enquiries: Enquiry[] = [];
  private tools = new Map<string, unknown>();
  private settings: ClinicSettings = clone(DEFAULT_CLINIC);

  async createCall(input: CreateCallInput): Promise<{ call: DemoCall; token: string }> {
    const token = randomBytes(32).toString("base64url");
    const now = input.startedAt ?? new Date().toISOString();
    const call: StoredCall = {
      id: crypto.randomUUID(),
      startedAt: now,
      endedAt: null,
      durationSeconds: null,
      callerName: null,
      callerPhone: null,
      callerConsent: input.callerConsent,
      storeTranscript: input.storeTranscript,
      callReason: null,
      summary: null,
      summaryDetail: null,
      outcome: "in_progress",
      transcript: null,
      humanFollowUp: false,
      followUpStatus: "none",
      failureReason: null,
      isSample: Boolean(input.isSample),
      createdAt: now,
      accessTokenHash: hashToken(token),
    };
    this.calls.unshift(call);
    return { call: publicCall(call), token };
  }

  async getCall(id: string): Promise<DemoCall | null> {
    const call = this.calls.find((item) => item.id === id);
    return call ? publicCall(call) : null;
  }

  async getCallForToken(id: string, token: string): Promise<DemoCall | null> {
    const call = this.calls.find((item) => item.id === id);
    if (!call || !tokenMatches(token, call.accessTokenHash)) return null;
    return publicCall(call);
  }

  async endCall(id: string, input: EndCallInput): Promise<DemoCall | null> {
    const call = this.calls.find((item) => item.id === id);
    if (!call) return null;
    const endedAt = new Date();
    call.endedAt = endedAt.toISOString();
    call.durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000));
    call.summary = input.summary;
    call.summaryDetail = input.summaryDetail;
    call.outcome = input.outcome;
    call.transcript = input.transcript;
    call.failureReason = input.failureReason ?? null;
    if (input.callReason) call.callReason = input.callReason;
    if (input.callerName) call.callerName = input.callerName;
    if (input.callerPhone) call.callerPhone = input.callerPhone;
    if (input.humanFollowUp) call.humanFollowUp = true;
    if (input.followUpStatus) call.followUpStatus = input.followUpStatus;
    return publicCall(call);
  }

  async updateCaller(id: string, patch: { callerName?: string | null; callerPhone?: string | null; callReason?: string | null }): Promise<void> {
    const call = this.calls.find((item) => item.id === id);
    if (!call) return;
    if (patch.callerName) call.callerName = patch.callerName;
    if (patch.callerPhone) call.callerPhone = patch.callerPhone;
    if (patch.callReason) call.callReason = patch.callReason;
  }

  async listCalls(): Promise<DemoCall[]> {
    return this.calls.map(publicCall);
  }

  async metrics(): Promise<Metrics> {
    const realCalls = this.calls.filter((call) => !call.isSample);
    const realAppointments = this.appointments.filter((item) => !item.isSample);
    const realEnquiries = this.enquiries.filter((item) => !item.isSample);
    return {
      callsCompleted: realCalls.filter((call) => call.outcome === "completed").length,
      enquiriesCaptured: realEnquiries.length,
      appointmentRequests: realAppointments.length,
      callsNeedingFollowUp: realCalls.filter((call) => call.humanFollowUp).length,
    };
  }

  async createAppointment(input: NewAppointment): Promise<AppointmentRequest> {
    const appointment: AppointmentRequest = {
      id: crypto.randomUUID(),
      demoCallId: input.demoCallId,
      callerName: input.callerName,
      callerPhone: input.callerPhone,
      requestedService: input.requestedService,
      requestedDoctor: input.requestedDoctor,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      notes: input.notes,
      status: "new",
      isSample: Boolean(input.isSample),
      createdAt: new Date().toISOString(),
    };
    this.appointments.unshift(appointment);
    return clone(appointment);
  }

  async findDuplicateAppointment(callId: string, key: AppointmentKey): Promise<AppointmentRequest | null> {
    const found = this.appointments.find(
      (item) =>
        item.demoCallId === callId &&
        item.callerPhone === key.callerPhone &&
        item.requestedService === key.requestedService &&
        item.requestedDoctor === key.requestedDoctor &&
        item.preferredDate === key.preferredDate &&
        item.preferredTime === key.preferredTime,
    );
    return found ? clone(found) : null;
  }

  async listAppointments(): Promise<AppointmentRequest[]> {
    return clone(this.appointments);
  }

  async listAppointmentsForCall(callId: string): Promise<AppointmentRequest[]> {
    return clone(this.appointments.filter((item) => item.demoCallId === callId));
  }

  async updateAppointmentStatus(id: string, status: AppointmentRequest["status"]): Promise<AppointmentRequest | null> {
    const appointment = this.appointments.find((item) => item.id === id);
    if (!appointment) return null;
    appointment.status = status;
    return clone(appointment);
  }

  async getSettings(): Promise<ClinicSettings> {
    return clone(this.settings);
  }

  async updateSettings(input: ClinicSettings): Promise<ClinicSettings> {
    this.settings = { ...clone(input), updatedAt: new Date().toISOString() };
    return clone(this.settings);
  }

  async createEnquiry(input: NewEnquiry): Promise<Enquiry> {
    const enquiry: Enquiry = {
      id: crypto.randomUUID(),
      demoCallId: input.demoCallId,
      callerName: input.callerName,
      callerPhone: input.callerPhone,
      enquiryType: input.enquiryType,
      summary: input.summary,
      followUpStatus: input.followUpStatus ?? "none",
      isSample: Boolean(input.isSample),
      createdAt: new Date().toISOString(),
    };
    this.enquiries.unshift(enquiry);
    return clone(enquiry);
  }

  async listEnquiries(): Promise<Enquiry[]> {
    return clone(this.enquiries);
  }

  async listEnquiriesForCall(callId: string): Promise<Enquiry[]> {
    return clone(this.enquiries.filter((item) => item.demoCallId === callId));
  }

  async saveToolResult(input: { callId: string; openaiCallId: string; name: string; result: unknown }): Promise<void> {
    this.tools.set(`${input.callId}:${input.openaiCallId}`, clone(input.result));
  }

  async getToolResult(callId: string, openaiCallId: string): Promise<unknown | null> {
    const value = this.tools.get(`${callId}:${openaiCallId}`);
    return value === undefined ? null : clone(value);
  }

  async markFollowUp(callId: string, reason: string): Promise<void> {
    const call = this.calls.find((item) => item.id === callId);
    if (!call) return;
    call.humanFollowUp = true;
    call.followUpStatus = "needed";
    if (!call.callReason) call.callReason = reason;
  }

  async resetDemo(): Promise<void> {
    this.calls = [];
    this.appointments = [];
    this.enquiries = [];
    this.tools.clear();
  }

  async insertSamples(): Promise<void> {
    const started = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { call } = await this.createCall({
      callerConsent: true,
      storeTranscript: false,
      isSample: true,
      startedAt: started,
    });
    await this.endCall(call.id, {
      outcome: "completed",
      summary: "Sample record only. A fictional caller asked about closing time and requested a demonstration appointment.",
      summaryDetail: {
        reason: "Sample appointment request",
        questionsAnswered: ["Sample question about clinic closing time."],
        callerName: "Sample Caller",
        callerPhoneStored: true,
        requestedService: "General consultation",
        requestedDoctor: "Dr. Ananya Rao",
        appointmentRequested: true,
        followUpAction: "No follow-up. This is labelled sample data.",
        humanAssistanceNeeded: false,
        narrative: "This is sample data for the demonstration interface. It did not come from a real caller.",
      },
      callReason: "Sample appointment request",
      callerName: "Sample Caller",
      callerPhone: "+919000000001",
      transcript: null,
    });
    await this.createAppointment({
      demoCallId: call.id,
      callerName: "Sample Caller",
      callerPhone: "+919000000001",
      requestedService: "General consultation",
      requestedDoctor: "Dr. Ananya Rao",
      preferredDate: "2026-12-01",
      preferredTime: "10:30 AM",
      notes: "Sample data. Not a real booking.",
      isSample: true,
    });
    await this.createEnquiry({
      demoCallId: call.id,
      callerName: "Sample Caller",
      callerPhone: "+919000000001",
      enquiryType: "Hours",
      summary: "Sample question about closing time.",
      isSample: true,
    });
  }

  async applyRetention(now = new Date()): Promise<void> {
    const cutoff = now.getTime() - this.settings.retentionDays * 24 * 60 * 60 * 1000;
    const removed = new Set(
      this.calls.filter((call) => new Date(call.startedAt).getTime() < cutoff).map((call) => call.id),
    );
    this.calls = this.calls.filter((call) => !removed.has(call.id));
    this.appointments = this.appointments.filter((item) => !item.demoCallId || !removed.has(item.demoCallId));
    this.enquiries = this.enquiries.filter((item) => !item.demoCallId || !removed.has(item.demoCallId));
    for (const key of this.tools.keys()) {
      const callId = key.split(":")[0];
      if (callId && removed.has(callId)) this.tools.delete(key);
    }
  }
}

function publicCall(call: StoredCall): DemoCall {
  const { accessTokenHash, ...rest } = call;
  void accessTokenHash;
  return clone(rest);
}
