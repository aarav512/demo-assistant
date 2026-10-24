import { CLINIC_TIME_ZONE } from "@/lib/clinic/default-clinic";

export function formatWhen(iso: string | null): string {
  if (!iso) return "In progress";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "In progress";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes === 0 ? `${rest}s` : `${minutes}m ${rest}s`;
}

export const STATUS_LABEL = {
  ready: "Ready",
  connecting: "Connecting",
  listening: "Listening",
  speaking: "Speaking",
  processing: "Thinking",
  disconnected: "Disconnected",
} as const;

export const APPOINTMENT_LABEL = {
  new: "New",
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
} as const;
