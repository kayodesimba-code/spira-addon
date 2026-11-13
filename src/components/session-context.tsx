"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import type { AppRole } from "@/lib/domain/roles";

export type ClientSession = {
  sub: string;
  email: string | null;
  role: AppRole;
  superadmin: boolean;
};

const SessionContext = createContext<ClientSession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api<ClientSession>("/api/auth/me")
      .then((me) => {
        if (!cancelled) setSession(me);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): ClientSession | null {
  return useContext(SessionContext);
}

export function useIsSuperadmin(): boolean {
  return useSession()?.superadmin === true;
}
