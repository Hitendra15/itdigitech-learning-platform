import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const iso = new Date().toISOString();
const ticket = { id: "t1", reference: "TKT-00001", subject: "Payment deducted", category: "payment", category_label: "Payment or invoice", priority: "high", priority_label: "High",
  status: "open", status_label: "Open", unread: true, last_message_at: iso, created_at: iso, preview: "I paid yesterday", student: "Asha", student_email: "a@x.com", assigned_to: null };
const msgs = [{ id: "m1", body: "I paid yesterday", is_staff_reply: false, is_internal_note: false, author: "Asha", created_at: iso, attachment: null }];

const routes = {
  "/my/notifications": { results: [], unread: 0 },
  "/support/unread": { unread: 0 },
  "/admin-api/tickets/counts": { open: 1, unread: 1, mine: 0, unassigned: 1 },
  "/support/faqs": [{ id: "f1", question: "How do I get my invoice?", answer: "From Payments." }],
  "/support/tickets": [ticket],
  "/support/tickets/t1": { ...ticket, messages: msgs },
  "/admin-api/dashboard": { totals: { students: 5, active_students: 3, new_students_30d: 2, revenue_total: 5000, revenue_30d: 2000, orders_paid: 2, pending_orders: 1, open_tickets: 1, unanswered_tickets: 1, courses: 2 },
    signups: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, value: i % 3 })),
    revenue: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, value: i * 100 })),
    top_courses: [{ title: "Python", enrolled: 3 }], recent_orders: [], recent_tickets: [ticket] },
  "/admin-api/tickets": { count: 1, results: [ticket] },
  "/admin-api/tickets/t1": { ...ticket, student: { name: "Asha", email: "a@x.com", phone: "", status: "active" }, assigned_to: null, messages: msgs },
  "/admin-api/staff": [{ id: "s1", email: "boss@x.com", name: "Boss" }],
  "/admin-api/plans": { count: 1, results: [{ id: "p1", name: "Python Pro", plan_type: "single", price: "1000.00", gst_percent: "18.00", validity_days: 30, courses: [], include_all_courses: false, is_active: true, orders_count: 2 }] },
  "/admin-api/courses": { count: 1, results: [{ id: "c1", title: "Python", slug: "python", is_published: true, modules_count: 1, lessons_count: 1, enrolled_count: 3 }] },
  "/admin-api/courses/c1/curriculum": { course: { id: "c1", title: "Python", is_published: true, modules_count: 1, lessons_count: 1, enrolled_count: 3 },
    modules: [{ id: "m1", title: "Basics", lessons: [{ id: "l1", title: "Intro", lesson_type: "video", duration_seconds: 600, is_free_preview: true, is_published: true, video_path: "/x.m3u8", note_content: "" }] }] },
  "/admin-api/tests/te1": { id: "te1", title: "Quiz 1", course_title: "Python", duration_minutes: 20, pass_percent: 60, max_attempts: 3, is_published: true, course: "c1" },
  "/admin-api/questions": [{ id: "q1", text: "2+2?", options: [{ id: "a", text: "4" }, { id: "b", text: "5" }], correct_answer: ["a"], marks: 1, explanation: "" }],
  "/admin-api/exports": [],
  "/admin-api/flags": [{ id: "fl1", key: "ai-assistant", enabled: true, description: "AI helper" }],
  "/admin-api/site-settings": [],
  "/courses": [{ id: "c1", title: "Python Basics", slug: "python-basics", description: "Loops and functions", level: "beginner" }, { id: "c2", title: "Java Fundamentals", slug: "java", description: "OOP", level: "intermediate" }],
  "/billing/plans": [{ id: "p1", name: "Python Basics", price: "999.00", gst_percent: "18.00", validity_days: 365, courses: [{ title: "Python Basics", slug: "python-basics" }] }, { id: "p2", name: "Full Stack Pass", price: "3499.00", gst_percent: "18.00", validity_days: 365, courses: [{ title: "Python Basics", slug: "a" }, { title: "Java", slug: "b" }] }],
  "/admin-api/users": { count: 1, results: [{ id: "u1", email: "s@x.com", full_name: "Stu Dent", role: "student", status: "active", is_active: true, is_email_verified: false, active_courses: 1, created_at: iso }] },
};

