import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const iso = new Date().toISOString();
const plans = [
  { id: "p1", name: "Python Basics", price: "999.00", validity_days: 365, courses: [{ id: "c1", title: "Python Basics" }] },
  { id: "p2", name: "Full Stack Pack", price: "2499.00", validity_days: 730, courses: [{ id: "c1", title: "Python Basics" }, { id: "c2", title: "Java Fundamentals" }] },
];
const routes = {
  "/courses": [{ id: "c1", title: "Python Basics", slug: "python-basics", level: "beginner", description: "Variables, loops and functions." }],
  "/billing/plans": plans,
  "/support/faqs": [{ id: "f1", question: "How do I get my certificate?", answer: "Finish the course." }],
  "/certificates/verify/ITD-GOOD": { valid: true, code: "ITD-GOOD", recipient_name: "Asha Patil", course_title: "Python Basics", issued_at: iso, average_score: 82 },
  "/my/certificates": [{ id: "k1", code: "ITD-ABC", course_title: "Python Basics", course_slug: "python-basics", issued_at: iso, average_score: 90 }],
  "/my/courses": [{ id: "c2", slug: "java", title: "Java Fundamentals", progress: 100 }, { id: "c1", slug: "python-basics", title: "Python Basics", progress: 100 }],
  "/my/courses/python-basics/certificate": { eligible: false, progress: 50, required_progress: 100, tests_total: 1, tests_passed: 0, todo: ["Finish the lessons (50% done, 100% needed)."], certificate: null },
  "/my/courses/java/certificate": { eligible: true, progress: 100, todo: [], certificate: null },
  "/admin-api/chats": [{ id: "ch1", status: "waiting", visitor_name: "Ravi", visitor_email: "r@x.com", unread: true, last_message_at: iso, preview: "I want a human", reference: "CHAT-00001", is_student: false }],
  "/admin-api/chats/ch1": { id: "ch1", status: "waiting", visitor_name: "Ravi", visitor_email: "r@x.com", reference: "CHAT-00001", page_url: "/pricing", messages: [{ id: "m1", sender: "visitor", body: "I want a human", created_at: iso }] },
  "/chat/sessions/gone": null,
  "/site/config": { profile: {}, promotions: [] },
  "/site/home": { sections: [], seo: {} },
};
const SECTIONS = [
  { id: "s1", type: "hero", content: { eyebrow: "Learn more", heading: "Learn IT skills that get you hired", subheading: "Courses with practice.", bullets: [{ text: "Run code instantly" }], primary_cta_label: "See plans", primary_cta_url: "/pricing", secondary_cta_label: "", secondary_cta_url: "", show_starting_price: true, assurance: "", image: null } },
  { id: "s2", type: "promo", content: {}, promotion: null },
  { id: "s3", type: "highlights", content: { heading: "Why choose us", lead: "", items: [{ icon: "code", title: "Practice, not just videos", text: "A code lab." }] } },
  { id: "s4", type: "courses", content: { heading: "Pick a course", lead: "", limit: 6, cta_label: "", cta_url: "" } },
  { id: "s5", type: "plans", content: { heading: "Simple plans", lead: "", show_included: true, included: [{ text: "Verified certificate" }], show_compare: true } },
  { id: "s6", type: "faq", content: { heading: "Questions", lead: "", limit: 8 } },
  { id: "s7", type: "cta", content: { heading: "Start today", text: "", cta_label: "Get started", cta_url: "/register", secondary_cta_label: "", secondary_cta_url: "", show_offer_code: true } },
];
const PROMO = { id: "pr1", title: "Year-end sale: 15% off", description: "All plans", badge_text: "Limited", cta_label: "View plans", cta_url: "/pricing", theme: "brand", placements: ["top_bar", "home_section", "pricing"],
  desktop_image: null, mobile_image: null, ends_at: null, coupon: { code: "SPRING15", percent_off: 15, flat_off: 0 } };
