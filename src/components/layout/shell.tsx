"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { AdminProvider, useAdmin } from "@/components/layout/admin-context";

const LINKS = [
  { href: "/", label: "Demo" },
  { href: "/calls", label: "Calls" },
  { href: "/appointments", label: "Appointments" },
  { href: "/settings", label: "Clinic" },
  { href: "/privacy", label: "Privacy" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="shell">
        <a className="skip" href="#content">
          Skip to content
        </a>
        <header className="topbar">
          <Link href="/" aria-label="Kynex Code home">
            <BrandMark />
          </Link>
          <nav className="nav" aria-label="Primary">
            <NavLinks />
          </nav>
          <AdminControl />
        </header>
        <main id="content" className="main">
          {children}
        </main>
        <footer className="footer">AI Receptionist Demo · Built by Kynex Code</footer>
      </div>
    </AdminProvider>
  );
}

function NavLinks() {
  const pathname = usePathname();
  return LINKS.map((link) => (
    <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
      {link.label}
    </Link>
  ));
}

function AdminControl() {
  const admin = useAdmin();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!admin.ready) return <span className="meta">Checking access…</span>;
  if (admin.admin) {
    return (
      <button className="button secondary" type="button" onClick={() => void admin.logout()}>
        Sign out
      </button>
    );
  }

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>
        Demo admin
      </button>
      {open ? (
        <dialog open aria-labelledby="admin-title">
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void admin.login(password).then((message) => {
                if (message) setError(message);
                else {
                  setPassword("");
                  setError(null);
                  setOpen(false);
                }
              });
            }}
          >
            <h2 id="admin-title">Demo admin</h2>
            <p className="meta">
              {admin.configured
                ? "Sign in to review caller details, confirm requests, and edit the fictional clinic."
                : "Set DEMO_ADMIN_PASSWORD and SESSION_SECRET on the server before sign-in will work."}
            </p>
            <label className="field">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <div className="actions">
              <button className="button primary" type="submit" disabled={!admin.configured}>
                Sign in
              </button>
              <button className="button secondary" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  );
}
