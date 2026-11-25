import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axios from "axios";
import api, { setAccessToken } from "../api/client.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

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
    (async () => {
      try {
        const { data } = await axios.post("/api/v1/auth/refresh", null, { withCredentials: true });
        setAccessToken(data.access);
        await loadMe();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}
