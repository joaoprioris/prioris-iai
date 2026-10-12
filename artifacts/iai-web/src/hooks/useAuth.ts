import { useState, useEffect } from "react";
export interface AuthUser { id: string; email: string; role: string; organizationId: string; organizationName: string; }
const TOKEN_KEY = "iai_auth_token";
const USER_KEY = "iai_auth_user";
const MARKER = "cookie";
function clearStoredUser() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const login = (_newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, MARKER); localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(MARKER); setUser(newUser); setLoading(false);
  };
  const logout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!res.ok) { window.alert("Não foi possível encerrar sua sessão. Tente novamente."); return false; }
      clearStoredUser(); setToken(null); setUser(null); return true;
    } catch { window.alert("Não foi possível encerrar sua sessão. Verifique sua conexão e tente novamente."); return false; }
  };
  useEffect(() => {
    let cancelled = false;
    clearStoredUser();
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? new URLSearchParams(window.location.search).get("token");
    if (incoming) { setLoading(false); return; }
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" }).then(async res => {
      if (!res.ok) return null;
      const candidate = await res.json();
      return candidate && ["id", "email", "role", "organizationId", "organizationName"].every(key => typeof candidate[key] === "string") ? candidate as AuthUser : null;
    }).then(candidate => {
      if (cancelled) return;
      if (candidate) login(MARKER, candidate); else { setToken(null); setUser(null); }
      setLoading(false);
    }).catch(() => { if (!cancelled) { setToken(null); setUser(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);
  return { token, user, loading, login, logout };
}
export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) === MARKER ? MARKER : null; }
