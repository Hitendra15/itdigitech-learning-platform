
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import api, { setAccessToken } from "../api/client.js";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load currently authenticated user.
  const loadMe = useCallback(async () => {
    const { data } = await api.get("/me");

    setUser(data);

    return data;
  }, []);

  // Restore session when application loads.
  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        // IMPORTANT:
        // Use the configured Axios instance.
        // Do not use plain axios.post() with a relative URL.
        const { data } = await api.post("/auth/refresh", null);

        if (!data?.access) {
          throw new Error("Refresh response does not contain an access token");
        }

        // Save new access token in memory.
        setAccessToken(data.access);

        // Load authenticated user.
        await loadMe();

      } catch (error) {
        setAccessToken(null);

        if (active) {
          setUser(null);
        }

      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    // Listen for authentication logout events.
    const handleLogout = () => {
      setAccessToken(null);
      setUser(null);
    };

    window.addEventListener("auth:logout", handleLogout);

    return () => {
      active = false;

      window.removeEventListener(
        "auth:logout",
        handleLogout
      );
    };
  }, [loadMe]);

  // Handle successful login and registration.
  const handleAuth = ({ access, user }) => {
    setAccessToken(access);
    setUser(user);

    return user;
  };

  // Login.
  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    return handleAuth(data);
  };

  // Register.
  const register = async (form) => {
    const { data } = await api.post("/auth/register", form);

    return handleAuth(data);
  };

  // Logout.
  const logout = async () => {
    try {
      await api.post("/auth/logout");

    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser: loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
