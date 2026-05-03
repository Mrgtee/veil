// Simple in-memory auth/session stub.
// Replace with real wallet connect / OAuth / JWT later.

import { useEffect, useState } from "react";

const KEY = "veil.session";

export interface VeilSession {
  address: string;
  label: string;
}

export function useVeilSession() {
  const [session, setSession] = useState<VeilSession | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as VeilSession) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  }, [session]);

  return {
    session,
    signIn: (s: VeilSession) => setSession(s),
    signOut: () => setSession(null),
  };
}
