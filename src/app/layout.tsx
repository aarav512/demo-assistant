import type { Metadata } from "next";
import { Shell } from "@/components/layout/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kynex Code · AI Calling Assistant",
  description: "Try Sunrise Family Clinic’s voice assistant in the browser. Appointment requests are not confirmed bookings.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
