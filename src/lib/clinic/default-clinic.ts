import type { ClinicSettings } from "@/types/domain";

export const CLINIC_TIME_ZONE = "Asia/Kolkata";

export const DEFAULT_CLINIC: ClinicSettings = {
  clinicName: "Sunrise Family Clinic",
  address:
    "Demonstration site, 14 Lakeview Road, Indiranagar, Bengaluru 560038. This address is fictional.",
  openingHours: [
    { label: "Monday to Saturday", hours: "9:00 AM – 7:00 PM" },
    { label: "Sunday", hours: "Closed" },
  ],
  services: [
    "General consultation",
    "Paediatrics",
    "Dermatology",
    "Vaccination enquiry",
    "Lab report collection",
  ],
  doctors: [
    { name: "Dr. Ananya Rao", speciality: "General Physician" },
    { name: "Dr. Vikram Shah", speciality: "Paediatrics" },
    { name: "Dr. Meera Iyer", speciality: "Dermatology" },
  ],
  faqs: [
    {
      question: "What time does the clinic close?",
      answer:
        "The demonstration clinic closes at 7 PM, Monday to Saturday. It is closed on Sunday.",
    },
    {
      question: "Do you offer general consultations?",
      answer:
        "Yes. In this demonstration, Dr. Ananya Rao sees patients for general consultations.",
    },
    {
      question: "Where is the clinic?",
      answer:
        "The fictional clinic is listed at 14 Lakeview Road, Indiranagar, Bengaluru. It is not a real clinic.",
    },
  ],
  appointmentInstructions:
    "Appointment requests are demonstration records only. Tell the caller a receptionist will confirm the request later. Do not promise that a specific slot is reserved.",
  escalationInstructions:
    "If a caller needs a person, say the demo reception team will follow up during clinic hours. This demo does not page a doctor. For urgent symptoms, direct the caller to local emergency services or the nearest hospital before any other step.",
  retentionDays: 14,
  updatedAt: "2026-10-22T00:00:00.000Z",
};

export const SUGGESTED_PROMPTS = [
  "What time does the clinic close?",
  "Do you offer general consultations?",
  "I'd like to request an appointment tomorrow.",
  "Can someone from reception call me back?",
] as const;
