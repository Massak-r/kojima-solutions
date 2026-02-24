import { useParams, useNavigate } from "react-router-dom";
import { useProjects, TaskFeedback } from "@/contexts/ProjectsContext";
import { ProjectStepNav } from "@/components/ProjectStepNav";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  MessageSquarePlus,
  FileUp,
  Circle,
  ChevronDown,
  ChevronUp,
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

const COLOR_BORDER: Record<string, string> = {
  primary: "border-primary/30",
  accent: "border-accent/30",
  secondary: "border-border",
  rose: "border-palette-rose/30",
  sage: "border-palette-sage/30",
  amber: "border-palette-amber/30",
  violet: "border-palette-violet/30",
};

export default function ProjectFeedback() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, addFeedback, updateFeedback, respondToFeedbackRequest } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [reviewingTask, setReviewingTask] = useState<string | null>(null);
  const [author, setAuthor] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<TaskFeedback["status"]>("pending");
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editStatus, setEditStatus] = useState<TaskFeedback["status"]>("pending");
  const [requestResponses, setRequestResponses] = useState<Record<string, string>>({});

  const shareUrl = `${window.location.origin}/client/${id}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Client link copied!", description: "Share this link with your client." });
  }, [shareUrl, toast]);

  const handleSubmitReview = useCallback((taskId: string) => {
    if (!comment.trim()) return;
    addFeedback(id!, taskId, {
      taskId,
      author: author.trim() || "Anonymous",
      comment: comment.trim(),
      status,
    });
    setComment("");
    setStatus("pending");
    setReviewingTask(null);
    toast({ title: "Review submitted" });
  }, [id, author, comment, status, addFeedback, toast]);

  const handleStartEdit = useCallback((fb: TaskFeedback) => {
    setEditingFeedbackId(fb.id);
    setEditComment(fb.comment);
    setEditStatus(fb.status);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingFeedbackId || !editComment.trim()) return;
    updateFeedback(id!, editingFeedbackId, { comment: editComment.trim(), status: editStatus });
    setEditingFeedbackId(null);
    toast({ title: "Review updated" });
  }, [id, editingFeedbackId, editComment, editStatus, updateFeedback, toast]);

  const handleRespondToRequest = useCallback((taskId: string, requestId: string) => {
    const response = requestResponses[requestId];
    if (!response?.trim()) return;
    respondToFeedbackRequest(id!, taskId, requestId, response.trim());
    setRequestResponses((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    toast({ title: "Response recorded" });
  }, [id, requestResponses, respondToFeedbackRequest, toast]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl text-foreground/50 mb-4">Project not found</p>
          <Button onClick={() => navigate("/projects")} variant="outline">
            <ArrowLeft size={14} className="mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);
  const feedbacks = project.feedbacks || [];
  const totalPendingRequests = sorted.reduce((acc, task) =>
    acc + (task.feedbackRequests || []).filter((r) => !r.resolved).length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/projects")}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft size={16} className="mr-2" /> Dashboard
          </Button>
          <Button variant="ghost" onClick={handleCopyLink}
            className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 text-xs gap-1.5">
            <Copy size={14} /> Copy Client Link
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
              <p className="font-display text-sm font-semibold text-foreground">Client Dashboard Link</p>
              <p className="font-body text-xs text-muted-foreground">Share with your client for progress & validation</p>
            </div>
          </div>
          <code className="font-body text-xs bg-card border border-border rounded px-3 py-1.5 text-foreground/70 max-w-xs truncate">
            {shareUrl}
          </code>
        </div>

        {/* Blocking requests alert */}
        {totalPendingRequests > 0 && (
          <div className="bg-palette-amber/10 border border-palette-amber/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle size={18} className="text-palette-amber mt-0.5 shrink-0" />
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                {totalPendingRequests} pending client action{totalPendingRequests > 1 ? "s" : ""}
              </p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Project progress is waiting on client responses. Check the client dashboard.
              </p>
            </div>
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">Admin review &amp; client requests</p>

        {sorted.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No deliverables yet. Add tasks on the Roadmap.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((task, i) => {
              const taskFeedbacks = feedbacks.filter((f) => f.taskId === task.id);
              const pendingRequests = (task.feedbackRequests || []).filter((r) => !r.resolved);
              const resolvedRequests = (task.feedbackRequests || []).filter((r) => r.resolved);
              const subtasks = task.subtasks || [];
              const completedCount = subtasks.filter((s) => s.completed).length;
              const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
              const isExpanded = expandedTask === task.id;

              return (
                <div key={task.id} className={`bg-card border rounded-lg overflow-hidden ${COLOR_BORDER[task.color || "primary"]}`}>
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${COLOR_MAP[task.color || "primary"]}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {pendingRequests.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 gap-1">
                              <AlertTriangle size={9} /> {pendingRequests.length} pending
                            </Badge>
                          )}
                          {taskFeedbacks.length > 0 && (
                            <span className="font-body text-xs text-muted-foreground">{taskFeedbacks.length} review{taskFeedbacks.length > 1 ? "s" : ""}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{task.dateLabel}</span>
                          {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                        </div>
                      </div>
                      {subtasks.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="font-body text-[10px] text-muted-foreground">{completedCount}/{subtasks.length}</span>
                        </div>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border">
                      {task.description && (
                        <div className="px-4 pt-3 pb-2">
                          <RichText text={task.description} className="text-foreground/70 text-xs" />
                        </div>
                      )}

                      {subtasks.length > 0 && (
                        <div className="px-4 py-3 space-y-1.5 border-t border-border/50">
                          <p className="font-display text-xs font-semibold text-muted-foreground mb-2">Subtasks</p>
                          {subtasks.map((st) => (
                            <div key={st.id} className="flex items-center gap-2 font-body">
                              {st.completed
                                ? <CheckCircle2 size={14} className="text-palette-sage flex-shrink-0" />
                                : <Circle size={14} className="text-muted-foreground flex-shrink-0" />}
                              <span className={st.completed ? "text-foreground/50 line-through text-xs" : "text-foreground text-xs"}>{st.title}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {pendingRequests.length > 0 && (
                        <div className="px-4 py-3 space-y-3 bg-palette-amber/5 border-t border-palette-amber/20">
                          <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <MessageSquarePlus size={13} className="text-palette-amber" /> Pending Client Actions
                          </p>
                          {pendingRequests.map((req) => (
                            <div key={req.id} className="bg-card border border-palette-amber/20 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {req.type === "file" ? <FileUp size={12} className="text-palette-amber" /> : <MessageSquarePlus size={12} className="text-palette-amber" />}
                                <span className="font-body text-xs font-medium">{req.type === "file" ? "File Requested" : "Feedback Requested"}</span>
                              </div>
                              <p className="font-body text-xs text-foreground/70 mb-2">{req.message}</p>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Record client's response…"
                                  value={requestResponses[req.id] || ""}
                                  onChange={(e) => setRequestResponses((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                  className="text-xs h-8"
                                />
                                <Button size="sm" disabled={!requestResponses[req.id]?.trim()}
                                  onClick={() => handleRespondToRequest(task.id, req.id)}
                                  className="h-8 text-xs gap-1">
                                  <Send size={10} /> Mark Done
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {resolvedRequests.length > 0 && (
                        <div className="px-4 py-3 border-t border-border/50">
                          <p className="font-display text-xs font-semibold text-muted-foreground mb-2">Resolved</p>
                          {resolvedRequests.map((req) => (
                            <div key={req.id} className="flex items-start gap-2 text-xs font-body text-foreground/60 mb-1">
                              <CheckCircle2 size={13} className="text-palette-sage mt-0.5 shrink-0" />
                              <span>{req.message} → <em>{req.response}</em></span>
                            </div>
                          ))}
                        </div>
                      )}

                      {taskFeedbacks.length > 0 && (
                        <div className="px-4 py-3 space-y-2 bg-secondary/10 border-t border-border/50">
                          <p className="font-display text-xs font-semibold text-muted-foreground">Reviews</p>
                          {taskFeedbacks.map((fb) => {
                            const cfg = STATUS_CONFIG[fb.status];
                            const isEditing = editingFeedbackId === fb.id;
                            return (
                              <div key={fb.id} className="bg-card border border-border rounded-lg p-3">
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <Textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={2} className="font-body text-sm resize-none" />
                                    <div className="flex items-center justify-between gap-2">
                                      <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskFeedback["status"])}>
                                        <SelectTrigger className="w-40 font-body text-xs h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="approved">✅ Approved</SelectItem>
                                          <SelectItem value="needs-changes">⚠️ Needs Changes</SelectItem>
                                          <SelectItem value="pending">⏳ Pending</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <div className="flex gap-1.5">
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingFeedbackId(null)}><X size={12} /></Button>
                                        <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>Save</Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <MessageSquare size={12} className="text-muted-foreground" />
                                        <span className="font-body text-xs font-medium">{fb.author}</span>
                                        <span className="font-body text-xs text-muted-foreground">{new Date(fb.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <Badge variant="outline" className={`text-[10px] gap-1 ${cfg.className}`}>{cfg.icon}{cfg.label}</Badge>
                                        <button onClick={() => handleStartEdit(fb)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"><Pencil size={11} /></button>
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

                      {reviewingTask === task.id ? (
                        <div className="px-4 py-4 space-y-3 bg-background/50 border-t border-border/50">
                          <p className="font-display text-xs font-semibold text-foreground">Add Review</p>
                          <Input placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} className="font-body text-sm" />
                          <Textarea placeholder="Write your feedback, notes, or requested changes..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="font-body text-sm resize-none" />
                          <div className="flex items-center justify-between gap-3">
                            <Select value={status} onValueChange={(v) => setStatus(v as TaskFeedback["status"])}>
                              <SelectTrigger className="w-44 font-body text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="approved">✅ Approved</SelectItem>
                                <SelectItem value="needs-changes">⚠️ Needs Changes</SelectItem>
                                <SelectItem value="pending">⏳ Pending Review</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="font-body text-xs" onClick={() => setReviewingTask(null)}>Cancel</Button>
                              <Button onClick={() => handleSubmitReview(task.id)} disabled={!comment.trim()} size="sm" className="font-body gap-1.5">
                                <Send size={12} /> Submit
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 border-t border-border/50">
                          <Button size="sm" variant="outline" className="font-body text-xs gap-1.5 w-full"
                            onClick={() => { setReviewingTask(task.id); setComment(""); setStatus("pending"); }}>
                            <MessageSquare size={12} /> Add Review
                          </Button>
                        </div>
                      )}
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
