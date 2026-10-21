import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import api, { setAccessToken } from "../api/client.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

let bootstrap = null; // one refresh per page load, even if React mounts twice in dev

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const { data } = await api.get("/me");
    setUser(data);
    return data;
  }, []);

  // Restore the session on page load using the refresh cookie.
  useEffect(() => {
    bootstrap ??= axios.post("/api/v1/auth/refresh", null, { withCredentials: true }).then((r) => r.data.access);
    let alive = true;
    bootstrap
      .then(async (access) => { setAccessToken(access); const me = await loadMe(); if (!alive) return me; })
      .catch(() => { bootstrap = null; if (alive) setUser(null); })
      .finally(() => { if (alive) setLoading(false); });
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => { alive = false; window.removeEventListener("auth:logout", onLogout); };
  }, [loadMe]);

  const handleAuth = ({ access, user }) => {
    setAccessToken(access);
    setUser(user);
    return user;
  };

  const login = async (email, password) =>
    handleAuth((await api.post("/auth/login", { email, password })).data);

  const register = async (form) =>
    handleAuth((await api.post("/auth/register", form)).data);

  const logout = async () => {
    try { await api.post("/auth/logout"); } finally {
      setAccessToken(null);
      setUser(null);
      bootstrap = null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}
