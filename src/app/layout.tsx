import type { Metadata } from "next";
import { Shell } from "@/components/layout/shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Clinic Receptionist · Kynex Code",
  description: "Interactive browser demo of an AI receptionist for a fictional clinic.",
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