function setSite({ sections = SECTIONS, promotions = [] } = {}) {
  routes["/site/home"] = { sections: sections.map((x) => (x.type === "promo" ? { ...x, promotion: promotions.find((p) => p.placements.includes("home_section")) ?? null } : x)).filter((x) => x.type !== "promo" || x.promotion), seo: {} };
  routes["/site/config"] = { profile: { brand_name: "Acme Learning", tagline: "Be better", email: "help@acme.test", phone: "", hours: "", address: "", payment_methods: [], footer_note: "" }, promotions };
}
const post = vi.fn();
vi.mock("./api/client.js", async () => {
  const actual = await vi.importActual("./api/client.js");
  const get = vi.fn(async (url) => {
    const key = url.split("?")[0];
    if (routes[key]) return { data: routes[key] };
    throw Object.assign(new Error("404 " + url), { response: { status: 404, data: { detail: "Not found." } } });
  });
  return { ...actual, default: { get, post: (...a) => post(...a), put: vi.fn(async () => ({ data: {} })) } };
});

let mockUser = null;
vi.mock("./auth/AuthContext.jsx", () => ({ useAuth: () => ({ user: mockUser, loading: false, logout: vi.fn(), refreshUser: vi.fn() }) }));

import { ToastProvider } from "./components/Toast.jsx";
import { RealtimeProvider } from "./realtime/Realtime.jsx";
import PublicLayout from "./site/PublicLayout.jsx";
import { SiteProvider } from "./site/SiteContext.jsx";
import Home from "./site/Home.jsx";
import Pricing from "./site/Pricing.jsx";
import VerifyCertificate from "./site/VerifyCertificate.jsx";
import ChatWidget from "./chat/ChatWidget.jsx";
import CertificateCard from "./components/CertificateCard.jsx";
import Certificates from "./pages/Certificates.jsx";
import Chats from "./console/Chats.jsx";
import CodeWorkspace from "./lab/CodeWorkspace.jsx";
import { runCode } from "./lab/runners.js";

const sockets = [];
class FakeWS { constructor(url) { this.url = url; sockets.push(this); } send() {} close() {} }
beforeEach(() => { setSite(); sessionStorage.clear(); sockets.length = 0; global.WebSocket = FakeWS; localStorage.clear(); mockUser = null; post.mockReset(); window.HTMLElement.prototype.scrollTo = vi.fn(); window.scrollTo = vi.fn(); });

const mount = (ui, path = "/") => render(<ToastProvider><RealtimeProvider><SiteProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></SiteProvider></RealtimeProvider></ToastProvider>);

