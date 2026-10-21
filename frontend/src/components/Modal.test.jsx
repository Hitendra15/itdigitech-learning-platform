import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Modal from "./Modal.jsx";

// A form like the real ones: every keystroke re-renders the parent, which passes a brand-new onClose each time.
function Form() {
  const [open, setOpen] = useState(true);
  const [v, setV] = useState({ title: "", message: "" });
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="New announcement">
      <input aria-label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <textarea aria-label="Message" value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
    </Modal>
  );
}

describe("Modal", () => {
  it("keeps typing in the field you clicked, instead of jumping back to the first field", async () => {
    render(<Form />);
    await userEvent.click(screen.getByLabelText("Message"));
    await userEvent.keyboard("Classes start on Monday");
    expect(screen.getByLabelText("Message").value).toBe("Classes start on Monday");
    expect(screen.getByLabelText("Title").value).toBe("");
  });

  it("focuses the first field once when it opens, and closes on Escape", async () => {
    render(<Form />);
    expect(document.activeElement).toBe(screen.getByLabelText("Title"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
