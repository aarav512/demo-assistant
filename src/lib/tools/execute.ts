import { isTodayOrFuture } from "@/lib/utils/dates";
import { normalizePhone } from "@/lib/utils/phone";
import {
  appointmentRequestSchema,
  clinicInfoSchema,
  enquirySchema,
  followUpSchema,
  slotsSchema,
} from "@/lib/validation/schemas";
import { ALLOWED_TOOLS } from "@/lib/openai/tools";
import type { DemoCall } from "@/types/domain";
import type { Repository } from "@/lib/data/repository";

export async function executeTool(options: {
  store: Repository;
  call: DemoCall;
  name: string;
  arguments: unknown;
  openaiCallId: string;
  now?: Date;
}): Promise<{ output: unknown; duplicate: boolean }> {
  const cached = await options.store.getToolResult(options.call.id, options.openaiCallId);
  if (cached !== null) return { output: cached, duplicate: true };

  const output = await runTool(options);
  await options.store.saveToolResult({
    callId: options.call.id,
    openaiCallId: options.openaiCallId,
    name: options.name,
    result: output,
  });
  return { output, duplicate: false };
}

async function runTool(options: {
  store: Repository;
  call: DemoCall;
  name: string;
  arguments: unknown;
  now?: Date;
}): Promise<unknown> {
  if (!ALLOWED_TOOLS.has(options.name)) {
    return { error: "That action is not available." };
  }
  const args = asRecord(options.arguments);
  const settings = await options.store.getSettings();

  if (options.name === "get_clinic_information") {
    const parsed = clinicInfoSchema.safeParse(args);
    if (!parsed.success) return { error: "Say which clinic detail you need." };
    return clinicTopic(settings, parsed.data.topic);
  }

  if (options.name === "get_available_demo_slots") {
    const parsed = slotsSchema.safeParse(args);
    const date = parsed.success ? parsed.data.preferredDate : null;
    const past = date ? !isTodayOrFuture(date, options.now) : false;
    return {
      demonstration: true,
      calendarConnected: false,
      message: past
        ? "That date has already passed. Ask for today or a later date. No appointment was saved."
        : "No live calendar is connected. Do not invent open slots. The caller may request a time during opening hours, and reception will confirm it later.",
      openingHours: settings.openingHours,
      preferredDate: date,
    };
  }

  if (options.name === "create_appointment_request") {
    if (!options.call.callerConsent) {
      return { error: "Contact details cannot be saved because consent was not given." };
    }
    const parsed = appointmentRequestSchema.safeParse({
      ...args,
      detailsConfirmed: args.detailsConfirmed === true,
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Those appointment details could not be saved.",
        saved: false,
      };
    }
    const value = parsed.data;
    const duplicate = await options.store.findDuplicateAppointment(options.call.id, {
      callerPhone: value.callerPhone,
      requestedService: value.requestedService || null,
      requestedDoctor: value.requestedDoctor || null,
      preferredDate: value.preferredDate,
      preferredTime: value.preferredTime,
    });
    if (duplicate) {
      return {
        saved: true,
        duplicate: true,
        status: duplicate.status,
        message: "This request was already saved. It is not a confirmed booking.",
        appointmentId: duplicate.id,
      };
    }
    const appointment = await options.store.createAppointment({
      demoCallId: options.call.id,
      callerName: value.callerName,
      callerPhone: value.callerPhone,
      requestedService: value.requestedService || null,
      requestedDoctor: value.requestedDoctor || null,
      preferredDate: value.preferredDate,
      preferredTime: value.preferredTime,
      notes: value.notes || null,
    });
    await options.store.updateCaller(options.call.id, {
      callerName: value.callerName,
      callerPhone: value.callerPhone,
      callReason: `Appointment request for ${value.requestedDoctor || value.requestedService}`,
    });
    return {
      saved: true,
      duplicate: false,
      status: "new",
      appointmentId: appointment.id,
      message: "The request was saved for the reception team. It is not confirmed, and no message was sent.",
    };
  }

  if (options.name === "capture_caller_enquiry") {
    const parsed = enquirySchema.safeParse(args);
    if (!parsed.success) return { error: "The enquiry could not be saved.", saved: false };
    let phone: string | null = null;
    if (parsed.data.callerPhone) {
      if (!options.call.callerConsent || !parsed.data.contactConfirmed) {
        return { error: "A phone number can be saved only after the caller agrees.", saved: false };
      }
      phone = normalizePhone(parsed.data.callerPhone);
      if (!phone) return { error: "That phone number could not be used. Ask for a 10-digit Indian mobile number.", saved: false };
    }
    const enquiry = await options.store.createEnquiry({
      demoCallId: options.call.id,
      callerName: parsed.data.callerName || null,
      callerPhone: phone,
      enquiryType: parsed.data.enquiryType,
      summary: parsed.data.summary,
    });
    await options.store.updateCaller(options.call.id, {
      callerName: parsed.data.callerName,
      callerPhone: phone,
      callReason: parsed.data.enquiryType,
    });
    return { saved: true, enquiryId: enquiry.id, message: "The enquiry was saved for follow-up. No message was sent." };
  }

  if (options.name === "request_human_follow_up") {
    const parsed = followUpSchema.safeParse(args);
    if (!parsed.success) return { error: "The follow-up could not be recorded." };
    await options.store.markFollowUp(options.call.id, parsed.data.reason);
    await options.store.createEnquiry({
      demoCallId: options.call.id,
      callerName: options.call.callerName,
      callerPhone: options.call.callerPhone,
      enquiryType: "Human follow-up",
      summary: parsed.data.reason,
      followUpStatus: "needed",
    });
    return {
      recorded: true,
      urgency: parsed.data.urgency,
      escalation: settings.escalationInstructions,
      message:
        parsed.data.urgency === "urgent"
          ? "Tell the caller to contact local emergency services or the nearest hospital if they may need urgent care. Do not give medical advice. A human follow-up was flagged for this demo."
          : "A human follow-up was flagged. Do not claim that someone has already been contacted.",
    };
  }

  return { error: "That action is not available." };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clinicTopic(settings: Awaited<ReturnType<Repository["getSettings"]>>, topic: string) {
  const base = { demonstration: true, clinicName: settings.clinicName };
  if (topic === "hours") return { ...base, openingHours: settings.openingHours };
  if (topic === "location") return { ...base, address: settings.address };
  if (topic === "services") return { ...base, services: settings.services };
  if (topic === "doctors") return { ...base, doctors: settings.doctors };
  if (topic === "faqs") return { ...base, faqs: settings.faqs };
  if (topic === "instructions") {
    return {
      ...base,
      appointmentInstructions: settings.appointmentInstructions,
      escalationInstructions: settings.escalationInstructions,
    };
  }
  return {
    ...base,
    address: settings.address,
    openingHours: settings.openingHours,
    services: settings.services,
    doctors: settings.doctors,
    faqs: settings.faqs,
    appointmentInstructions: settings.appointmentInstructions,
    escalationInstructions: settings.escalationInstructions,
  };
}
