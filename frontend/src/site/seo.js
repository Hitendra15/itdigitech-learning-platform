/** Sets the meta description and social image for the current page; returns a function that restores the previous values. */
export function setSeo({ description, image }) {
  const touched = [];
  const set = (selector, make, value) => {
    if (!value) return;
    let el = document.head.querySelector(selector);
    const created = !el;
    if (!el) { el = make(); document.head.appendChild(el); }
    const before = el.getAttribute("content");
    el.setAttribute("content", value);
    touched.push(() => (created ? el.remove() : el.setAttribute("content", before ?? "")));
  };
  const meta = (attr, name) => () => { const m = document.createElement("meta"); m.setAttribute(attr, name); return m; };
  set('meta[name="description"]', meta("name", "description"), description);
  set('meta[property="og:description"]', meta("property", "og:description"), description);
  set('meta[property="og:image"]', meta("property", "og:image"), image?.url ? new URL(image.url, window.location.origin).href : "");
  return () => touched.forEach((undo) => undo());
}
