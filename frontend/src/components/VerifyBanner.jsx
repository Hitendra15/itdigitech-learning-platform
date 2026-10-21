import { useState } from "react";
import api from "../api/client.js";
import { useToast } from "./Toast.jsx";
import { IconMail } from "./Icons.jsx";

// Gentle nudge until the student confirms their email address.
export default function VerifyBanner({ user }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  if (user.is_email_verified) return null;
  if (sent) return <div className="banner banner-ok" role="status"><IconMail size={18} /> Confirmation email sent to {user.email}. It can take a minute to arrive.</div>;
  const resend = async () => {
    try { await api.post("/auth/resend-verification"); setSent(true); }
    catch { toast.error("Could not send the email right now. Try again in a few minutes."); }
  };
  return (
    <div className="banner" role="status">
      <IconMail size={18} />
      <span>Confirm your email address so receipts and support replies reach you.</span>
      <button className="link-btn" onClick={resend}>Send confirmation email</button>
    </div>
  );
}
