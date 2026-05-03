import { useState, useEffect } from "react";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

const TOKEN_KEY = "iai_auth_token";
const USER_KEY = "iai_auth_user";

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const fetchMe = async (t: string): Promise<AuthUser | null> => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  };

  // Validate token on mount
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchMe(token).then((u) => {
      if (u) {
        setUser(u);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      } else {
        logout();
      }
      setLoading(false);
    });
  }, []);

  return { token, user, loading, login, logout };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
