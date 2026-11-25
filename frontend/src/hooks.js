import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api/client.js";

// GET helper with loading/error state and manual reload. Pass url=null to skip.
export function useFetch(url, params, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const key = JSON.stringify(params ?? {});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async (silent = false) => {
    if (!url) return;
    if (!silent) setLoading(true);
    try {
      const { data: d } = await api.get(url, { params: JSON.parse(key) });
      if (alive.current) { setData(d); setError(null); }
    } catch (e) {
      if (alive.current) setError(e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, setData, loading, error, reload: load, refresh: () => load(true) };
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function useDocumentTitle(title) {
  useEffect(() => { document.title = title ? `${title} · IT DigiTech Learn` : "IT DigiTech Learn"; }, [title]);
}
