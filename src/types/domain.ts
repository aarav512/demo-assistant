export type TranscriptLine = {
  role: "caller" | "receptionist";
  text: string;
  at: string;
};

export type CallOutcome = "in_progress" | "completed" | "failed" | "abandoned";
export type FollowUpStatus = "none" | "needed" | "completed";
export type AppointmentStatus = "new" | "pending_confirmation" | "confirmed" | "cancelled";

export type CallSummary = {
  reason: string;
  questionsAnswered: string[];
  callerName: string | null;
  callerPhoneStored: boolean;
  requestedService: string | null;
  requestedDoctor: string | null;
  appointmentRequested: boolean;
  followUpAction: string;
  humanAssistanceNeeded: boolean;
  narrative: string;
};

export type DemoCall = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  callerName: string | null;
  callerPhone: string | null;
  callerConsent: boolean;
  storeTranscript: boolean;
  callReason: string | null;
  summary: string | null;
  summaryDetail: CallSummary | null;
  outcome: CallOutcome;
  transcript: TranscriptLine[] | null;
  humanFollowUp: boolean;
  followUpStatus: FollowUpStatus;
  failureReason: string | null;
  isSample: boolean;
  createdAt: string;
};

export type AppointmentRequest = {
  id: string;
  demoCallId: string | null;
  callerName: string;
  callerPhone: string;
  requestedService: string | null;
  requestedDoctor: string | null;
  preferredDate: string;
  preferredTime: string;
  notes: string | null;
  status: AppointmentStatus;
  isSample: boolean;
  createdAt: string;
};

export type Enquiry = {
  id: string;
  demoCallId: string | null;
  callerName: string | null;
  callerPhone: string | null;
  enquiryType: string;
  summary: string;
  followUpStatus: FollowUpStatus;
  isSample: boolean;
  createdAt: string;
};

export type OpeningHours = {
  label: string;
  hours: string;
};

export type Doctor = {
  name: string;
  speciality: string;
};

export type Faq = {
  question: string;
  answer: string;
};

export type ClinicSettings = {
  clinicName: string;
  address: string;
  openingHours: OpeningHours[];
  services: string[];
  doctors: Doctor[];
  faqs: Faq[];
  appointmentInstructions: string;
  escalationInstructions: string;
  retentionDays: number;
  updatedAt: string;
};

export type Metrics = {
  callsCompleted: number;
  enquiriesCaptured: number;
  appointmentRequests: number;
  callsNeedingFollowUp: number;
};

export type VoiceStatus =
  | "ready"
  | "connecting"
  | "listening"
  | "speaking"
  | "processing"
  | "disconnected";
