import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildGoogleCalendarUrl, type CalendarEvent } from "@/lib/googleCalendar";

interface Props extends CalendarEvent {
  /** "icon" = compact ghost icon for list rows; "labeled" = button with text. */
  variant?: "icon" | "labeled";
  className?: string;
}

/**
 * One-click "Ajouter à Google Agenda" — opens Google Calendar pre-filled with
 * the event so the user just hits Save. Renders nothing if the date is invalid.
 */
export function AddToCalendarButton({ variant = "icon", className, ...event }: Props) {
  const url = buildGoogleCalendarUrl(event);
  if (!url) return null;

  if (variant === "labeled") {
    return (
      <Button asChild size="sm" variant="outline" className={cn("gap-1.5", className)}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <CalendarPlus className="h-4 w-4" /> Agenda
        </a>
      </Button>
    );
  }

  return (
    <Button asChild size="icon" variant="ghost" className={cn("h-7 w-7", className)}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Ajouter à Google Agenda"
        aria-label="Ajouter à Google Agenda"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
      </a>
    </Button>
  );
}
