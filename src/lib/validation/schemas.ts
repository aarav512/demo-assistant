import { z } from "zod";
import { isTodayOrFuture } from "@/lib/utils/dates";
import { normalizePhone } from "@/lib/utils/phone";

export const appointmentStatuses = ["new", "pending_confirmation", "confirmed", "cancelled"] as const;

const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .superRefine((value, ctx) => {
    if (!normalizePhone(value)) {
      ctx.addIssue({ code: "custom", message: "Enter an Indian mobile number." });
    }
  })
  .transform((value) => normalizePhone(value) ?? value);

export function createAppointmentRequestSchema(now?: Date) {
  return z
    .object({
      callerName: z.string().trim().min(2, "A caller name is required.").max(80),
      callerPhone: phoneSchema,
      requestedService: z.string().trim().max(80).optional().nullable(),
      requestedDoctor: z.string().trim().max(80).optional().nullable(),
      preferredDate: z.string().trim(),
      preferredTime: z.string().trim().min(1, "A preferred time is required.").max(40),
      notes: z.string().trim().max(400).optional().nullable(),
      detailsConfirmed: z.boolean().refine((value) => value === true, {
        message: "The caller must confirm the details before they are saved.",
      }),
    })
    .superRefine((value, ctx) => {
      if (!value.requestedService && !value.requestedDoctor) {
        ctx.addIssue({
          code: "custom",
          path: ["requestedService"],
          message: "A service or a doctor is required.",
        });
      }
      if (!isTodayOrFuture(value.preferredDate, now)) {
        ctx.addIssue({
          code: "custom",
          path: ["preferredDate"],
          message: "The preferred date must be today or a future date.",
        });
      }
    });
}

export const appointmentRequestSchema = createAppointmentRequestSchema();

export const appointmentStatusSchema = z.object({
  status: z.enum(appointmentStatuses),
});

export const enquirySchema = z.object({
  callerName: z.string().trim().min(2).max(80).optional().nullable(),
  callerPhone: z.string().trim().max(20).optional().nullable(),
  enquiryType: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(2).max(500),
  contactConfirmed: z.boolean().optional().default(false),
});

export const followUpSchema = z.object({
  reason: z.string().trim().min(2).max(300),
  urgency: z.enum(["routine", "soon", "urgent"]),
});

export const clinicInfoSchema = z.object({
  topic: z.enum(["hours", "location", "services", "doctors", "faqs", "instructions", "all"]).default("all"),
});

export const slotsSchema = z.object({
  preferredDate: z.string().trim().optional().nullable(),
});

const textBlock = z.string().trim().min(2).max(500);

export const clinicSettingsSchema = z.object({
  clinicName: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(240),
  openingHours: z.array(z.object({ label: textBlock.max(40), hours: textBlock.max(80) })).min(1).max(14),
  services: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  doctors: z
    .array(z.object({ name: z.string().trim().min(2).max(80), speciality: z.string().trim().min(2).max(80) }))
    .min(1)
    .max(20),
  faqs: z
    .array(z.object({ question: z.string().trim().min(2).max(160), answer: z.string().trim().min(2).max(400) }))
    .min(1)
    .max(20),
  appointmentInstructions: z.string().trim().min(8).max(600),
  escalationInstructions: z.string().trim().min(8).max(600),
  retentionDays: z.number().int().min(1).max(90),
});

export const endCallSchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.enum(["caller", "receptionist"]),
        text: z.string().trim().min(1).max(2000),
        at: z.string().max(40).optional(),
      }),
    )
    .max(200)
    .optional(),
  outcome: z.enum(["completed", "failed", "abandoned"]).optional(),
  failureReason: z.string().trim().max(240).optional(),
});

export const voiceSessionSchema = z.object({
  sdp: z.string().trim().min(8).max(100_000),
  consent: z.boolean().refine((value) => value === true, {
    message: "Consent is required before a demo can start.",
  }),
  storeTranscript: z.boolean().optional().default(false),
});

export const toolRequestSchema = z.object({
  callId: z.string().uuid(),
  callToken: z.string().trim().min(20).max(200),
  openaiCallId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  arguments: z.unknown(),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export const resetSchema = z.object({
  confirm: z.string().refine((value) => value === "RESET DEMO", { message: "Confirmation is required." }),
});

export function fieldErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => issue.message);
}
