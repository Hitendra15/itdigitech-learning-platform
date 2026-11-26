
import axios from "axios";

// Access token stays in memory.
// Refresh token is stored in an HttpOnly cookie.
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

// Read API URL from Vercel environment variables.
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not configured");
}

console.log("API BASE URL:", API_BASE_URL);

// Main Axios instance.
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach access token to every authenticated request.
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Share one refresh request between parallel 401 responses.
let refreshing = null;

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const original = error.config;

    if (!original) {
      return Promise.reject(error);
    }

    // Endpoints that must not trigger automatic token refresh.
    const PUBLIC_ENDPOINTS = [
      "/auth/login",
      "/auth/register",
      "/auth/refresh",
      "/auth/logout",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-email",
    ];

    const isAuthCall = PUBLIC_ENDPOINTS.some((endpoint) =>
      original.url?.startsWith(endpoint)
    );

    // Refresh only when an authenticated request returns 401.
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthCall
    ) {
      original._retry = true;

      try {
        // Create one shared refresh request.
        refreshing ??= axios
          .post(
            `${API_BASE_URL}/auth/refresh`,
            null,
            {
              withCredentials: true,
            }
          )
          .finally(() => {
            refreshing = null;
          });

        const { data } = await refreshing;

        if (!data?.access) {
          throw new Error("Refresh response does not contain an access token");
        }

        // Store new access token.
        setAccessToken(data.access);

        // Retry the original request with the new token.
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.access}`;

        return api(original);

      } catch (refreshError) {
        // Refresh failed. Clear the session.
        setAccessToken(null);

        window.dispatchEvent(new Event("auth:logout"));

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Extract readable error messages.
export const errorMessage = (
  error,
  fallback = "Something went wrong. Try again."
) => {
  const data = error?.response?.data;

  if (!data) return fallback;

  if (typeof data === "string") return fallback;

  if (data.detail) return data.detail;

  const first = Object.values(data)[0];

  return Array.isArray(first)
    ? first[0]
    : String(first ?? fallback);
};

// Extract field-level DRF validation errors.
export const fieldErrors = (error) => {
  const data = error?.response?.data;

  if (!data || typeof data !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => key !== "detail")
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value[0]
          : typeof value === "string"
            ? value
            : "Invalid value",
      ])
  );
};

// Currency formatter.
export const rupees = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

// Date formatter.
export const fmtDate = (date, withTime = false) =>
  date
    ? new Date(date).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime
          ? {
              hour: "numeric",
              minute: "2-digit",
            }
          : {}),
      })
    : "-";

// Relative time formatter.
export const timeAgo = (date) => {
  const seconds = Math.max(
    1,
    Math.round((Date.now() - new Date(date).getTime()) / 1000)
  );

  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 24) return `${hours} h ago`;

  const days = Math.round(hours / 24);

  if (days < 7) return `${days} d ago`;

  return fmtDate(date);
};

export default api;
