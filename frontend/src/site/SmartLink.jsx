import { Link } from "react-router-dom";
import { openChat } from "./config.js";

/** One place that understands every link an admin can enter: /path, #chat, https://, mailto:, tel: */
export default function SmartLink({ to, children, className, onClick }) {
  if (!to) return null;
  if (to.startsWith("#chat")) return <button type="button" className={className} onClick={() => { onClick?.(); openChat(); }}>{children}</button>;
  if (/^https?:/i.test(to)) return <a className={className} href={to} target="_blank" rel="noopener noreferrer" onClick={onClick}>{children}</a>;
  if (/^(mailto|tel):/i.test(to)) return <a className={className} href={to} onClick={onClick}>{children}</a>;
  return <Link className={className} to={to} onClick={onClick}>{children}</Link>;
}
