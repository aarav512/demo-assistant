import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CLINIC } from "@/lib/clinic/default-clinic";
import { HttpError } from "@/lib/http";
import { hashToken, tokenMatches } from "@/lib/auth/tokens";
import type {
  AppointmentRequest,
  AppointmentStatus,
  ClinicSettings,
  DemoCall,
  Enquiry,
  Metrics,
  TranscriptLine,
} from "@/types/domain";
import type {
  AppointmentKey,
  CreateCallInput,
  EndCallInput,
  NewAppointment,
  NewEnquiry,
  Repository,
} from "@/lib/data/repository";

type CallRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  caller_name: string | null;
  caller_phone: string | null;
  caller_consent: boolean;
  store_transcript: boolean;
  call_reason: string | null;
  summary: string | null;
  summary_detail: DemoCall["summaryDetail"];
  outcome: DemoCall["outcome"];
  transcript: TranscriptLine[] | null;
  human_follow_up: boolean;
  follow_up_status: DemoCall["followUpStatus"];
  failure_reason: string | null;
  is_sample: boolean;
  access_token_hash: string;
  created_at: string;
};

export class SupabaseStore implements Repository {
  readonly mode = "supabase" as const;

  constructor(private readonly client: SupabaseClient) {}

  async createCall(input: CreateCallInput): Promise<{ call: DemoCall; token: string }> {
    const token = randomBytes(32).toString("base64url");
    const { data, error } = await this.client
      .from("demo_calls")
      .insert({
        started_at: input.startedAt ?? new Date().toISOString(),
        caller_consent: input.callerConsent,
        store_transcript: input.storeTranscript,
        is_sample: Boolean(input.isSample),
        access_token_hash: hashToken(token),
        outcome: "in_progress",
      })
      .select("*")
      .single();
    if (error) throw databaseError(error);
    return { call: mapCall(data as CallRow), token };
  }

  async getCall(id: string): Promise<DemoCall | null> {
    const row = await this.callRow(id);
    return row ? mapCall(row) : null;
  }

  async getCallForToken(id: string, token: string): Promise<DemoCall | null> {
    const row = await this.callRow(id);
    if (!row || !tokenMatches(token, row.access_token_hash)) return null;
    return mapCall(row);
  }