vi.mock("./api/client.js", async () => {
  const get = vi.fn(async (url) => {
    const key = url.split("?")[0];
    if (key in routes) return { data: routes[key] };
    throw Object.assign(new Error("404 " + url), { response: { status: 404, data: { detail: "nope" } } });
  });
  const ok = vi.fn(async (url) => {
    if (url === "/tests/te1/start") return { data: { attempt: { id: "a1", test: "Quiz 1", expires_at: new Date(Date.now() + 600000).toISOString() }, answers: {},
      questions: [{ id: "q1", text: "2+2?", multiple: false, options: [{ id: "a", text: "4" }, { id: "b", text: "5" }] }, { id: "q2", text: "3+3?", multiple: false, options: [{ id: "a", text: "6" }, { id: "b", text: "7" }] }] } };
    return { data: { ticket: "tk", detail: "ok" } };
  });
  const actual = await vi.importActual("./api/client.js");
  return { ...actual, default: { get, post: ok, patch: ok, delete: ok }, setAccessToken: vi.fn() };
});

let mockUser = { id: "me", email: "boss@x.com", role: "admin", status: "active", is_email_verified: true, profile: { full_name: "Boss Admin" } };
vi.mock("./auth/AuthContext.jsx", () => ({ useAuth: () => ({ user: mockUser, loading: false, logout: vi.fn(), refreshUser: vi.fn() }) }));

import { ToastProvider } from "./components/Toast.jsx";
import { RealtimeProvider } from "./realtime/Realtime.jsx";
import AdminRoutes from "./console/AdminRoutes.jsx";
import Support from "./pages/Support.jsx";
import SupportNew from "./pages/SupportNew.jsx";
import SupportTicket from "./pages/SupportTicket.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Profile from "./pages/Profile.jsx";
import Home from "./pages/Home.jsx";
import TestRunner from "./pages/TestRunner.jsx";
import FocusShell from "./components/FocusShell.jsx";
import api from "./api/client.js";

class FakeWS { constructor() { this.readyState = 0; } send() {} close() {} }
beforeEach(() => { window.scrollTo = vi.fn(); global.WebSocket = FakeWS; window.HTMLElement.prototype.scrollIntoView = vi.fn(); vi.clearAllMocks(); });

const mount = (ui, path) => render(
  <ToastProvider><RealtimeProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></RealtimeProvider></ToastProvider>
);

