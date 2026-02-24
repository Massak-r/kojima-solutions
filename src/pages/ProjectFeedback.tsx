import { useParams, useNavigate } from "react-router-dom";
import { useProjects, TaskFeedback } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { ClientRoadmapView } from "@/components/ClientRoadmapView";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  ExternalLink,
  Send,
  Pencil,
  X,
  Map,
  MessageSquarePlus,
} from "lucide-react";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<TaskFeedback["status"], { label: string; icon: React.ReactNode; className: string }> = {
  approved: {
    label: "Approved",
    icon: <CheckCircle2 size={12} />,
    className: "bg-palette-sage/20 text-palette-sage border-palette-sage/30",
  },
  "needs-changes": {
    label: "Needs Changes",
    icon: <AlertTriangle size={12} />,
    className: "bg-palette-amber/20 text-palette-amber border-palette-amber/30",
  },
  pending: {
    label: "Pending",
    icon: <Clock size={12} />,
    className: "bg-muted text-muted-foreground border-border",
  },
};

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  secondary: "bg-secondary",
  rose: "bg-palette-rose",
  sage: "bg-palette-sage",
  amber: "bg-palette-amber",
  violet: "bg-palette-violet",
};

type ViewTab = "feedback" | "roadmap";

export default function ProjectFeedback() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, addFeedback, updateFeedback, respondToFeedbackRequest } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);

  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<TaskFeedback["status"]>("pending");
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editStatus, setEditStatus] = useState<TaskFeedback["status"]>("pending");
  const [viewTab, setViewTab] = useState<ViewTab>("feedback");

  const shareUrl = `${window.location.origin}/project/${id}/feedback`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Share this link with your client." });
  }, [shareUrl, toast]);

  const handleSubmit = useCallback(() => {
    if (!selectedTask || !comment.trim()) return;
    addFeedback(id!, selectedTask, {
      taskId: selectedTask,
      author: author.trim() || "Anonymous",
      comment: comment.trim(),
      status,
    });
    setComment("");
    setStatus("pending");
    toast({ title: "Feedback submitted", description: "Your review has been recorded." });
  }, [id, selectedTask, author, comment, status, addFeedback, toast]);

  const handleStartEdit = useCallback((fb: TaskFeedback) => {
    setEditingFeedbackId(fb.id);
    setEditComment(fb.comment);
    setEditStatus(fb.status);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingFeedbackId || !editComment.trim()) return;
    updateFeedback(id!, editingFeedbackId, { comment: editComment.trim(), status: editStatus });
    setEditingFeedbackId(null);
    toast({ title: "Feedback updated" });
  }, [id, editingFeedbackId, editComment, editStatus, updateFeedback, toast]);

  const handleRespondToRequest = useCallback((taskId: string, requestId: string, response: string) => {
    respondToFeedbackRequest(id!, taskId, requestId, response);
    toast({ title: "Response sent", description: "Your response has been recorded." });
  }, [id, respondToFeedbackRequest, toast]);

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

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);
  const feedbacks = project.feedbacks || [];

  return (
    <div className="min-h-screen bg-background">
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
          <Button
            variant="ghost"
            onClick={handleCopyLink}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs gap-1.5"
          >
            <Copy size={14} />
            Copy Share Link
          </Button>
        </div>
      </header>

      <ProjectStepNav projectId={id!} currentStep="feedback" />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Share banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ExternalLink size={18} className="text-primary" />
            <div>
              <p className="font-display text-sm font-semibold text-foreground">Shareable Review Link</p>
              <p className="font-body text-xs text-muted-foreground">Send this to your client for feedback</p>
            </div>
          </div>
          <code className="font-body text-xs bg-card border border-border rounded px-3 py-1.5 text-foreground/70 max-w-xs truncate">
            {shareUrl}
          </code>
        </div>

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">Client review &amp; feedback</p>

        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-6 w-fit">
          <button
            onClick={() => setViewTab("feedback")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium transition-all ${
              viewTab === "feedback" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquarePlus size={13} />
            Reviews
          </button>
          <button
            onClick={() => setViewTab("roadmap")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium transition-all ${
              viewTab === "roadmap" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Map size={13} />
            Roadmap Progress
          </button>
        </div>

        {viewTab === "roadmap" ? (
          <ClientRoadmapView
            tasks={project.tasks}
            feedbacks={feedbacks}
            onRespondToRequest={handleRespondToRequest}
          />
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No deliveries to review yet.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {sorted.map((task, i) => {
              const taskFeedbacks = feedbacks.filter((f) => f.taskId === task.id);
              const isSelected = selectedTask === task.id;

              return (
                <div key={task.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setSelectedTask(isSelected ? null : task.id)}
                    className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/30 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0 ${COLOR_MAP[task.color || "primary"]}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                        <div className="flex items-center gap-2">
                          {taskFeedbacks.length > 0 && (
                            <span className="font-body text-xs text-muted-foreground">
                              {taskFeedbacks.length} review{taskFeedbacks.length > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{task.dateLabel}</span>
                        </div>
                      </div>
                      {task.description && (
                        <div className="font-body text-xs text-foreground/60 mt-1">
                          <RichText text={task.description} />
                        </div>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <div className="border-t border-border">
                      {/* Existing feedbacks */}
                      {taskFeedbacks.length > 0 && (
                        <div className="p-4 space-y-3 bg-secondary/10">
                          {taskFeedbacks.map((fb) => {
                            const cfg = STATUS_CONFIG[fb.status];
                            const isEditing = editingFeedbackId === fb.id;

                            return (
                              <div key={fb.id} className="bg-card border border-border rounded-lg p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Textarea
                                      value={editComment}
                                      onChange={(e) => setEditComment(e.target.value)}
                                      rows={2}
                                      className="font-body text-sm resize-none"
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                      <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskFeedback["status"])}>
                                        <SelectTrigger className="w-40 font-body text-xs h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="approved">✅ Approved</SelectItem>
                                          <SelectItem value="needs-changes">⚠️ Needs Changes</SelectItem>
                                          <SelectItem value="pending">⏳ Pending</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex gap-1.5">
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingFeedbackId(null)}>
                                          <X size={12} />
                                        </Button>
                                        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveEdit}>
                                          Save
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <MessageSquare size={12} className="text-muted-foreground" />
                                        <span className="font-body text-xs font-medium text-foreground">{fb.author}</span>
                                        <span className="font-body text-xs text-muted-foreground">
                                          {new Date(fb.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`}>
                                          {cfg.icon}
                                          {cfg.label}
                                        </Badge>
                                        <button
                                          onClick={() => handleStartEdit(fb)}
                                          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                          title="Edit feedback"
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      </div>
                                    </div>
                                    <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap">{fb.comment}</p>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Feedback form */}
                      <div className="p-4 space-y-3 bg-background/50">
                        <p className="font-display text-xs font-semibold text-foreground">Add Review</p>
                        <Input
                          placeholder="Your name"
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          className="font-body text-sm"
                        />
                        <Textarea
                          placeholder="Write your feedback, notes, or requested changes..."
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          className="font-body text-sm resize-none"
                        />
                        <div className="flex items-center justify-between gap-3">
                          <Select value={status} onValueChange={(v) => setStatus(v as TaskFeedback["status"])}>
                            <SelectTrigger className="w-44 font-body text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="approved">✅ Approved</SelectItem>
                              <SelectItem value="needs-changes">⚠️ Needs Changes</SelectItem>
                              <SelectItem value="pending">⏳ Pending Review</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleSubmit}
                            disabled={!comment.trim()}
                            size="sm"
                            className="font-body gap-1.5"
                          >
                            <Send size={12} />
                            Submit
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
