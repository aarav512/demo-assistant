import { afterEach, describe, expect, it } from "vitest";
import { adminCookieHeader, isAdminRequest, passwordsMatch, signAdminToken } from "@/lib/auth/admin";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("demo admin access", () => {
  it("rejects a missing or wrong password", () => {
    process.env.DEMO_ADMIN_PASSWORD = "AI-ASSISTANT";
    process.env.SESSION_SECRET = "session-secret-value";
    expect(passwordsMatch("wrong", "correct-horse")).toBe(false);
    const request = new Request("http://localhost/api/calls");
    expect(isAdminRequest(request)).toBe(false);
  });

  it("accepts a signed admin cookie and rejects a tampered one", () => {
    process.env.DEMO_ADMIN_PASSWORD = "correct-horse";
    process.env.SESSION_SECRET = "session-secret-value";
    const token = signAdminToken();
    expect(token).toBeTruthy();
    const header = adminCookieHeader(token ?? "");
    const cookie = header.split(";")[0] ?? "";
    const allowed = new Request("http://localhost/api/calls", { headers: { cookie } });
    expect(isAdminRequest(allowed)).toBe(true);
    const tampered = new Request("http://localhost/api/calls", { headers: { cookie: "kynex_demo_admin=not-the-token" } });
    expect(isAdminRequest(tampered)).toBe(false);
  });

  it("stays closed when admin access is not configured", () => {
    delete process.env.DEMO_ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
    expect(signAdminToken()).toBeNull();
    expect(isAdminRequest(new Request("http://localhost/api/calls"))).toBe(false);
  });
});