describe("admin console", () => {
  const admin = (path) => mount(<Routes><Route path="/console/*" element={<AdminRoutes />} /></Routes>, path);

  it("renders the dashboard", async () => {
    admin("/console");
    expect(await screen.findByText("Hello, Boss")).toBeTruthy();
    expect(screen.getByText("₹2,000")).toBeTruthy();
    expect(screen.getByText("Most popular courses")).toBeTruthy();
  });
  it("shows the inbox and opens a conversation", async () => {
    admin("/console/tickets/t1");
    expect((await screen.findAllByText("Payment deducted")).length).toBeGreaterThan(0);
    expect(await screen.findByText("I paid yesterday", { selector: ".msg-body" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Internal note" }));
    expect(screen.getByPlaceholderText(/Only admins can see/)).toBeTruthy();
  });
  it("lists plans and opens the create form", async () => {
    admin("/console/plans");
    expect(await screen.findByText("Python Pro")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /New plan/ }));
    const dialog = await screen.findByRole("dialog", { name: "New plan" });
    expect(within(dialog).getByLabelText(/Plan name/)).toBeTruthy();
  });
  it("renders the curriculum editor", async () => {
    admin("/console/courses/c1");
    expect(await screen.findByText("Basics")).toBeTruthy();
    expect(screen.getByText("Intro")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Add lesson/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
  it("renders the question editor", async () => {
    admin("/console/tests/te1");
    expect(await screen.findByText("2+2?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Add question/ }));
    expect(await screen.findByLabelText("Option A is correct")).toBeTruthy();
  });
  it("renders users, reports and settings", async () => {
    admin("/console/users");
    expect(await screen.findByText("Stu Dent")).toBeTruthy();
  });
  it("renders reports and settings", async () => {
    admin("/console/reports");
    expect(await screen.findByText("Recent exports")).toBeTruthy();
  });
  it("renders settings", async () => {
    admin("/console/settings");
    expect(await screen.findByText("ai-assistant")).toBeTruthy();
  });
  it("blocks non-admins", async () => {
    mockUser = { ...mockUser, role: "student" };
    mount(<Routes><Route path="/console/*" element={<AdminRoutes />} /><Route path="/" element={<div>learner home</div>} /></Routes>, "/console");
    expect(await screen.findByText("learner home")).toBeTruthy();
    mockUser = { ...mockUser, role: "admin" };
  });
});

describe("student pages", () => {
  beforeEach(() => { mockUser = { id: "me", email: "stu@x.com", role: "student", status: "active", is_email_verified: false, phone: "", profile: { full_name: "Stu Dent" } }; });

  it("lists support requests and FAQs", async () => {
    mount(<Support />, "/support");
    expect(await screen.findByText("Payment deducted")).toBeTruthy();
    expect(await screen.findByText("How do I get my invoice?")).toBeTruthy();
  });
  it("shows a ticket conversation", async () => {
    mount(<Routes><Route path="/support/:id" element={<SupportTicket />} /></Routes>, "/support/t1");
    expect(await screen.findByText("I paid yesterday", { selector: ".msg-body" })).toBeTruthy();
    expect(screen.getByLabelText("Your reply")).toBeTruthy();
  });
  it("suggests help articles while typing a new request", async () => {
    mount(<SupportNew />, "/support/new");
    await userEvent.type(screen.getByLabelText("Subject"), "invoice problem");
    expect(await screen.findByText("These answers might help")).toBeTruthy();
  });
  it("submits the forgot-password form", async () => {
    mount(<ForgotPassword />, "/forgot-password");
    await userEvent.type(screen.getByLabelText("Email"), "stu@x.com");
    await userEvent.click(screen.getByRole("button", { name: /Email me a reset link/ }));
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", { email: "stu@x.com" });
  });
  it("validates a reset link before showing the form", async () => {
    routes["/auth/reset-password"] = { valid: true };
    mount(<ResetPassword />, "/reset-password?uid=MQ&token=abc");
    expect(await screen.findByLabelText("New password")).toBeTruthy();
    routes["/auth/reset-password"] = { valid: false };
  });
  it("renders the account page with the verification prompt", async () => {
    mount(<Profile />, "/account");
    expect(await screen.findByText("Change password")).toBeTruthy();
    expect(screen.getByText("Not confirmed")).toBeTruthy();
  });
});

describe("public landing page", () => {
  it("shows the hero, courses and plans from the API", async () => {
    mockUser = null;
    mount(<Home />, "/");
    expect(await screen.findByText("Job-ready IT skills, one lesson at a time.")).toBeTruthy();
    expect((await screen.findAllByText("Python Basics")).length).toBeGreaterThan(1);
    expect(await screen.findByText("Most courses")).toBeTruthy(); // Full Stack Pass is featured
    expect(screen.getAllByRole("link", { name: /Create your account/ }).length).toBeGreaterThan(0);
  });
});

describe("test runner", () => {
  beforeEach(() => { mockUser = { id: "me", email: "stu@x.com", role: "student", status: "active", is_email_verified: true, profile: { full_name: "Stu Dent" } }; });
  it("shows one question at a time, a palette, and a submit confirmation", async () => {
    mount(<Routes><Route element={<FocusShell />}><Route path="/tests/:testId" element={<TestRunner />} /></Route></Routes>, "/tests/te1");
    await userEvent.click(await screen.findByRole("button", { name: "Start test" }));
    expect(await screen.findByText("2+2?")).toBeTruthy();
    expect(screen.queryByText("3+3?")).toBeNull();
    await userEvent.click(screen.getByLabelText(/4/));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("3+3?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Submit test" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit your test?" });
    expect(within(dialog).getByText(/not answered/)).toBeTruthy();
  });
});
