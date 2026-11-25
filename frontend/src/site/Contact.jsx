import { Link } from "react-router-dom";
import { useDocumentTitle, useFetch } from "../hooks.js";
import { Accordion } from "../components/ui.jsx";
import { IconChat, IconHeadset, IconMail, IconMapPin, IconPhone } from "../components/Icons.jsx";
import { openChat } from "./config.js";
import { useSite } from "./SiteContext.jsx";

export default function Contact() {
  useDocumentTitle("Contact and support");
  const faqs = useFetch("/support/faqs");
  const { profile: p } = useSite();
  return (
    <>
      <section className="page-hero"><div className="site-wrap"><h1>We are here to help</h1><p>Chat with us, raise a ticket or write to us. Most questions are answered within a working day.</p></div></section>
      <section className="section">
        <div className="site-wrap">
          <ul className="contact-grid">
            <li><span className="f-ic"><IconHeadset size={22} /></span><h3>Live chat</h3><p>Get instant answers from our assistant, or ask for a person. {p.hours ? `Available ${p.hours}.` : ""}</p><button className="btn btn-primary" onClick={openChat}>Start a chat</button></li>
            <li><span className="f-ic"><IconChat size={22} /></span><h3>Support ticket</h3><p>Students can raise a request with attachments and track every reply from their account.</p><Link className="btn btn-primary" to="/support/new">Raise a ticket</Link></li>
            {p.email && <li><span className="f-ic"><IconMail size={22} /></span><h3>Email</h3><p>Write to us any time and include your registered email.</p><a className="btn btn-ghost" href={`mailto:${p.email}`}>{p.email}</a></li>}
            {p.phone && <li><span className="f-ic"><IconPhone size={22} /></span><h3>Call us</h3><p>{p.hours}</p><a className="btn btn-ghost" href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a></li>}
          </ul>
          {p.address && <p className="center muted office"><IconMapPin size={16} /> {p.address}</p>}
        </div>
      </section>
      {faqs.data?.length > 0 && <section className="section alt" id="faq"><div className="site-wrap narrow-wrap"><h2 className="center" style={{ marginBottom: "1.25rem" }}>Common questions</h2><Accordion items={faqs.data} /></div></section>}
    </>
  );
}
