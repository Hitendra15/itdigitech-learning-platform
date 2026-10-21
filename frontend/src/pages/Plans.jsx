import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { Alert, EmptyState, Spinner } from "../components/ui.jsx";
import PlanCard, { featuredPlanId } from "../components/PlanCard.jsx";
import { IconShield, IconTag } from "../components/Icons.jsx";
import { useDocumentTitle } from "../hooks.js";

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

export default function Plans() {
  useDocumentTitle("Plans");
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [message, setMessage] = useState(null); // {type, text}
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { api.get("/billing/plans").then((r) => setPlans(r.data)); }, []);

  const pay = async (plan) => {
    setBusyId(plan.id);
    setMessage(null);
    try {
      await loadRazorpay();
      const { data: order } = await api.post("/billing/orders", { plan_id: plan.id, coupon: coupon || undefined });

      const rzp = new window.Razorpay({
        key: order.razorpay_key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: "IT DigiTech Solutions",
        description: order.plan,
        prefill: { name: user.profile?.full_name, email: user.email, contact: user.phone },
        theme: { color: "#2251e0" },
        // Success callback: ask our server to verify the signature. The webhook is the safety net.
        handler: async (resp) => {
          try {
            await api.post("/billing/verify", resp);
            await refreshUser();
            navigate("/dashboard", { replace: true });
          } catch (err) {
            setMessage({ type: "error", text: errorMessage(err, "We could not confirm your payment yet. If money was deducted, access will unlock within a few minutes.") });
          } finally {
            setBusyId(null);
          }
        },
        modal: { ondismiss: () => setBusyId(null) },
      });
      rzp.on("payment.failed", (r) => {
        setMessage({ type: "error", text: `${r.error?.description || "Payment failed."} You can try again.` });
        setBusyId(null);
      });
      rzp.open();
    } catch (err) {
      setMessage({ type: "error", text: errorMessage(err, err.message) });
      setBusyId(null);
    }
  };

  const pending = user?.status === "pending_payment";
  const featured = featuredPlanId(plans);
  if (!plans) return <Spinner label="Loading plans…" />;

  return (
    <div className="stack-lg">
      <header className="page-head">
        <div>
          <h1>{pending ? "Choose a plan to unlock your courses" : "Plans"}</h1>
          <p className="lead">Pay with UPI, card or net banking. Prices exclude GST, which is added at checkout, and every payment gets a GST invoice.</p>
        </div>
        <div className="coupon">
          <label htmlFor="coupon">Have a coupon?</label>
          <input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Enter code" autoComplete="off" spellCheck={false} />
        </div>
      </header>

      {message && <Alert type={message.type === "error" ? "error" : "ok"}>{message.text}</Alert>}

      {plans.length === 0 ? (
        <EmptyState icon={IconTag} title="No plans yet">Plans will show up here as soon as they are published. Check back shortly.</EmptyState>
      ) : (
        <ul className="plan-grid">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} featured={featured === p.id}
              cta={<button className={`btn btn-lg btn-block ${featured === p.id ? "btn-primary" : "btn-ghost"}`} disabled={busyId !== null} onClick={() => pay(p)}>
                {busyId === p.id ? "Opening payment…" : "Pay and start learning"}
              </button>} />
          ))}
        </ul>
      )}

      <p className="assure"><IconShield size={16} /> Payments are processed by Razorpay. We never see or store your card details.</p>
    </div>
  );
}
