import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("database access", () => {
  it("locks the public tables and does not grant anonymous reads", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261022143000_init_receptionist.sql"), "utf8");
    for (const table of ["demo_calls", "appointment_requests", "clinic_settings", "demo_enquiries", "tool_invocations"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
    }
    expect(sql.toLowerCase()).not.toContain("create policy");
    expect(sql.toLowerCase()).not.toContain("using (true)");
  });
});
