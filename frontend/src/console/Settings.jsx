import CrudPage from "../components/CrudPage.jsx";
import api, { errorMessage } from "../api/client.js";
import { PageHead } from "../components/ui.jsx";
import { useToast } from "../components/Toast.jsx";
import { useDocumentTitle } from "../hooks.js";

export function FeatureFlags() {
  return (
    <CrudPage title="Feature flags" lead="Switch platform features on or off without a deployment." noun="flag" endpoint="/admin-api/flags" paginated={false} createLabel="New flag"
      columns={[
        { key: "key", label: "Flag", render: (f) => <div className="cell-stack"><strong className="mono">{f.key}</strong><span>{f.description}</span></div> },
        { key: "enabled", label: "Enabled", render: (f) => <FlagSwitch flag={f} /> },
      ]}
      fields={[
        { name: "key", label: "Key", required: true, help: "Lowercase letters, numbers and hyphens, for example ai-assistant." },
        { name: "description", label: "What it controls" },
        { name: "enabled", label: "Enabled", type: "checkbox", span: 2 },
      ]} />
  );
}

function FlagSwitch({ flag }) {
  const toast = useToast();
  return (
    <label className="switch">
      <input type="checkbox" defaultChecked={flag.enabled} aria-label={`${flag.key} enabled`}
        onChange={async (e) => {
          const on = e.target.checked;
          try { await api.patch(`/admin-api/flags/${flag.id}`, { enabled: on }); }
          catch (err) { e.target.checked = !on; toast.error(errorMessage(err)); }
        }} />
      <span aria-hidden />
    </label>
  );
}

export function SiteSettings() {
  return (
    <CrudPage title="Site settings" lead="Named values the platform reads at runtime, stored as JSON." noun="setting" endpoint="/admin-api/site-settings" paginated={false} createLabel="New setting"
      columns={[
        { key: "key", label: "Key", render: (s) => <div className="cell-stack"><strong className="mono">{s.key}</strong><span>{s.description}</span></div> },
        { key: "value", label: "Value", render: (s) => <code className="clamp-1">{JSON.stringify(s.value)}</code> },
      ]}
      fields={[
        { name: "key", label: "Key", required: true },
        { name: "description", label: "Description" },
        { name: "value", label: "Value (JSON)", type: "json", span: 2, rows: 6, help: 'Example: {"support_hours": "10am to 6pm IST"}' },
      ]}
      toForm={(s) => ({ ...s, value: JSON.stringify(s.value, null, 2) })} />
  );
}

export default function Settings() {
  useDocumentTitle("Settings");
  return (
    <div className="stack-lg">
      <PageHead title="Settings" lead="Platform switches and configuration values." />
      <div className="embedded"><FeatureFlags /></div>
      <div className="embedded"><SiteSettings /></div>
    </div>
  );
}
