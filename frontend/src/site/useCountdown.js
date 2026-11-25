import { useEffect, useState } from "react";

/** Live time left until `endsAt` as {d,h,m,s} strings, or null when there is no future end date. */
export default function useCountdown(endsAt) {
  const target = endsAt ? new Date(endsAt).getTime() : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target || target <= now) return null;
  const s = Math.floor((target - now) / 1000);
  const p = (n) => String(n).padStart(2, "0");
  return { d: p(Math.floor(s / 86400)), h: p(Math.floor((s % 86400) / 3600)), m: p(Math.floor((s % 3600) / 60)), s: p(s % 60) };
}