  async endCall(id: string, input: EndCallInput): Promise<DemoCall | null> {
    const existing = await this.callRow(id);
    if (!existing) return null;
    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(existing.started_at).getTime()) / 1000));
    const { data, error } = await this.client
      .from("demo_calls")
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        summary: input.summary,
        summary_detail: input.summaryDetail,
        outcome: input.outcome,
        transcript: input.transcript,
        failure_reason: input.failureReason ?? null,
        call_reason: input.callReason ?? existing.call_reason,
        caller_name: input.callerName ?? existing.caller_name,
        caller_phone: input.callerPhone ?? existing.caller_phone,
        human_follow_up: input.humanFollowUp ?? existing.human_follow_up,
        follow_up_status: input.followUpStatus ?? existing.follow_up_status,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw databaseError(error);
    return mapCall(data as CallRow);
  }

  async updateCaller(id: string, patch: { callerName?: string | null; callerPhone?: string | null; callReason?: string | null }): Promise<void> {
    const update: Record<string, string> = {};
    if (patch.callerName) update.caller_name = patch.callerName;
    if (patch.callerPhone) update.caller_phone = patch.callerPhone;
    if (patch.callReason) update.call_reason = patch.callReason;
    if (Object.keys(update).length === 0) return;
    const { error } = await this.client.from("demo_calls").update(update).eq("id", id);
    if (error) throw databaseError(error);
  }

  async listCalls(): Promise<DemoCall[]> {
    await this.applyRetention();
    const { data, error } = await this.client.from("demo_calls").select("*").order("created_at", { ascending: false });
    if (error) throw databaseError(error);
    return (data as CallRow[]).map(mapCall);
  }

  async metrics(): Promise<Metrics> {
    const [calls, appointments, enquiries] = await Promise.all([
      this.client.from("demo_calls").select("outcome, human_follow_up, is_sample"),
      this.client.from("appointment_requests").select("is_sample"),
      this.client.from("demo_enquiries").select("is_sample"),
    ]);
    if (calls.error) throw databaseError(calls.error);
    if (appointments.error) throw databaseError(appointments.error);
    if (enquiries.error) throw databaseError(enquiries.error);
    const realCalls = (calls.data ?? []).filter((row) => !row.is_sample);
    return {
      callsCompleted: realCalls.filter((row) => row.outcome === "completed").length,
      enquiriesCaptured: (enquiries.data ?? []).filter((row) => !row.is_sample).length,
      appointmentRequests: (appointments.data ?? []).filter((row) => !row.is_sample).length,
      callsNeedingFollowUp: realCalls.filter((row) => row.human_follow_up).length,
    };
  }

  async createAppointment(input: NewAppointment): Promise<AppointmentRequest> {
    const { data, error } = await this.client
      .from("appointment_requests")
      .insert({
        demo_call_id: input.demoCallId,
        caller_name: input.callerName,
        caller_phone: input.callerPhone,
        requested_service: input.requestedService,
        requested_doctor: input.requestedDoctor,
        preferred_date: input.preferredDate,
        preferred_time: input.preferredTime,
        notes: input.notes,
        status: "new",
        is_sample: Boolean(input.isSample),
      })
      .select("*")
      .single();
    if (error) throw databaseError(error);
    return mapAppointment(data as AppointmentRow);
  }

  async findDuplicateAppointment(callId: string, key: AppointmentKey): Promise<AppointmentRequest | null> {
    const { data, error } = await this.client
      .from("appointment_requests")
      .select("*")
      .eq("demo_call_id", callId)
      .eq("caller_phone", key.callerPhone)
      .eq("preferred_date", key.preferredDate)
      .eq("preferred_time", key.preferredTime);
    if (error) throw databaseError(error);
    const found = (data as AppointmentRow[]).find(
      (row) => row.requested_service === key.requestedService && row.requested_doctor === key.requestedDoctor,
    );
    return found ? mapAppointment(found) : null;
  }

  async listAppointments(): Promise<AppointmentRequest[]> {
    const { data, error } = await this.client.from("appointment_requests").select("*").order("created_at", { ascending: false });
    if (error) throw databaseError(error);
    return (data as AppointmentRow[]).map(mapAppointment);
  }

  async listAppointmentsForCall(callId: string): Promise<AppointmentRequest[]> {
    const { data, error } = await this.client.from("appointment_requests").select("*").eq("demo_call_id", callId);
    if (error) throw databaseError(error);
    return (data as AppointmentRow[]).map(mapAppointment);
  }

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<AppointmentRequest | null> {
    const { data, error } = await this.client.from("appointment_requests").update({ status }).eq("id", id).select("*").maybeSingle();
    if (error) throw databaseError(error);
    return data ? mapAppointment(data as AppointmentRow) : null;
  }

  async getSettings(): Promise<ClinicSettings> {
    const { data, error } = await this.client.from("clinic_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw databaseError(error);
    if (!data) {
      await this.updateSettings(DEFAULT_CLINIC);
      return this.getSettings();
    }
    return mapSettings(data as SettingsRow);
  }

  async updateSettings(input: ClinicSettings): Promise<ClinicSettings> {
    const updatedAt = new Date().toISOString();
    const { data, error } = await this.client
      .from("clinic_settings")
      .upsert({
        id: 1,
        clinic_name: input.clinicName,
        address: input.address,
        opening_hours: input.openingHours,
        services: input.services,
        doctors: input.doctors,
        faqs: input.faqs,
        appointment_instructions: input.appointmentInstructions,
        escalation_instructions: input.escalationInstructions,
        retention_days: input.retentionDays,
        updated_at: updatedAt,
      })
      .select("*")
      .single();
    if (error) throw databaseError(error);
    return mapSettings(data as SettingsRow);
  }

  async createEnquiry(input: NewEnquiry): Promise<Enquiry> {
    const { data, error } = await this.client
      .from("demo_enquiries")
      .insert({
        demo_call_id: input.demoCallId,
        caller_name: input.callerName,
        caller_phone: input.callerPhone,
        enquiry_type: input.enquiryType,
        summary: input.summary,
        follow_up_status: input.followUpStatus ?? "none",
        is_sample: Boolean(input.isSample),
      })
      .select("*")
      .single();
    if (error) throw databaseError(error);
    return mapEnquiry(data as EnquiryRow);
  }

  async listEnquiries(): Promise<Enquiry[]> {
    const { data, error } = await this.client.from("demo_enquiries").select("*").order("created_at", { ascending: false });
    if (error) throw databaseError(error);
    return (data as EnquiryRow[]).map(mapEnquiry);
  }

  async listEnquiriesForCall(callId: string): Promise<Enquiry[]> {
    const { data, error } = await this.client.from("demo_enquiries").select("*").eq("demo_call_id", callId);
    if (error) throw databaseError(error);
    return (data as EnquiryRow[]).map(mapEnquiry);
  }

  async saveToolResult(input: { callId: string; openaiCallId: string; name: string; result: unknown }): Promise<void> {
    const { error } = await this.client.from("tool_invocations").insert({
      demo_call_id: input.callId,
      openai_call_id: input.openaiCallId,
      tool_name: input.name,
      result: input.result,
    });
    if (error && error.code !== "23505") throw databaseError(error);
  }

  async getToolResult(callId: string, openaiCallId: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("tool_invocations")
      .select("result")
      .eq("demo_call_id", callId)
      .eq("openai_call_id", openaiCallId)
      .maybeSingle();
    if (error) throw databaseError(error);
    return data ? (data.result as unknown) : null;
  }

  async markFollowUp(callId: string, reason: string): Promise<void> {
    const existing = await this.callRow(callId);
    if (!existing) return;
    const { error } = await this.client
      .from("demo_calls")
      .update({
        human_follow_up: true,
        follow_up_status: "needed",
        call_reason: existing.call_reason ?? reason,
      })
      .eq("id", callId);
    if (error) throw databaseError(error);
  }

  async resetDemo(): Promise<void> {
    const tables = ["tool_invocations", "demo_enquiries", "appointment_requests", "demo_calls"] as const;
    for (const table of tables) {
      const { error } = await this.client.from(table).delete().not("id", "is", null);
      if (error) throw databaseError(error);
    }
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
    const settings = await this.getSettings();
    const cutoff = new Date(now.getTime() - settings.retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await this.client.from("demo_calls").delete().lt("started_at", cutoff);
    if (error) throw databaseError(error);
  }

  private async callRow(id: string): Promise<CallRow | null> {
    const { data, error } = await this.client.from("demo_calls").select("*").eq("id", id).maybeSingle();
    if (error) throw databaseError(error);
    return (data as CallRow | null) ?? null;
  }
}

type AppointmentRow = {
  id: string;
  demo_call_id: string | null;
  caller_name: string;
  caller_phone: string;
  requested_service: string | null;
  requested_doctor: string | null;
  preferred_date: string;
  preferred_time: string;
  notes: string | null;
  status: AppointmentStatus;
  is_sample: boolean;
  created_at: string;
};

type EnquiryRow = {
  id: string;
  demo_call_id: string | null;
  caller_name: string | null;
  caller_phone: string | null;
  enquiry_type: string;
  summary: string;
  follow_up_status: Enquiry["followUpStatus"];
  is_sample: boolean;
  created_at: string;
};

type SettingsRow = {
  clinic_name: string;
  address: string;
  opening_hours: ClinicSettings["openingHours"];
  services: string[];
  doctors: ClinicSettings["doctors"];
  faqs: ClinicSettings["faqs"];
  appointment_instructions: string;
  escalation_instructions: string;
  retention_days: number;
  updated_at: string;
};

function mapCall(row: CallRow): DemoCall {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    callerName: row.caller_name,
    callerPhone: row.caller_phone,
    callerConsent: row.caller_consent,
    storeTranscript: row.store_transcript,
    callReason: row.call_reason,
    summary: row.summary,
    summaryDetail: row.summary_detail,
    outcome: row.outcome,
    transcript: row.transcript,
    humanFollowUp: row.human_follow_up,
    followUpStatus: row.follow_up_status,
    failureReason: row.failure_reason,
    isSample: row.is_sample,
    createdAt: row.created_at,
  };
}

