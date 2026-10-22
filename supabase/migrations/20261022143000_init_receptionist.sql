-- Demonstration schema for the Kynex Code AI receptionist.
-- The clinic is fictional. These tables store demo calls, not medical records.
-- Apply in the Supabase SQL editor, or with: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.clinic_settings (
  id integer primary key default 1,
  clinic_name text not null,
  address text not null,
  opening_hours jsonb not null,
  services jsonb not null,
  doctors jsonb not null,
  faqs jsonb not null,
  appointment_instructions text not null,
  escalation_instructions text not null,
  retention_days integer not null default 14,
  updated_at timestamptz not null default now(),
  constraint clinic_settings_singleton check (id = 1),
  constraint clinic_settings_retention check (retention_days between 1 and 90)
);

create table if not exists public.demo_calls (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  caller_name text,
  caller_phone text,
  caller_consent boolean not null default false,
  store_transcript boolean not null default false,
  call_reason text,
  summary text,
  summary_detail jsonb,
  outcome text not null default 'in_progress',
  transcript jsonb,
  human_follow_up boolean not null default false,
  follow_up_status text not null default 'none',
  failure_reason text,
  is_sample boolean not null default false,
  access_token_hash text not null,
  created_at timestamptz not null default now(),
  constraint demo_calls_outcome check (outcome in ('in_progress', 'completed', 'failed', 'abandoned')),
  constraint demo_calls_follow_up check (follow_up_status in ('none', 'needed', 'completed'))
);

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  demo_call_id uuid references public.demo_calls (id) on delete cascade,
  caller_name text not null,
  caller_phone text not null,
  requested_service text,
  requested_doctor text,
  preferred_date date not null,
  preferred_time text not null,
  notes text,
  status text not null default 'new',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint appointment_status check (status in ('new', 'pending_confirmation', 'confirmed', 'cancelled')),
  constraint appointment_has_subject check (requested_service is not null or requested_doctor is not null)
);

create table if not exists public.demo_enquiries (
  id uuid primary key default gen_random_uuid(),
  demo_call_id uuid references public.demo_calls (id) on delete cascade,
  caller_name text,
  caller_phone text,
  enquiry_type text not null,
  summary text not null,
  follow_up_status text not null default 'none',
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint enquiry_follow_up check (follow_up_status in ('none', 'needed', 'completed'))
);

create table if not exists public.tool_invocations (
  id uuid primary key default gen_random_uuid(),
  demo_call_id uuid not null references public.demo_calls (id) on delete cascade,
  openai_call_id text not null,
  tool_name text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint tool_invocations_once unique (demo_call_id, openai_call_id)
);

create index if not exists demo_calls_created_idx on public.demo_calls (created_at desc);
create index if not exists appointments_created_idx on public.appointment_requests (created_at desc);
create index if not exists appointments_call_idx on public.appointment_requests (demo_call_id);
create index if not exists enquiries_call_idx on public.demo_enquiries (demo_call_id);

alter table public.clinic_settings enable row level security;
alter table public.demo_calls enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.demo_enquiries enable row level security;
alter table public.tool_invocations enable row level security;

revoke all on table public.clinic_settings from anon, authenticated;
revoke all on table public.demo_calls from anon, authenticated;
revoke all on table public.appointment_requests from anon, authenticated;
revoke all on table public.demo_enquiries from anon, authenticated;
revoke all on table public.tool_invocations from anon, authenticated;

-- No policies are created. The anon and authenticated roles cannot read or write
-- these tables through the Data API. The server uses the service role, which bypasses RLS.

insert into public.clinic_settings (
  id, clinic_name, address, opening_hours, services, doctors, faqs,
  appointment_instructions, escalation_instructions, retention_days
) values (
  1,
  'Sunrise Family Clinic',
  'Demonstration site, 14 Lakeview Road, Indiranagar, Bengaluru 560038. This address is fictional.',
  '[{"label":"Monday to Saturday","hours":"9:00 AM – 7:00 PM"},{"label":"Sunday","hours":"Closed"}]'::jsonb,
  '["General consultation","Paediatrics","Dermatology","Vaccination enquiry","Lab report collection"]'::jsonb,
  '[{"name":"Dr. Ananya Rao","speciality":"General Physician"},{"name":"Dr. Vikram Shah","speciality":"Paediatrics"},{"name":"Dr. Meera Iyer","speciality":"Dermatology"}]'::jsonb,
  '[{"question":"What time does the clinic close?","answer":"The demonstration clinic closes at 7 PM, Monday to Saturday. It is closed on Sunday."},{"question":"Do you offer general consultations?","answer":"Yes. In this demonstration, Dr. Ananya Rao sees patients for general consultations."},{"question":"Where is the clinic?","answer":"The fictional clinic is listed at 14 Lakeview Road, Indiranagar, Bengaluru. It is not a real clinic."}]'::jsonb,
  'Appointment requests are demonstration records only. Tell the caller a receptionist will confirm the request later. Do not promise that a specific slot is reserved.',
  'If a caller needs a person, say the demo reception team will follow up during clinic hours. This demo does not page a doctor. For urgent symptoms, direct the caller to local emergency services or the nearest hospital before any other step.',
  14
) on conflict (id) do nothing;

comment on table public.demo_calls is 'Browser demo calls for a fictional clinic. Not real patient records.';
comment on table public.appointment_requests is 'Unconfirmed demonstration appointment requests.';
