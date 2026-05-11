import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import {
  sanitizeRichHtml,
  isLegacyMarkdown,
  markdownToHtml,
} from "@/lib/sanitizeRichHtml";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  ariaLabel?: string;
}

function toEditorHtml(value: string): string {
  if (!value) return "";
  if (isLegacyMarkdown(value)) return markdownToHtml(value);
  return value;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 90,
  className = "",
  ariaLabel,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>("");

  // Sync external value into the DOM only when it diverges from what we just emitted.
  // This prevents the caret from jumping while the user types.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const incoming = toEditorHtml(value);
    if (incoming !== lastEmittedRef.current && incoming !== el.innerHTML) {
      el.innerHTML = incoming;
      lastEmittedRef.current = incoming;
    }
  }, [value]);

  function emit(): void {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmittedRef.current = html;
    onChange(html);
  }

  function exec(command: string): void {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // execCommand is deprecated but remains the most reliable cross-browser way
    // to apply inline formatting to a selection inside a contentEditable.
    document.execCommand(command, false);
    emit();
  }

  function handleBlur(): void {
    const el = editorRef.current;
    if (!el) return;
    const cleaned = sanitizeRichHtml(el.innerHTML);
    if (cleaned !== el.innerHTML) {
      el.innerHTML = cleaned;
    }
    lastEmittedRef.current = cleaned;
    onChange(cleaned);
  }

  return (
    <div className={`rich-text-editor rounded-md border border-input bg-background ${className}`}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border/60">
        <ToolbarButton onClick={() => exec("bold")} title="Gras (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} title="Italique (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("underline")} title="Souligné (Ctrl+U)">
          <Underline className="w-3.5 h-3.5" />
        </ToolbarButton>
        <span className="w-px h-4 bg-border/60 mx-1" />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Liste à puces">
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} title="Liste numérotée">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={handleBlur}
        className="rte-content w-full px-3 py-2 text-xs focus:outline-none break-words"
        style={{ minHeight }}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
    >
      {children}
    </button>
  );
}
