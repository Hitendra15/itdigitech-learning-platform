import api from "../../api/client.js";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_MB = 5;
const BASE = "/admin-api/website";

/** Checks a file before it is sent, so people get an instant, readable message instead of a failed upload. */
export function checkImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Upload a JPG, PNG or WebP image.";
  if (file.size > MAX_MB * 1024 * 1024) return `Images can be up to ${MAX_MB} MB. This one is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  return null;
}

export async function uploadImage(file, altText = "") {
  const body = new FormData();
  body.append("image", file);
  if (altText) body.append("alt_text", altText);
  const { data } = await api.post(`${BASE}/media`, body);
  return data;
}

// Small in-memory cache so a form with many image fields does not refetch the same asset.
const cache = new Map();
export async function getAsset(id) {
  if (!id) return null;
  if (!cache.has(id)) cache.set(id, api.get(`${BASE}/media/${id}`).then((r) => r.data).catch((e) => { cache.delete(id); throw e; }));
  return cache.get(id);
}
export const rememberAsset = (a) => cache.set(a.id, Promise.resolve(a));
export const forgetAsset = (id) => cache.delete(id);

export const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
