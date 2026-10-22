"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/layout/admin-context";
import type { ClinicSettings } from "@/types/domain";

export function SettingsForm() {
  const admin = useAdmin();
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/clinic-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { settings?: ClinicSettings }) => setSettings(body.settings ?? null));
  }, []);

  if (!settings) return <p>Loading clinic settings…</p>;

  function update<K extends keyof ClinicSettings>(key: K, value: ClinicSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch("/api/clinic-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        }).then(async (response) => {
          const body = (await response.json()) as { settings?: ClinicSettings; error?: string };
          if (!response.ok) setMessage(body.error ?? "The clinic settings could not be saved.");
          else {
            setSettings(body.settings ?? settings);
            setMessage("Clinic settings saved for the next demo conversation.");
          }
        });
      }}
    >
      <p className="banner">
        <strong>Demonstration clinic. </strong>
        These details are fictional and are what the receptionist is allowed to say. They do not describe a real business.
      </p>
      <label className="field">
        Clinic name
        <input value={settings.clinicName} disabled={!admin.admin} onChange={(event) => update("clinicName", event.target.value)} />
      </label>
      <label className="field">
        Address
        <textarea value={settings.address} disabled={!admin.admin} onChange={(event) => update("address", event.target.value)} />
      </label>
      <fieldset className="stack" disabled={!admin.admin}>
        <legend>Opening hours</legend>
        {settings.openingHours.map((row, index) => (
          <div key={index} className="filters">
            <input
              aria-label={`Hours label ${index + 1}`}
              value={row.label}
              onChange={(event) => {
                const openingHours = settings.openingHours.slice();
                openingHours[index] = { ...row, label: event.target.value };
                update("openingHours", openingHours);
              }}
            />
            <input
              aria-label={`Hours ${index + 1}`}
              value={row.hours}
              onChange={(event) => {
                const openingHours = settings.openingHours.slice();
                openingHours[index] = { ...row, hours: event.target.value };
                update("openingHours", openingHours);
              }}
            />
          </div>
        ))}
      </fieldset>
      <label className="field">
        Services, one per line
        <textarea
          disabled={!admin.admin}
          value={settings.services.join("\n")}
          onChange={(event) => update("services", event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
        />
      </label>
      <fieldset className="stack" disabled={!admin.admin}>
        <legend>Doctors</legend>
        {settings.doctors.map((doctor, index) => (
          <div key={index} className="filters">
            <input
              aria-label={`Doctor ${index + 1}`}
              value={doctor.name}
              onChange={(event) => {
                const doctors = settings.doctors.slice();
                doctors[index] = { ...doctor, name: event.target.value };
                update("doctors", doctors);
              }}
            />
            <input
              aria-label={`Speciality ${index + 1}`}
              value={doctor.speciality}
              onChange={(event) => {
                const doctors = settings.doctors.slice();
                doctors[index] = { ...doctor, speciality: event.target.value };
                update("doctors", doctors);
              }}
            />
          </div>
        ))}
      </fieldset>
      <fieldset className="stack" disabled={!admin.admin}>
        <legend>Frequently asked questions</legend>
        {settings.faqs.map((faq, index) => (
          <div key={index} className="stack">
            <input
              aria-label={`Question ${index + 1}`}
              value={faq.question}
              onChange={(event) => {
                const faqs = settings.faqs.slice();
                faqs[index] = { ...faq, question: event.target.value };
                update("faqs", faqs);
              }}
            />
            <textarea
              aria-label={`Answer ${index + 1}`}
              value={faq.answer}
              onChange={(event) => {
                const faqs = settings.faqs.slice();
                faqs[index] = { ...faq, answer: event.target.value };
                update("faqs", faqs);
              }}
            />
          </div>
        ))}
      </fieldset>
      <label className="field">
        Appointment-request instructions
        <textarea
          disabled={!admin.admin}
          value={settings.appointmentInstructions}
          onChange={(event) => update("appointmentInstructions", event.target.value)}
        />
      </label>
      <label className="field">
        Escalation instructions
        <textarea
          disabled={!admin.admin}
          value={settings.escalationInstructions}
          onChange={(event) => update("escalationInstructions", event.target.value)}
        />
      </label>
      <label className="field">
        Keep demo records for this many days
        <input
          type="number"
          min={1}
          max={90}
          disabled={!admin.admin}
          value={settings.retentionDays}
          onChange={(event) => update("retentionDays", Number(event.target.value))}
        />
      </label>
      {message ? <p role="status">{message}</p> : null}
      <div className="actions">
        <button className="button primary" type="submit" disabled={!admin.admin}>
          Save clinic settings
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={!admin.admin}
          onClick={() => {
            void fetch("/api/admin/samples", { method: "POST" }).then(async (response) => {
              const body = (await response.json()) as { notice?: string; error?: string };
              setMessage(body.notice || body.error || "Sample records could not be added.");
            });
          }}
        >
          Add labelled sample records
        </button>
      </div>
      {!admin.admin ? <p className="meta">Sign in as the demo administrator to edit these settings.</p> : null}
    </form>
  );
}
