import type { AppointmentRequest, CallSummary, DemoCall, Enquiry, TranscriptLine } from "@/types/domain";

export function buildCallSummary(input: {
  call: DemoCall;
  appointments: AppointmentRequest[];
  enquiries: Enquiry[];
  outcome: DemoCall["outcome"];
  failureReason?: string | null;
}): CallSummary {
  const appointment = input.appointments[0] ?? null;
  const callerName = input.call.callerName ?? appointment?.callerName ?? input.enquiries.find((item) => item.callerName)?.callerName ?? null;
  const questions = input.enquiries.map((item) => item.summary).slice(0, 6);
  const human = input.call.humanFollowUp || input.enquiries.some((item) => item.followUpStatus === "needed");
  const reason =
    input.call.callReason ??
    (appointment
      ? `Appointment request for ${appointment.requestedDoctor || appointment.requestedService}`
      : input.enquiries[0]?.enquiryType) ??
    "General enquiry";

  let followUp = "No follow-up was requested.";
  if (human) followUp = "A person from reception should follow up. This demo did not contact anyone.";
  else if (appointment) followUp = "The reception team can review the appointment request. It is not confirmed.";

  let narrative = `${reason}.`;
  if (questions.length) narrative += ` Topics noted: ${questions.join(" ")}`;
  if (appointment) {
    narrative += ` An appointment request was saved for ${appointment.preferredDate} at ${appointment.preferredTime}. It is not a confirmed booking.`;
  }
  if (input.outcome === "failed") {
    narrative = input.failureReason
      ? `The demo ended before a normal summary could be completed. ${input.failureReason}`
      : "The demo ended before a normal summary could be completed.";
  }
  if (input.outcome === "abandoned" && !appointment && questions.length === 0) {
    narrative = "The demo ended before any enquiry or appointment request was captured.";
  }

  return {
    reason,
    questionsAnswered: questions,
    callerName,
    callerPhoneStored: Boolean(input.call.callerPhone || appointment?.callerPhone),
    requestedService: appointment?.requestedService ?? null,
    requestedDoctor: appointment?.requestedDoctor ?? null,
    appointmentRequested: Boolean(appointment),
    followUpAction: followUp,
    humanAssistanceNeeded: human,
    narrative,
  };
}

export function limitTranscript(lines: TranscriptLine[] | undefined, allowed: boolean): TranscriptLine[] | null {
  if (!allowed || !lines?.length) return null;
  return lines.slice(0, 200).map((line) => ({
    role: line.role,
    text: line.text.slice(0, 2000),
    at: line.at,
  }));
}
