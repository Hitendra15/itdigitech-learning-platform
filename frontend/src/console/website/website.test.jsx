import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = { post: vi.fn(), patch: vi.fn(), delete: vi.fn() };
const data = {};
vi.mock("../../api/client.js", async () => {
  const actual = await vi.importActual("../../api/client.js");
  const get = vi.fn(async (url) => {
    const key = url.split("?")[0];
    if (key in data) return { data: data[key] };
    throw Object.assign(new Error("404 " + url), { response: { status: 404, data: { detail: "Not found." } } });
  });
  const ok = (fn) => vi.fn(async (...a) => { fn(...a); return { data: {} }; });
  return { ...actual, default: { get, post: ok((...a) => calls.post(...a)), patch: ok((...a) => calls.patch(...a)), delete: ok((...a) => calls.delete(...a)) } };
});

import { ToastProvider } from "../../components/Toast.jsx";
import SchemaForm from "./SchemaForm.jsx";
import Homepage from "./Homepage.jsx";

const mount = (ui) => render(<ToastProvider><MemoryRouter>{ui}</MemoryRouter></ToastProvider>);

const FIELDS = [
  { type: "text", name: "heading", label: "Heading", max: 20, required: true, help: "" },
  { type: "list", name: "items", label: "Cards", max_items: 2, item_label: "Card", help: "", fields: [
    { type: "text", name: "title", label: "Title", max: 40, required: true, help: "" },
  ] },
];

function Harness({ errors = {}, start = { heading: "Hi", items: [{ title: "One" }] } }) {
  const [v, setV] = useState(start);
  return <><SchemaForm fields={FIELDS} values={v} errors={errors} onChange={setV} /><output data-testid="state">{JSON.stringify(v)}</output></>;
}
const state = () => JSON.parse(screen.getByTestId("state").textContent);

describe("SchemaForm", () => {
  it("edits text, shows a live character counter and marks optional fields", async () => {
    mount(<Harness />);
    const input = screen.getByLabelText("Heading");
    expect(screen.getByText("2/20")).toBeTruthy();
    await userEvent.type(input, "!");
    expect(state().heading).toBe("Hi!");
    expect(screen.getByText("3/20")).toBeTruthy();
    expect(screen.getByText("optional")).toBeTruthy();            // only the list is optional; the required heading is not marked
  });

  it("adds, reorders and removes list items, and stops at the maximum", async () => {
    mount(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /add card/i }));
    expect(state().items).toHaveLength(2);
    expect(screen.getByRole("button", { name: /add card/i }).disabled).toBe(true);
    expect(screen.getByText(/maximum of 2/i)).toBeTruthy();
    await userEvent.type(screen.getAllByLabelText("Title")[1], "Two");
    await userEvent.click(screen.getByRole("button", { name: "Move card 2 up" }));
    expect(state().items.map((i) => i.title)).toEqual(["Two", "One"]);
    await userEvent.click(screen.getByRole("button", { name: "Remove card 1" }));
    expect(state().items.map((i) => i.title)).toEqual(["One"]);
  });

  it("shows server errors on the exact field, including inside list items", () => {
    mount(<Harness errors={{ heading: ["This field is required."], items: [{ title: "Keep this under 40 characters (now 90)." }] }} />);
    expect(screen.getByText("This field is required.")).toBeTruthy();
    expect(screen.getByText(/under 40 characters/)).toBeTruthy();
    expect(screen.getByLabelText("Heading").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Homepage builder", () => {
  const section = (over) => ({ id: "a", section_type: "hero", type_label: "Hero", label: "Hero", order: 10, is_enabled: true, live_enabled: true, content: { heading: "Hello" }, has_draft: false, published_at: null, ...over });
  beforeEach(() => {
    Object.values(calls).forEach((f) => f.mockReset());
    data["/admin-api/website/sections"] = [section({ id: "a" }), section({ id: "b", section_type: "faq", type_label: "FAQs", label: "FAQs", order: 20, content: { heading: "Q" }, has_draft: true })];
    data["/admin-api/website/home/status"] = { pending: 1, last_published_at: null };
    data["/admin-api/website/schema"] = { sections: { hero: { label: "Hero", singleton: true, description: "", fields: [] }, testimonials: { label: "Testimonials", singleton: false, description: "Real feedback", fields: [] } } };
  });

  it("lists sections in order and flags the ones with unpublished changes", async () => {
    mount(<Homepage />);
    const list = await screen.findByRole("list", { name: /homepage sections/i });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText("Unpublished changes")).toBeTruthy();
    expect(within(rows[0]).getByText("Live")).toBeTruthy();
  });

  it("asks for confirmation before publishing, then publishes", async () => {
    mount(<Homepage />);
    await userEvent.click(await screen.findByRole("button", { name: /publish 1 change/i }));
    expect(calls.post).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Publish now" }));
    await waitFor(() => expect(calls.post).toHaveBeenCalledWith("/admin-api/website/home/publish"));
  });

  it("disables publishing when nothing has changed", async () => {
    data["/admin-api/website/home/status"] = { pending: 0, last_published_at: null };
    mount(<Homepage />);
    await screen.findByRole("list", { name: /homepage sections/i });
    expect(screen.getByRole("button", { name: /^publish$/i }).disabled).toBe(true);
    expect(screen.getByText(/everything is published/i)).toBeTruthy();
  });

  it("toggles a section and sends the new order when moved", async () => {
    mount(<Homepage />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /show hero on the homepage/i }));
    await waitFor(() => expect(calls.patch).toHaveBeenCalledWith("/admin-api/website/sections/a", { is_enabled: false }));
    await userEvent.click(screen.getByRole("button", { name: "Move Hero down" }));
    await waitFor(() => expect(calls.post).toHaveBeenCalledWith("/admin-api/website/sections/reorder", { ids: ["b", "a"] }));
  });

  it("requires confirmation to delete a section and only offers section types that can still be added", async () => {
    mount(<Homepage />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete Hero" }));
    expect(calls.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete section" }));
    await waitFor(() => expect(calls.delete).toHaveBeenCalledWith("/admin-api/website/sections/a"));
    await userEvent.click(screen.getByRole("button", { name: /add a section/i }));
    expect(await screen.findByText("Testimonials")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Hero/ })).toBeNull();         // hero is a singleton and already on the page
  });
});
