const ALLOWED_TAGS = new Set([
  "STRONG", "B", "EM", "I", "U", "S", "STRIKE",
  "BR", "P", "DIV", "SPAN",
  "UL", "OL", "LI",
]);

function walk(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }
    const el = child as HTMLElement;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }
    walk(el);
  }
}

/** Strip every tag and attribute except a strict allowlist for rich-text descriptions. */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const container = doc.body.firstChild as HTMLElement | null;
  if (!container) return "";
  walk(container);
  return container.innerHTML;
}

/** Detect legacy markdown bold (**text**) authored before rich-text editor existed. */
export function isLegacyMarkdown(value: string): boolean {
  if (!value) return false;
  const hasHtmlTag = /<\/?[a-zA-Z][^>]*>/.test(value);
  const hasMdBold = /\*\*[^*]+\*\*/.test(value);
  const hasNewline = /\r?\n/.test(value);
  return !hasHtmlTag && (hasMdBold || hasNewline);
}

/** Convert the previous **bold** markdown format to sanitized HTML. */
export function markdownToHtml(text: string): string {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\r?\n/g, "<br>");
}

/** Render any stored description (HTML or legacy markdown) as safe HTML. */
export function richHtmlForDisplay(value: string): string {
  if (!value) return "";
  if (isLegacyMarkdown(value)) return sanitizeRichHtml(markdownToHtml(value));
  return sanitizeRichHtml(value);
}
