import { cn } from "@/lib/utils";

/**
 * Renders a simple markup syntax:
 * - **bold** → <strong>
 * - Lines starting with "- " → bullet list items
 * - Empty lines → paragraph breaks
 */
interface RichTextProps {
  text: string;
  className?: string;
}

export function RichText({ text, className }: RichTextProps) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="list-disc list-inside space-y-0.5 my-1">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  for (const line of lines) {
    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() === "") {
        elements.push(<br key={key++} />);
      } else {
        elements.push(
          <span key={key++} className="block">
            {renderInline(line)}
          </span>
        );
      }
    }
  }
  flushList();

  return <div className={cn("text-sm leading-relaxed", className)}>{elements}</div>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={key++} className="font-semibold">{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
