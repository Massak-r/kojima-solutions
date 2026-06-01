import { useParams } from "react-router-dom";
import { Package } from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { DeliverablesManager } from "@/components/project/DeliverablesManager";

export default function ProjectDeliverables() {
  const { id } = useParams<{ id: string }>();
  const { projects } = useProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground font-body">
        Projet introuvable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProjectStepNav projectId={project.id} currentStep="livrables" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-primary" />
          <h1 className="font-display text-lg font-bold text-foreground">Livrables</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body">
          Liens, images et fichiers livrés au client. Ils apparaissent dans son espace projet — rattachés à une étape ou en livrable final.
        </p>
        <DeliverablesManager projectId={project.id} tasks={project.tasks ?? []} />
      </div>
    </div>
  );
}
