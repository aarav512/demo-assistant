export const REALTIME_TOOLS = [
  {
    type: "function",
    name: "get_clinic_information",
    description: "Read the fictional clinic's configured hours, location, services, doctors, FAQs, or instructions.",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["hours", "location", "services", "doctors", "faqs", "instructions", "all"],
          description: "Which configured fact to read.",
        },
      },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_available_demo_slots",
    description:
      "Explain that this demo has no live calendar. Returns opening hours and a clear notice that no slot is reserved. Never invent open slots.",
    parameters: {
      type: "object",
      properties: {
        preferredDate: { type: "string", description: "Preferred date in YYYY-MM-DD format, if the caller mentioned one." },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "create_appointment_request",
    description:
      "Save an appointment request after the caller confirms the details. This does not confirm a booking or send a message.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string" },
        callerPhone: { type: "string", description: "Indian mobile number." },
        requestedService: { type: "string" },
        requestedDoctor: { type: "string" },
        preferredDate: { type: "string", description: "YYYY-MM-DD. Today or a future date in India." },
        preferredTime: { type: "string" },
        notes: { type: "string", description: "Short administrative note. Do not store a medical history." },
        detailsConfirmed: { type: "boolean", description: "True only after the caller confirms the repeated details." },
      },
      required: ["callerName", "callerPhone", "preferredDate", "preferredTime", "detailsConfirmed"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "capture_caller_enquiry",
    description: "Save a non-booking enquiry or callback request.",
    parameters: {
      type: "object",
      properties: {
        callerName: { type: "string" },
        callerPhone: { type: "string" },
        enquiryType: { type: "string" },
        summary: { type: "string" },
        contactConfirmed: { type: "boolean" },
      },
      required: ["enquiryType", "summary"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "request_human_follow_up",
    description: "Mark the demo call as needing a human receptionist. Use this for complaints, uncertainty, and urgent situations.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
        urgency: { type: "string", enum: ["routine", "soon", "urgent"] },
      },
      required: ["reason", "urgency"],
      additionalProperties: false,
    },
  },
] as const;

export const ALLOWED_TOOLS = new Set<string>(REALTIME_TOOLS.map((tool) => tool.name));

export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";

export function realtimeModel(): string {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
}
