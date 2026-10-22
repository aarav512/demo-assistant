import type {
  AppointmentRequest,
  AppointmentStatus,
  CallOutcome,
  CallSummary,
  ClinicSettings,
  DemoCall,
  Enquiry,
  FollowUpStatus,
  Metrics,
  TranscriptLine,
} from "@/types/domain";

export type CreateCallInput = {
  callerConsent: boolean;
  storeTranscript: boolean;
  isSample?: boolean;
  startedAt?: string;
};

export type EndCallInput = {
  summary: string;
  summaryDetail: CallSummary;
  outcome: CallOutcome;
  transcript: TranscriptLine[] | null;
  failureReason?: string | null;
  callReason?: string | null;
  callerName?: string | null;
  callerPhone?: string | null;
  humanFollowUp?: boolean;
  followUpStatus?: FollowUpStatus;
};

export type NewAppointment = {
  demoCallId: string | null;
  callerName: string;
  callerPhone: string;
  requestedService: string | null;
  requestedDoctor: string | null;
  preferredDate: string;
  preferredTime: string;
  notes: string | null;
  isSample?: boolean;
};

export type AppointmentKey = {
  callerPhone: string;
  requestedService: string | null;
  requestedDoctor: string | null;
  preferredDate: string;
  preferredTime: string;
};

export type NewEnquiry = {
  demoCallId: string | null;
  callerName: string | null;
  callerPhone: string | null;
  enquiryType: string;
  summary: string;
  followUpStatus?: FollowUpStatus;
  isSample?: boolean;
};

export interface Repository {
  readonly mode: "memory" | "supabase";
  createCall(input: CreateCallInput): Promise<{ call: DemoCall; token: string }>;
  getCall(id: string): Promise<DemoCall | null>;
  getCallForToken(id: string, token: string): Promise<DemoCall | null>;
  endCall(id: string, input: EndCallInput): Promise<DemoCall | null>;
  updateCaller(id: string, patch: { callerName?: string | null; callerPhone?: string | null; callReason?: string | null }): Promise<void>;
  listCalls(): Promise<DemoCall[]>;
  metrics(): Promise<Metrics>;
  createAppointment(input: NewAppointment): Promise<AppointmentRequest>;
  findDuplicateAppointment(callId: string, key: AppointmentKey): Promise<AppointmentRequest | null>;
  listAppointments(): Promise<AppointmentRequest[]>;
  listAppointmentsForCall(callId: string): Promise<AppointmentRequest[]>;
  updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<AppointmentRequest | null>;
  getSettings(): Promise<ClinicSettings>;
  updateSettings(input: ClinicSettings): Promise<ClinicSettings>;
  createEnquiry(input: NewEnquiry): Promise<Enquiry>;
  listEnquiries(): Promise<Enquiry[]>;
  listEnquiriesForCall(callId: string): Promise<Enquiry[]>;
  saveToolResult(input: { callId: string; openaiCallId: string; name: string; result: unknown }): Promise<void>;
  getToolResult(callId: string, openaiCallId: string): Promise<unknown | null>;
  markFollowUp(callId: string, reason: string): Promise<void>;
  resetDemo(): Promise<void>;
  insertSamples(): Promise<void>;
  applyRetention(now?: Date): Promise<void>;
}
