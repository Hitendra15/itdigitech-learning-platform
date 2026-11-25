import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import api from "../api/client.js";
import { Skeleton } from "../components/ui.jsx";
import { useDocumentTitle } from "../hooks.js";
import SectionRenderer from "./sections.jsx";
import { setSeo } from "./seo.js";

export default function Home() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState({ state: "loading", sections: [], seo: null });
  useDocumentTitle(page.seo?.title || "");
  useEffect(() => {
    let alive = true;
    api.get("/site/home")
      .then(({ data }) => alive && setPage({ state: "ready", sections: data.sections, seo: data.seo }))
      .catch(() => alive && setPage({ state: "error", sections: [], seo: null }));
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (page.seo) return setSeo(page.seo); return undefined; }, [page.seo]);

  if (loading) return null;
  if (user) return <Navigate to={user.role === "admin" ? "/console" : user.status === "active" ? "/dashboard" : "/plans"} replace />;
  if (page.state === "loading") return <div className="site-wrap section"><Skeleton lines={5} height={28} /></div>;
  if (page.state === "error") return (
    <div className="site-wrap section center">
      <h1>We couldn’t load this page</h1>
      <p className="lead" style={{ marginInline: "auto" }}>Check your connection and try again.</p>
      <p className="sec-more"><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button></p>
    </div>
  );
  return <SectionRenderer sections={page.sections} />;
}
