import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { ProjectDetailsPanel } from "@/components/ProjectDetailsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { ProjectStepNav } from "@/components/ProjectStepNav";

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject } = useProjects();
  const project = getProject(id!);

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project?.title || "");

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft size={14} className="mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  function handleConfirmTitle() {
    const newTitle = draftTitle.trim() || "Untitled Project";
    updateProject(id!, { title: newTitle });
    setEditingTitle(false);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft size={16} className="mr-2" />
            Dashboard
          </Button>
        </div>
      </header>

      <ProjectStepNav projectId={id!} currentStep="details" />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="flex items-center gap-3 mb-8 group">
          {editingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                autoFocus
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="font-display text-2xl md:text-3xl h-auto py-1 border-primary/30 focus-visible:ring-primary"
              />
              <button
                onClick={handleConfirmTitle}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl md:text-3xl text-foreground font-bold leading-tight">
                {project.title}
              </h1>
              <button
                onClick={() => {
                  setDraftTitle(project.title);
                  setEditingTitle(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>

        <ProjectDetailsPanel
          project={project}
          onChange={(updates) => updateProject(id!, updates)}
        />

        <div className="flex justify-end mt-8">
          <Button
            onClick={() => navigate(`/project/${id}/roadmap`)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-body gap-2"
          >
            Continue to Roadmap
            <ArrowRight size={16} />
          </Button>
        </div>
      </main>
    </div>
  );
}
