import { useParams, useLocation } from "react-router-dom";
import { MeetingNoteDrawer } from "./MeetingNoteDrawer";

/**
 * Renders the MeetingNoteDrawer FAB on any /project/:id/* route.
 * Placed once in App.tsx — shows automatically on project pages.
 */
export function ProjectMeetingNotes() {
  const { pathname } = useLocation();
  const match = pathname.match(/^\/project\/([^/]+)\//);

  if (!match) return null;

  const projectId = match[1];
  return <MeetingNoteDrawer key={projectId} projectId={projectId} />;
}