describe("public website", () => {
  const landing = () => mount(<Routes><Route element={<PublicLayout />}><Route index element={<Home />} /></Route></Routes>);

  it("renders the homepage from admin-configured sections, in the configured order", async () => {
    landing();
    expect(await screen.findByRole("heading", { level: 1, name: "Learn IT skills that get you hired" })).toBeTruthy();
    expect(screen.getAllByText("Acme Learning").length).toBeGreaterThan(0);               // company name comes from the profile
    expect(await screen.findByText("Practice, not just videos")).toBeTruthy();
    expect(await screen.findByText("Variables, loops and functions.")).toBeTruthy();
    expect((await screen.findAllByText("Full Stack Pack")).length).toBeGreaterThan(0);
    expect(screen.getByText("Best value")).toBeTruthy();                                   // the plan with most courses
    expect(screen.getAllByText("Verified certificate").length).toBeGreaterThan(0);   // the "included in every plan" list
    expect(await screen.findByText("How do I get my certificate?")).toBeTruthy();
    const order = ["Learn IT skills that get you hired", "Why choose us", "Pick a course", "Simple plans", "Questions", "Start today"].map((t) => screen.getAllByRole("heading").findIndex((h) => h.textContent === t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows no promotional UI and no offer wording when nothing is live", async () => {
    landing();
    await screen.findByRole("heading", { level: 1 });
    await screen.findAllByText("Full Stack Pack");
    expect(screen.queryByRole("region", { name: "Announcement" })).toBeNull();
    expect(screen.queryByText(/% off/i)).toBeNull();
    expect(screen.queryByText(/(use|with) code/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/diwali|welcome10/i);
  });

  it("shows a live promotion everywhere it is configured, and prices follow its coupon", async () => {
    setSite({ promotions: [PROMO] });
    landing();
    const bar = await screen.findByRole("region", { name: "Announcement" });
    expect(bar.textContent).toContain("Year-end sale: 15% off");
    expect(bar.textContent).toContain("SPRING15");
    expect(await screen.findByRole("heading", { name: "Year-end sale: 15% off" })).toBeTruthy();   // homepage promo section
    expect((await screen.findAllByText("15% off")).length).toBeGreaterThan(0);                         // plan badges
    expect(screen.getAllByText("₹849").length).toBeGreaterThan(0);                                    // 999 less 15%
    expect(screen.getAllByText(/SPRING15/).length).toBeGreaterThan(2);                                // bar, promo card, plans, closing band
  });

  it("lets visitors dismiss the announcement bar for the session", async () => {
    setSite({ promotions: [PROMO] });
    landing();
    await userEvent.click(await screen.findByRole("button", { name: /dismiss announcement/i }));
    expect(screen.queryByRole("region", { name: "Announcement" })).toBeNull();
  });

  it("hides data-driven sections that have nothing to show instead of leaving a gap", async () => {
    routes["/billing/plans"] = [];
    landing();
    await screen.findByRole("heading", { level: 1 });
    await screen.findByText("Variables, loops and functions.");
    expect(screen.queryByRole("heading", { name: "Simple plans" })).toBeNull();
    routes["/billing/plans"] = plans;
  });

  it("ignores section types it does not know, so a newer server never breaks the page", async () => {
    setSite({ sections: [...SECTIONS.slice(0, 1), { id: "x", type: "hologram", content: {} }, ...SECTIONS.slice(6)] });
    landing();
    expect(await screen.findByRole("heading", { level: 1, name: "Learn IT skills that get you hired" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start today" })).toBeTruthy();
  });

  it("falls back to a friendly message if the page cannot load", async () => {
    delete routes["/site/home"];
    landing();
    expect(await screen.findByText(/couldn.t load this page/i)).toBeTruthy();
  });

  it("redirects a signed-in student away from the marketing page", async () => {
    mockUser = { id: "u", role: "student", status: "active", email: "s@x.com", profile: { full_name: "S" } };
    mount(<Routes><Route index element={<Home />} /><Route path="/dashboard" element={<p>dashboard here</p>} /></Routes>);
    expect(await screen.findByText("dashboard here")).toBeTruthy();
  });

  it("pricing page sends guests to register, filters by course, and follows the live promotion", async () => {
    setSite({ promotions: [PROMO] });
    mount(<Pricing />, "/pricing");
    const cta = await screen.findByRole("link", { name: "Choose Full Stack Pack" });
    expect(cta.getAttribute("href")).toBe("/register");
    expect((await screen.findAllByText(/SPRING15/)).length).toBeGreaterThan(0);        // pricing placement banner + discounted plans
    expect(await screen.findByRole("heading", { name: "Year-end sale: 15% off" })).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText(/i want to learn/i), "Java Fundamentals");
    expect(screen.queryByRole("link", { name: "Choose Python Basics" })).toBeNull();   // only plans that include Java remain
  });
});

describe("certificate verification", () => {
  it("confirms a valid certificate without exposing the email", async () => {
    mount(<Routes><Route path="/verify/:code" element={<VerifyCertificate />} /></Routes>, "/verify/ITD-GOOD");
    expect(await screen.findByText("Valid certificate")).toBeTruthy();
    expect(screen.getByText("Asha Patil")).toBeTruthy();
  });
  it("rejects an unknown ID", async () => {
    mount(<Routes><Route path="/verify/:code" element={<VerifyCertificate />} /></Routes>, "/verify/ITD-FAKE");
    expect(await screen.findByText("Not verified")).toBeTruthy();
  });
});

describe("student certificates", () => {
  beforeEach(() => { mockUser = { id: "u", role: "student", status: "active", email: "s@x.com", profile: { full_name: "S" } }; });

  it("course card lists what is left before the certificate unlocks", async () => {
    mount(<CertificateCard slug="python-basics" />);
    expect(await screen.findByText(/Finish the lessons/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /get certificate/i })).toBeNull();
  });
  it("course card lets the student claim once eligible", async () => {
    post.mockResolvedValue({ data: { code: "ITD-NEW", issued_at: iso } });
    mount(<CertificateCard slug="java" />);
    await userEvent.click(await screen.findByRole("button", { name: /get certificate/i }));
    expect(post).toHaveBeenCalledWith("/my/courses/java/certificate");
    expect(await screen.findByRole("button", { name: /download pdf/i })).toBeTruthy();
  });
  it("certificates page lists issued ones and offers to claim finished courses", async () => {
    mount(<Certificates />);
    expect(await screen.findByText("ITD-ABC")).toBeTruthy();
    expect(await screen.findByText(/Java Fundamentals/)).toBeTruthy();   // finished but not yet claimed
    expect(screen.getAllByRole("button", { name: /get certificate/i }).length).toBe(1);
  });
});

describe("chat widget", () => {
  it("lets a guest start a chat, get a bot answer and ask for a person", async () => {
    const session = { id: "s1", status: "bot", emailKnown: true, messages: [{ id: "a", sender: "bot", body: "Hi Ravi! I'm the assistant.", created_at: iso }] };
    post.mockImplementation(async (url, body) => {
      if (url === "/chat/sessions") return { data: session };
      if (url.endsWith("/human")) return { data: { ...session, status: "waiting", messages: [...session.messages, { id: "b", sender: "bot", body: "I've asked our support team to join.", created_at: iso }] } };
      throw new Error("unexpected " + url);
    });
    mount(<Routes><Route path="/" element={<ChatWidget />} /></Routes>);
    await userEvent.click(screen.getByRole("button", { name: /open chat/i }));
    await userEvent.type(screen.getByLabelText(/your name/i), "Ravi");
    await userEvent.type(screen.getByLabelText(/how can we help/i), "pricing?");
    await userEvent.click(screen.getByRole("button", { name: "Start chat" }));
    expect(post).toHaveBeenCalledWith("/chat/sessions", expect.objectContaining({ name: "Ravi", message: "pricing?" }));
    expect(await screen.findByText(/I'm the assistant/)).toBeTruthy();
    expect(localStorage.getItem("itd_chat_id")).toBe("s1");
    expect(sockets[0].url).toContain("/ws/chat/s1/");

    await userEvent.click(screen.getByRole("button", { name: /talk to a person/i }));
    expect(await screen.findByText(/Waiting for an agent/)).toBeTruthy();
  });

  it("shows an agent reply that arrives over the WebSocket and counts it while minimised", async () => {
    const session = { id: "s2", status: "live", emailKnown: true, messages: [{ id: "a", sender: "bot", body: "Hello", created_at: iso }] };
    routes["/chat/sessions/s2"] = session; localStorage.setItem("itd_chat_id", "s2");
    mount(<Routes><Route path="/" element={<ChatWidget />} /></Routes>);
    await waitFor(() => expect(sockets.length).toBe(1));
    act(() => sockets[0].onmessage({ data: JSON.stringify({ kind: "chat_message", chat_id: "s2", status: "live", message: { id: "z", sender: "agent", author: "Priya", body: "Happy to help!", created_at: iso } }) }));
    expect(await screen.findByRole("button", { name: /1 new messages/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /open chat/i }));
    expect(await screen.findByText("Happy to help!")).toBeTruthy();
    delete routes["/chat/sessions/s2"];
  });

  it("is hidden on the sign-in page", () => {
    mount(<Routes><Route path="/login" element={<ChatWidget />} /></Routes>, "/login");
    expect(screen.queryByRole("button", { name: /open chat/i })).toBeNull();
  });
});

describe("admin live chat", () => {
  it("shows waiting chats and sends a reply", async () => {
    mockUser = { id: "a", role: "admin", status: "active", email: "boss@x.com", profile: { full_name: "Boss" } };
    post.mockResolvedValue({ data: { ...routes["/admin-api/chats/ch1"], status: "live", messages: [...routes["/admin-api/chats/ch1"].messages, { id: "m2", sender: "agent", author: "Boss", body: "On it!", created_at: iso }] } });
    mount(<Chats />);
    await userEvent.click(await screen.findByText("Ravi"));
    expect(await screen.findByText("CHAT-00001", { exact: false })).toBeTruthy();
    await userEvent.type(screen.getByPlaceholderText(/reply to the visitor/i), "On it!");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(post).toHaveBeenCalledWith("/admin-api/chats/ch1", { body: "On it!" });
  });
});

describe("code lab", () => {
  // Run the real worker source in-process so a bug in it fails here, not in a student's browser.
  // Inside a real worker `self` IS the global scope, so the fake worker uses globalThis and restores it afterwards.
  const installWorker = () => {
    global.URL.createObjectURL = vi.fn((blob) => blob);
    global.Worker = class {
      constructor(blob) { this.listeners = []; this.src = blob.text(); }
      addEventListener(_, l) { this.listeners.push(l); }
      removeEventListener(_, l) { this.listeners = this.listeners.filter((x) => x !== l); }
      postMessage(data) {
        this.src.then(async (src) => {
          const saved = { log: console.log, info: console.info, debug: console.debug, warn: console.warn, error: console.error, post: globalThis.postMessage, prompt: globalThis.prompt };
          globalThis.postMessage = (d) => this.listeners.forEach((l) => l({ data: d }));
          new Function(src)();
          const done = new Promise((res) => this.listeners.push((e) => e.data.t === "done" && res()));
          globalThis.onmessage({ data });
          await done;
          Object.assign(console, { log: saved.log, info: saved.info, debug: saved.debug, warn: saved.warn, error: saved.error });
          globalThis.postMessage = saved.post; globalThis.prompt = saved.prompt; delete globalThis.onmessage;
        });
      }
      terminate() {}
    };
  };

  it("runs JavaScript, captures console output and reads input", async () => {
    installWorker();
    const r = await runCode("javascript", 'const n = prompt(); console.log("Hi", n); console.log([1,2]); console.error("oops");', { stdin: "Asha" });
    expect(r.exit_code).toBe(0);
    expect(r.stdout).toBe('Hi Asha\n[\n  1,\n  2\n]\n');
    expect(r.stderr).toBe("oops\n");
  });
  it("reports JavaScript errors instead of hanging", async () => {
    installWorker();
    const r = await runCode("javascript", "null.boom()");
    expect(r.exit_code).toBe(1);
    expect(r.stderr).toMatch(/TypeError/);
    const syn = await runCode("javascript", "let = = ;");
    expect(syn.exit_code).toBe(1);
    expect(syn.stderr).toMatch(/SyntaxError/);
  });
  it("returns an HTML preview without any server call", async () => {
    const r = await runCode("html", "<h1>Hi</h1>");
    expect(r.preview).toBe("<h1>Hi</h1>");
  });
  it("asks guests to sign in for server languages", async () => {
    post.mockRejectedValue(Object.assign(new Error("x"), { response: { status: 401, data: {} } }));
    const r = await runCode("java", "class Main {}");
    expect(r.stderr).toMatch(/Sign in/);
  });
  it("shows the sign-in hint and disables Run for guests on Java", async () => {
    render(<MemoryRouter><CodeWorkspace language="java" onLanguage={() => {}} code="class Main {}" onCode={() => {}} canRunServer={false} /></MemoryRouter>);
    expect(await screen.findByText(/run on our secure server/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /run code/i }).disabled).toBe(true);
  });
});
