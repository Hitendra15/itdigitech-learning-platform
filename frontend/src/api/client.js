import axios from "axios";

// Access token lives in memory only. The refresh token is an httpOnly cookie
// the browser sends automatically to /api/v1/auth/refresh.
let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };

const api = axios.create({ baseURL: "/api/v1", withCredentials: true });

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing = null; // share one refresh call between parallel 401s

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    // Only the credential-less endpoints skip silent refresh; other /auth/* calls need a valid session.
    const PUBLIC = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];
    const isAuthCall = PUBLIC.some((u) => original?.url?.startsWith(u));
    if (err.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ??= axios
        .post("/api/v1/auth/refresh", null, { withCredentials: true })
        .finally(() => { refreshing = null; });
      try {
        const { data } = await refreshing;
        setAccessToken(data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new Event("auth:logout"));
      }
    }
    return Promise.reject(err);
  }
);

export const errorMessage = (err, fallback = "Something went wrong. Try again.") => {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === "string") return fallback;
  if (d.detail) return d.detail;
  const first = Object.values(d)[0];
  return Array.isArray(first) ? first[0] : String(first ?? fallback);
};

// Field-level errors from DRF: { field: ["msg"] } -> { field: "msg" }
export const fieldErrors = (err) => {
  const d = err?.response?.data;
  if (!d || typeof d !== "object") return {};
  return Object.fromEntries(
    Object.entries(d).filter(([k]) => k !== "detail").map(([k, v]) => [k, Array.isArray(v) ? v[0] : typeof v === "string" ? v : "Invalid value"])
  );
};

export const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
export const fmtDate = (d, withTime = false) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) }) : "-";
export const timeAgo = (d) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); if (days < 7) return `${days} d ago`;
  return fmtDate(d);
};

export default api;
