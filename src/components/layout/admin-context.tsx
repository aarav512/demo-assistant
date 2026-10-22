"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AdminState = {
  admin: boolean;
  configured: boolean;
  ready: boolean;
  refresh: () => Promise<void>;
  login: (password: string) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    const data = (await response.json()) as { admin?: boolean; configured?: boolean };
    setAdmin(Boolean(data.admin));
    setConfigured(Boolean(data.configured));
    setReady(true);
  }, []);

  useEffect(() => {
    // The session cookie is read from the server after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) return data.error ?? "Sign-in failed.";
    await refresh();
    return null;
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ admin, configured, ready, refresh, login, logout }),
    [admin, configured, ready, refresh, login, logout],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminState {
  const value = useContext(AdminContext);
  if (!value) throw new Error("AdminProvider is missing.");
  return value;
}
