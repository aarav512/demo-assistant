export default function PrivacyPage() {
  return (
    <article className="stack">
      <header>
        <p className="page-kicker">Privacy</p>
        <h1>Privacy notice</h1>
      </header>
      <p>
        This is a sales demonstration of an AI receptionist. You are speaking with software in your browser. It is not a telephone
        call, and it is not a consultation with a clinician.
      </p>
      <p>
        Sunrise Family Clinic, its doctors, address, and opening hours are fictional. Do not share a real medical history, identity
        documents, or anyone else’s personal information.
      </p>
      <p>If you start a demo, the application can save:</p>
      <ul>
        <li>A short summary of the conversation.</li>
        <li>A name or phone number you choose to give, after you agree on the start screen.</li>
        <li>An appointment request or enquiry created during the demo.</li>
        <li>The written transcript, only if you tick the separate transcript option.</li>
      </ul>
      <p>Audio is not recorded or stored. The demo does not send SMS, WhatsApp, or email messages.</p>
      <p>
        Saved demo records are deleted by an administrator, or automatically after the retention period set in clinic settings.
        Contact details are not included in public pages. Reviewing them requires the demo admin password.
      </p>
      <p>
        This notice is not a legal certification. Before using the product with a real clinic, review the applicable Indian privacy
        requirements, consent language, retention rules, provider terms, and the clinic’s own policies.
      </p>
    </article>
  );
}
