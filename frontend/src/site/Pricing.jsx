import { useDocumentTitle, useFetch } from "../hooks.js";
import { Accordion, Skeleton } from "../components/ui.jsx";
import { IconShield } from "../components/Icons.jsx";
import { CompareTable, PlanCards, SectionHead } from "./shared.jsx";
import { PromoCard } from "./PromoBanner.jsx";
import { usePromo } from "./SiteContext.jsx";
import SmartLink from "./SmartLink.jsx";

export default function Pricing() {
  useDocumentTitle("Pricing");
  const plans = useFetch("/billing/plans");
  const faqs = useFetch("/support/faqs");
  const promo = usePromo("pricing");
  const money = (faqs.data ?? []).filter((f) => /payment|plan|price|access|invoice|refund|gst/i.test(`${f.category} ${f.question}`));
  return (
    <>
      <section className="page-hero"><div className="site-wrap"><h1>Simple plans. Pay once, learn at your pace.</h1><p>Prices exclude GST, which is added at checkout.</p></div></section>
      {promo && <section className="promo-section"><div className="site-wrap"><PromoCard promo={promo} /></div></section>}
      <section className="section">
        <div className="site-wrap">
          {plans.loading ? <Skeleton lines={4} height={140} /> : plans.data?.length ? <PlanCards plans={plans.data} /> : <p className="center muted">Plans will appear here soon.</p>}
          <p className="assure"><IconShield size={16} /> Payments are processed by Razorpay. We never see or store your card details.</p>
        </div>
      </section>
      {plans.data?.length > 1 && <section className="section alt"><div className="site-wrap"><SectionHead title="Compare plans" /><CompareTable plans={plans.data} /></div></section>}
      {money.length > 0 && <section className="section"><div className="site-wrap narrow-wrap"><SectionHead title="Payment and access questions" /><Accordion items={money} /><p className="center sec-more muted">More questions? <SmartLink className="link-btn" to="#chat">Chat with us</SmartLink></p></div></section>}
    </>
  );
}
