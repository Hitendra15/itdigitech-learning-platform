import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { RealtimeProvider } from "./realtime/Realtime.jsx";
import { SiteProvider } from "./site/SiteContext.jsx";
import "./styles.css";
import "./console.css";
import "./site/site.css";
import "./site/widgets.css";
import "./console/website.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <RealtimeProvider>
            <SiteProvider>
              <App />
            </SiteProvider>
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