function mapAppointment(row: AppointmentRow): AppointmentRequest {
  return {
    id: row.id,
    demoCallId: row.demo_call_id,
    callerName: row.caller_name,
    callerPhone: row.caller_phone,
    requestedService: row.requested_service,
    requestedDoctor: row.requested_doctor,
    preferredDate: String(row.preferred_date).slice(0, 10),
    preferredTime: row.preferred_time,
    notes: row.notes,
    status: row.status,
    isSample: row.is_sample,
    createdAt: row.created_at,
  };
}

function mapEnquiry(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    demoCallId: row.demo_call_id,
    callerName: row.caller_name,
    callerPhone: row.caller_phone,
    enquiryType: row.enquiry_type,
    summary: row.summary,
    followUpStatus: row.follow_up_status,
    isSample: row.is_sample,
    createdAt: row.created_at,
  };
}

function mapSettings(row: SettingsRow): ClinicSettings {
  return {
    clinicName: row.clinic_name,
    address: row.address,
    openingHours: row.opening_hours,
    services: row.services,
    doctors: row.doctors,
    faqs: row.faqs,
    appointmentInstructions: row.appointment_instructions,
    escalationInstructions: row.escalation_instructions,
    retentionDays: row.retention_days,
    updatedAt: row.updated_at,
  };
}

function databaseError(error: { code?: string; message?: string }): HttpError {
  console.error("Database error", error.code ?? "unknown");
  if (error.code === "42P01" || error.code === "PGRST205") {
    return new HttpError(
      503,
      "database_not_ready",
      "The database is not ready. Apply the Supabase migration, then try again.",
    );
  }
  if (error.message === "Invalid API key" || error.code === "PGRST301") {
    return new HttpError(503, "database_unauthorized", "The database rejected the server credentials.");
  }
  return new HttpError(503, "database_error", "The database could not complete that request.");
}
