import { useNavigate, useLocation } from "react-router-dom";
import { FolderKanban, FileText, Building2, Target, NotebookPen, type LucideIcon } from "lucide-react";
import { useQuickCreate } from "@/contexts/QuickCreateContext";
import { OPEN_MEETING_NOTES_EVENT } from "@/components/MeetingNoteDrawer";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  /** Accent for the round button on desktop; unused by the compact mobile list. */
  color: string;
  to?: string;
  action?: () => void;
}

/**
 * The "create something" shortcuts, defined once.
 *
 * They surface as a speed-dial on desktop and inside the capture sheet on
 * mobile, where a second floating button would fight the capture one for the
 * same corner. Two copies of this list would drift the first time an action
 * is added.
 */
export function useQuickActions(): QuickAction[] {
  const navigate = useNavigate();
  const location = useLocation();
  const { open: openQuickCreate } = useQuickCreate();

  // Match Home's Objectifs tab specifically — when already there, scroll
  // to the inline input instead of round-tripping through navigation.
  const isOnObjectivesView =
    location.pathname === "/home" && location.search.includes("tab=objectives");
  // Project sub-pages get an extra action so the meeting-notes drawer is
  // reachable without its own overlapping button.
  const isOnProjectPage = location.pathname.startsWith("/project/");

  return [
    ...(isOnProjectPage ? [{
      label: "Note de réunion",
      icon: NotebookPen,
      color: "bg-primary",
      action: () => { window.dispatchEvent(new CustomEvent(OPEN_MEETING_NOTES_EVENT)); },
    } satisfies QuickAction] : []),
    {
      label: "Nouvel objectif",
      icon: Target,
      color: "bg-violet-500",
      action: () => {
        if (isOnObjectivesView) {
          const input = document.getElementById("new-objective-input");
          if (input) {
            input.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => input.focus(), 400);
          }
        } else {
          navigate("/home?tab=objectives&focus=new-objective");
        }
      },
    },
    { label: "Nouveau projet", icon: FolderKanban, color: "bg-blue-500",    action: () => openQuickCreate("project") },
    { label: "Nouveau devis",  icon: FileText,     color: "bg-emerald-500", to: "/quotes/new" },
    { label: "Nouveau client", icon: Building2,    color: "bg-amber-500",   action: () => openQuickCreate("client") },
  ];
}
