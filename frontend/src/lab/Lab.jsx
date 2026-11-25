import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { useDocumentTitle } from "../hooks.js";
import CodeWorkspace from "./CodeWorkspace.jsx";
import { LANGUAGES, STARTERS } from "./runners.js";

const key = (l) => `itd_lab_${l}`;
const read = (l) => { try { return localStorage.getItem(key(l)) ?? STARTERS[l]; } catch { return STARTERS[l]; } };

/** Free playground. Anyone can use Python, JavaScript and HTML; Java/C/C++ need an account (server cost). */
export default function Lab() {
  useDocumentTitle("Online code lab");
  const { user } = useAuth();
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem("itd_lab_lang") || "python"; } catch { return "python"; } });
  const [code, setCode] = useState(() => read(language));

  useEffect(() => { setCode(read(language)); try { localStorage.setItem("itd_lab_lang", language); } catch { /* private mode */ } }, [language]);
  const change = (v) => { setCode(v); try { localStorage.setItem(key(language), v); } catch { /* private mode */ } };

  return (
    <div className="section lab-page">
      <div className="site-wrap">
        <header className="lab-head">
          <span className="eyebrow">Practice area</span>
          <h1>Online code lab</h1>
          <p className="lead">Write code, press Run and see the output instantly. No installation needed. Your code stays in this browser.</p>
        </header>
        <CodeWorkspace language={language} onLanguage={setLanguage} languages={Object.keys(LANGUAGES)} code={code} onCode={change}
          canRunServer={Boolean(user)} onReset={() => change(STARTERS[language])} minHeight="360px" />
      </div>
    </div>
  );
}
