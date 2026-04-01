import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  MessageSquare, AlertTriangle, CheckCircle2, Copy,
  ExternalLink, Send, Pencil, X, FileUp, Circle, ChevronDown, ChevronUp,
  Image, Vote, PlusCircle, Trash2, Upload, Link2, Type, Package, CircleDot,
  RotateCcw, Clock,
} from "lucide-react";
import { SubtaskManager } from "@/components/SubtaskManager";
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { VoteOption, FeedbackRequest } from "@/types/timeline";
import { Delivery } from "@/types/project";
import { uploadImage } from "@/api/projects";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary", accent: "bg-accent", secondary: "bg-secondary",
  rose: "bg-palette-rose", sage: "bg-palette-sage", amber: "bg-palette-amber", violet: "bg-palette-violet",
};

const COLOR_BORDER: Record<string, string> = {
  primary: "border-primary/30", accent: "border-accent/30", secondary: "border-border",
  rose: "border-palette-rose/30", sage: "border-palette-sage/30",
  amber: "border-palette-amber/30", violet: "border-palette-violet/30",
};

type RequestType = "text" | "file" | "validation" | "vote";

const REQUEST_TYPE_CONFIG: Record<RequestType, { label: string; icon: React.ReactNode; description: string }> = {
  text:       { label: "Text Response",  icon: <MessageSquare size={14} />, description: "Client writes a text answer" },
  file:       { label: "File / Link",    icon: <FileUp size={14} />,        description: "Client uploads a file or pastes a link" },
  validation: { label: "Image Approval", icon: <Image size={14} />,         description: "Show image(s) \xe2\x80\x94 client approves or requests changes" },
  vote:       { label: "Version Vote",   icon: <Vote size={14} />,          description: "Show named options \xe2\x80\x94 client picks their favourite" },
};

type DeliveryType = "link" | "image" | "text" | "file";

const DELIVERY_TYPE_CONFIG: Record<DeliveryType, { label: string; icon: React.ReactNode; contentLabel: string; placeholder: string }> = {
  link:  { label: "Link",  icon: <Link2 size={14} />,    contentLabel: "URL",         placeholder: "https://\xe2\x80\xa6" },
  image: { label: "Image", icon: <Image size={14} />,    contentLabel: "Image URL",   placeholder: "https://\xe2\x80\xa6/image.png" },
  text:  { label: "Text",  icon: <Type size={14} />,     contentLabel: "Content",     placeholder: "Write your message here\xe2\x80\xa6" },
  file:  { label: "File",  icon: <Package size={14} />,  contentLabel: "File URL",    placeholder: "https://drive.google.com/\xe2\x80\xa6" },
};

// -- Image Upload Input ------------------------------------------------------------

function ImageUploadInput({ onUrl, placeholder = "Paste image URL or upload" }: { onUrl: (url: string) => void; placeholder?: string }) {
  const [url, setUrl]           = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);
  const { toast }               = useToast();

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      setUrl(imageUrl);
      onUrl(imageUrl);
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Upload failed", description: "Check server connection", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [onUrl, toast]);

  return (
    <div className="flex gap-2 items-center">
      <Input
        placeholder={placeholder}
        value={url}
        onChange={(e) => { setUrl(e.target.value); onUrl(e.target.value); }}
        className="text-xs h-8 flex-1"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Upload image"
        className="p-1.5 rounded border border-border hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
      >
        <Upload size={14} className={uploading ? "animate-pulse" : ""} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// -- New Request Form -----------------------------------------------------------

function NewRequestForm({ onAdd, onCancel, initialType, initialMessage, initialImages, initialOptions, initialDeadline, initialRevisionLimit, label }: {
  onAdd: (r: { type: RequestType; message: string; images?: string[]; options?: VoteOption[]; deadline?: string; revisionLimit?: number; guidedQuestions?: import("@/types/timeline").GuidedQuestion[] }) => void;
  onCancel: () => void;
  initialType?: RequestType;
  initialMessage?: string;
  initialImages?: string[];
  initialOptions?: VoteOption[];
  initialDeadline?: string;
  initialRevisionLimit?: number;
  label?: string;
}) {
  const [type, setType]       = useState<RequestType>(initialType ?? "text");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [images, setImages]   = useState<string[]>(initialImages && initialImages.length > 0 ? initialImages : [""]);
  const [options, setOptions] = useState<VoteOption[]>(initialOptions && initialOptions.length >= 2 ? initialOptions : [
    { id: crypto.randomUUID(), label: "Version A", description: "", imageUrl: "" },
    { id: crypto.randomUUID(), label: "Version B", description: "", imageUrl: "" },
  ]);
  const [deadline, setDeadline]           = useState(initialDeadline ?? "");
  const [revisionLimit, setRevisionLimit] = useState<string>(initialRevisionLimit != null ? String(initialRevisionLimit) : "");
  const [showAdvanced, setShowAdvanced]   = useState(!!(initialDeadline || initialRevisionLimit));
  const [guidedQuestions, setGuidedQuestions] = useState<{ id: string; question: string; type: "text" | "rating" | "checkbox" | "yesno"; options: string; required: boolean }[]>([]);
  const [showGuided, setShowGuided] = useState(false);

  const canSubmit = message.trim() && (
    type === "text" || type === "file" ||
    (type === "validation" && images.some((u) => u.trim())) ||
    (type === "vote" && options.filter((o) => o.label.trim()).length >= 2)
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: Parameters<typeof onAdd>[0] = { type, message: message.trim() };
    if (type === "validation") payload.images  = images.filter((u) => u.trim());
    if (type === "vote") payload.options = options.filter((o) => o.label.trim()).map((o) => ({
      ...o,
      images: (o.images && o.images.length > 0) ? o.images : (o.imageUrl ? [o.imageUrl] : undefined),
    })) as VoteOption[];
    if (deadline.trim()) payload.deadline = deadline.trim();
    if (revisionLimit.trim()) payload.revisionLimit = parseInt(revisionLimit, 10) || undefined;
    if (showGuided && guidedQuestions.length > 0) {
      payload.guidedQuestions = guidedQuestions
        .filter((gq) => gq.question.trim())
        .map((gq) => ({
          id: gq.id,
          question: gq.question,
          type: gq.type,
          options: gq.type === "checkbox" ? gq.options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          required: gq.required,
        }));
    }
    onAdd(payload);
  };

  return (
    <div className="p-4 space-y-4 bg-background/60 border-t border-border/50">
      <p className="font-display text-xs font-semibold text-foreground">{label ?? "Add Client Request"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(Object.keys(REQUEST_TYPE_CONFIG) as RequestType[]).map((t) => {
          const cfg = REQUEST_TYPE_CONFIG[t];
          return (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors",
                type === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {cfg.icon}
              <div>
                <p className="font-display text-xs font-semibold leading-tight">{cfg.label}</p>
                <p className="font-body text-[10px] opacity-70 mt-0.5">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div>
        <label className="font-body text-xs text-muted-foreground mb-1 block">
          {type === "validation" ? "What should the client review?" :
           type === "vote"       ? "What should the client choose?" : "Question / instruction"}
        </label>
        <Input placeholder="e.g. Please approve this mockup" value={message}
          onChange={(e) => setMessage(e.target.value)} className="text-xs" />
      </div>
      {type === "validation" && (
        <div className="space-y-2">
          <label className="font-body text-xs text-muted-foreground block">Images to show the client</label>
          {images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1">
                <ImageUploadInput placeholder={`Image ${i + 1} URL`}
                  onUrl={(url) => setImages((prev) => prev.map((v, idx) => idx === i ? url : v))} />
              </div>
              {images.length > 1 && (
                <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              {img.trim() && (
                <img src={img} alt="" className="w-8 h-8 rounded object-cover border border-border"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
          ))}
          {images.length < 5 && (
            <button type="button" onClick={() => setImages((prev) => [...prev, ""])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body">
              <PlusCircle size={12} /> Add image
            </button>
          )}
        </div>
      )}
      {type === "vote" && (
        <div className="space-y-2">
          <label className="font-body text-xs text-muted-foreground block">Options (min 2, max 4)</label>
          {options.map((opt, i) => (
            <div key={opt.id} className={cn("bg-secondary/20 rounded-lg p-3 space-y-2", opt.isRecommended && "ring-2 ring-amber-300/50 bg-amber-50/10")}>
              <div className="flex items-center gap-2">
                <Input placeholder={`Option ${i + 1} label`} value={opt.label}
                  onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, label: e.target.value } : o))}
                  className="text-xs h-7 flex-1" />
                <button type="button"
                  onClick={() => setOptions((prev) => prev.map((o, idx) => ({ ...o, isRecommended: idx === i ? !o.isRecommended : false })))}
                  className={cn("p-1 rounded transition-colors", opt.isRecommended ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-400")}
                  title="Mark as recommended"
                >
                  <CircleDot size={14} />
                </button>
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                )}
              </div>
              <Input placeholder="Short description (optional)" value={opt.description || ""}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, description: e.target.value } : o))}
                className="text-xs h-7" />

              {/* Multi-image upload for option */}
              <div className="space-y-1.5">
                {(opt.images && opt.images.length > 0 ? opt.images : [opt.imageUrl || ""]).map((imgUrl, imgIdx) => (
                  <div key={imgIdx} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <ImageUploadInput
                        placeholder={`Image ${imgIdx + 1} URL`}
                        onUrl={(url) => {
                          setOptions((prev) => prev.map((o, idx) => {
                            if (idx !== i) return o;
                            const imgs = [...(o.images && o.images.length > 0 ? o.images : [o.imageUrl || ""])];
                            imgs[imgIdx] = url;
                            return { ...o, images: imgs, imageUrl: imgs[0] || "" };
                          }));
                        }}
                      />
                    </div>
                    {(opt.images?.length || 1) > 1 && (
                      <button type="button" onClick={() => {
                        setOptions((prev) => prev.map((o, idx) => {
                          if (idx !== i) return o;
                          const imgs = [...(o.images || [])].filter((_, j) => j !== imgIdx);
                          return { ...o, images: imgs, imageUrl: imgs[0] || "" };
                        }));
                      }} className="text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                    )}
                    {imgUrl && imgUrl.trim() && (
                      <img src={imgUrl} alt="" className="w-7 h-7 rounded object-cover border border-border"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    )}
                  </div>
                ))}
                {(opt.images?.length || 1) < 5 && (
                  <button type="button" onClick={() => {
                    setOptions((prev) => prev.map((o, idx) => {
                      if (idx !== i) return o;
                      const imgs = [...(o.images && o.images.length > 0 ? o.images : [o.imageUrl || ""]), ""];
                      return { ...o, images: imgs };
                    }));
                  }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-body">
                    <PlusCircle size={10} /> Add image
                  </button>
                )}
              </div>

              <Input placeholder="External preview link (optional)" value={opt.linkUrl || ""}
                onChange={(e) => setOptions((prev) => prev.map((o, idx) => idx === i ? { ...o, linkUrl: e.target.value } : o))}
                className="text-xs h-7" />
            </div>
          ))}
          {options.length < 4 && (
            <button type="button"
              onClick={() => setOptions((prev) => [...prev, { id: crypto.randomUUID(), label: `Version ${String.fromCharCode(65 + prev.length)}`, description: "", imageUrl: "" }])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body">
              <PlusCircle size={12} /> Add option
            </button>
          )}
        </div>
      )}

      {/* Guided questions (for text type) */}
      {(type === "text" || type === "file") && (
        <div>
          <button type="button" onClick={() => setShowGuided(!showGuided)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-body mb-2">
            {showGuided ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Guided questions (structured form)
          </button>
          {showGuided && (
            <div className="space-y-2 pl-2 border-l-2 border-primary/20">
              {guidedQuestions.map((gq, i) => (
                <div key={gq.id} className="bg-secondary/20 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input placeholder="Question..." value={gq.question}
                      onChange={(e) => setGuidedQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, question: e.target.value } : q))}
                      className="text-xs h-7 flex-1" />
                    <select
                      value={gq.type}
                      onChange={(e) => setGuidedQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, type: e.target.value as any } : q))}
                      className="text-[10px] h-7 border border-border rounded px-1.5 bg-background"
                    >
                      <option value="text">Text</option>
                      <option value="rating">Rating 1-5</option>
                      <option value="yesno">Yes/No</option>
                      <option value="checkbox">Checkboxes</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                      <input type="checkbox" checked={gq.required}
                        onChange={(e) => setGuidedQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, required: e.target.checked } : q))}
                        className="w-3 h-3" />
                      Req.
                    </label>
                    <button type="button" onClick={() => setGuidedQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                  </div>
                  {gq.type === "checkbox" && (
                    <Input placeholder="Options (comma-separated)" value={gq.options}
                      onChange={(e) => setGuidedQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, options: e.target.value } : q))}
                      className="text-[10px] h-6" />
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setGuidedQuestions((prev) => [...prev, { id: crypto.randomUUID(), question: "", type: "text", options: "", required: false }])}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-body">
                <PlusCircle size={10} /> Add question
              </button>
            </div>
          )}
        </div>
      )}

      {/* Advanced options: deadline + revision limit */}
      <div>
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground font-body">
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Advanced options
        </button>
        {showAdvanced && (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-body text-[10px] text-muted-foreground mb-1 block">Deadline (optional)</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="text-xs h-8" />
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground mb-1 block">Revision rounds (optional)</label>
              <Input type="number" min="1" max="10" placeholder="e.g. 3" value={revisionLimit}
                onChange={(e) => setRevisionLimit(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="text-xs gap-1.5" disabled={!canSubmit} onClick={handleSubmit}>
          <Send size={12} /> {label ? "Save Changes" : "Add Request"}
        </Button>
      </div>
    </div>
  );
}

// -- New Delivery Form ----------------------------------------------------------

function NewDeliveryForm({ onAdd, onCancel, label = "Add Delivery",
  initialType, initialTitle, initialContent, initialImages, initialDescription,
}: {
  onAdd: (d: Omit<Delivery, "id" | "createdAt">) => void;
  onCancel: () => void;
  label?: string;
  initialType?: DeliveryType;
  initialTitle?: string;
  initialContent?: string;
  initialImages?: string[];
  initialDescription?: string;
}) {
  const [type, setType]           = useState<DeliveryType>(initialType ?? "link");
  const [title, setTitle]         = useState(initialTitle ?? "");
  const [content, setContent]     = useState(initialContent ?? "");
  const [images, setImages]       = useState<string[]>(initialImages?.length ? initialImages : [""]);
  const [description, setDesc]    = useState(initialDescription ?? "");
  const cfg = DELIVERY_TYPE_CONFIG[type];

  const canSubmit = type === "image"
    ? title.trim() && images.some((u) => u.trim())
    : title.trim() && content.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (type === "image") {
      const filtered = images.filter((u) => u.trim());
      onAdd({ type, title: title.trim(), content: filtered[0] || "", images: filtered, description: description.trim() || undefined });
    } else {
      onAdd({ type, title: title.trim(), content: content.trim(), description: description.trim() || undefined });
    }
  };

  return (
    <div className="p-4 space-y-3 bg-background/60 border border-border rounded-lg">
      <p className="font-display text-xs font-semibold text-foreground">{label}</p>
      {/* Type pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(DELIVERY_TYPE_CONFIG) as DeliveryType[]).map((t) => {
          const c = DELIVERY_TYPE_CONFIG[t];
          return (
            <button key={t} type="button" onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors",
                type === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              )}
            >
              {c.icon} {c.label}
            </button>
          );
        })}
      </div>
      <Input
        placeholder="Title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xs"
        autoFocus
      />
      {type === "image" ? (
        <div className="space-y-2">
          <label className="font-body text-xs text-muted-foreground block">Images (paste URLs or upload)</label>
          {images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="flex-1">
                <ImageUploadInput
                  placeholder={`Image ${i + 1} URL`}
                  onUrl={(url) => setImages((prev) => prev.map((v, idx) => idx === i ? url : v))}
                />
              </div>
              {images.length > 1 && (
                <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              {img.trim() && (
                <img src={img} alt="" className="w-8 h-8 rounded object-cover border border-border"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
          ))}
          {images.length < 8 && (
            <button type="button" onClick={() => setImages((prev) => [...prev, ""])}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-body">
              <PlusCircle size={12} /> Add image
            </button>
          )}
        </div>
      ) : type === "text" ? (
        <Textarea
          placeholder={cfg.placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="text-xs resize-none"
        />
      ) : (
        <Input
          placeholder={cfg.placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="text-xs"
        />
      )}
      <Input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        className="text-xs"
      />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="text-xs" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="text-xs gap-1.5" disabled={!canSubmit} onClick={handleSubmit}>
          <Package size={12} /> Save Delivery
        </Button>
      </div>
    </div>
  );
}

// -- Main Page ---------------------------------------------------------------

export default function ProjectFeedback() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateProject, respondToFeedbackRequest, addFeedbackRequest, deleteFeedbackRequest, addDelivery, deleteDelivery, updateTaskSubtasks } = useProjects();
  const { toast } = useToast();
  const project = getProject(id!);

  const [expandedTask, setExpandedTask]         = useState<string | null>(null);
  const [requestingTask, setRequestingTask]     = useState<string | null>(null);
  const [requestResponses, setRequestResponses] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl]           = useState<string | null>(null);
  const [editingSlug, setEditingSlug]           = useState(false);
  const [slugValue, setSlugValue]               = useState("");
  // null = closed | "final" = final delivery form | task.id = step delivery for that task
  const [deliveryFormTarget, setDeliveryFormTarget] = useState<string | null>(null);
  const [showTimeline, setShowTimeline]             = useState(false);
  const [editingRequest, setEditingRequest]         = useState<{ taskId: string; request: FeedbackRequest } | null>(null);
  const [editingResolvedRequest, setEditingResolvedRequest] = useState<{ taskId: string; request: FeedbackRequest } | null>(null);
  const [editingDelivery, setEditingDelivery]       = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/client/${project?.clientSlug || id}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Client link copied!" });
  }, [shareUrl, toast]);

  const handleSaveSlug = useCallback(() => {
    const slug = slugValue.trim().toLowerCase();
    if (!slug) return;
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast({ title: "Invalid slug", description: "Use only lowercase letters, numbers, and hyphens.", variant: "destructive" });
      return;
    }
    updateProject(id!, { clientSlug: slug });
    setEditingSlug(false);
    const newUrl = `${window.location.origin}/client/${slug}`;
    navigator.clipboard.writeText(newUrl);
    toast({ title: "Link updated & copied!", description: newUrl });
  }, [slugValue, id, updateProject, toast]);

  const handleRespondToRequest = useCallback((taskId: string, requestId: string) => {
    const response = requestResponses[requestId];
    if (!response?.trim()) return;
    respondToFeedbackRequest(id!, taskId, requestId, response.trim());
    setRequestResponses((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    toast({ title: "Response recorded" });
  }, [id, requestResponses, respondToFeedbackRequest, toast]);

  const handleAddRequest = useCallback((taskId: string, req: { type: RequestType; message: string; images?: string[]; options?: VoteOption[]; deadline?: string; revisionLimit?: number; guidedQuestions?: import("@/types/timeline").GuidedQuestion[] }) => {
    addFeedbackRequest(id!, taskId, req);
    setRequestingTask(null);
    toast({ title: "Client request added" });
  }, [id, addFeedbackRequest, toast]);

  const handleAddDelivery = useCallback((delivery: Omit<Delivery, "id" | "createdAt">, taskId?: string) => {
    addDelivery(id!, { ...delivery, taskId });
    setDeliveryFormTarget(null);
    toast({ title: taskId ? "Step delivery added" : "Final delivery added" });
  }, [id, addDelivery, toast]);

  const [deleteDeliveryConfirm, setDeleteDeliveryConfirm] = useState<string | null>(null);

  const handleDeleteDelivery = useCallback((deliveryId: string) => {
    if (deleteDeliveryConfirm === deliveryId) {
      deleteDelivery(id!, deliveryId);
      toast({ title: "Delivery deleted" });
      setDeleteDeliveryConfirm(null);
    } else {
      setDeleteDeliveryConfirm(deliveryId);
    }
  }, [id, deleteDelivery, toast, deleteDeliveryConfirm]);

  const handleUpdateRequest = useCallback((
    taskId: string,
    requestId: string,
    req: { type: RequestType; message: string; images?: string[]; options?: VoteOption[] },
  ) => {
    deleteFeedbackRequest(id!, taskId, requestId);
    addFeedbackRequest(id!, taskId, req);
    setEditingRequest(null);
    toast({ title: "Request updated" });
  }, [id, deleteFeedbackRequest, addFeedbackRequest, toast]);

  // Edit a resolved request — clears the client response and puts it back as pending
  const handleUpdateResolvedRequest = useCallback((
    taskId: string,
    requestId: string,
    req: { type: RequestType; message: string; images?: string[]; options?: VoteOption[] },
  ) => {
    deleteFeedbackRequest(id!, taskId, requestId);
    addFeedbackRequest(id!, taskId, req);
    setEditingResolvedRequest(null);
    toast({ title: "Request updated, now pending again" });
  }, [id, deleteFeedbackRequest, addFeedbackRequest, toast]);

  // Revert a resolved request back to pending (discard the recorded response)
  const handleRevertRequest = useCallback((taskId: string, req: FeedbackRequest) => {
    deleteFeedbackRequest(id!, taskId, req.id);
    addFeedbackRequest(id!, taskId, {
      type: req.type as RequestType, message: req.message,
      images: req.images, options: req.options,
    });
    toast({ title: "Reverted to pending" });
  }, [id, deleteFeedbackRequest, addFeedbackRequest, toast]);

  // Edit a delivery — delete old and re-add with updated fields, preserving taskId
  const handleUpdateDelivery = useCallback((
    old: Delivery,
    updated: Omit<Delivery, "id" | "createdAt" | "taskId">,
  ) => {
    deleteDelivery(id!, old.id);
    addDelivery(id!, { ...updated, taskId: old.taskId });
    setEditingDelivery(null);
    toast({ title: "Delivery updated" });
  }, [id, deleteDelivery, addDelivery, toast]);

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground font-body">
        Projet introuvable.
      </div>
    );
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);
  const allDeliveries   = project.deliveries || [];
  const finalDeliveries = allDeliveries.filter((d) => !d.taskId);
  const totalPendingRequests = sorted.reduce((acc, task) =>
    acc + (task.feedbackRequests || []).filter((r) => !r.resolved).length, 0);

  const DELIVERY_ICON: Record<string, React.ReactNode> = {
    link:  <Link2 size={14} className="text-primary" />,
    image: <Image size={14} className="text-palette-violet" />,
    text:  <Type size={14} className="text-palette-sage" />,
    file:  <Package size={14} className="text-palette-amber" />,
  };

  return (
    <div>
      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-none">
          {lightboxUrl && <img src={lightboxUrl} alt="Preview" className="w-full h-auto rounded max-h-[85vh] object-contain" />}
        </DialogContent>
      </Dialog>

      {/* Collapsible Project Timeline */}
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <button
          type="button"
          onClick={() => setShowTimeline((v) => !v)}
          className="flex items-center gap-2 text-sm font-display font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <CircleDot size={15} className="text-primary" />
          Project Timeline
          {showTimeline ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {showTimeline && (
          <div className="mb-4">
            {sorted.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground">No timeline steps defined.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[18px] top-2 bottom-2 w-0.5 bg-border rounded-full" />
                <div className="flex flex-col gap-5">
                  {sorted.map((task, i) => (
                    <div key={task.id} className="relative flex gap-4">
                      <div className="relative z-10 flex-shrink-0 mt-1">
                        <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-xs font-body font-bold text-primary-foreground ${COLOR_MAP[task.color || "primary"]}`}>
                          {i + 1}
                        </div>
                      </div>
                      <div className={`flex-1 bg-card rounded-lg border ${COLOR_BORDER[task.color || "primary"]} p-4 shadow-sm`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                          <span className="text-xs font-body text-muted-foreground whitespace-nowrap">{task.dateLabel}</span>
                        </div>
                        {task.description && (
                          <div className="font-body text-xs text-foreground/70 leading-relaxed">
                            <RichText text={task.description} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Share banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <ExternalLink size={18} className="text-primary" />
              <div>
                <p className="font-display text-sm font-semibold text-foreground">Client Dashboard Link</p>
                <p className="font-body text-xs text-muted-foreground">Share with your client</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {editingSlug ? (
                <>
                  <span className="font-body text-xs text-muted-foreground hidden sm:inline">{window.location.origin}/client/</span>
                  <Input
                    value={slugValue}
                    onChange={(e) => setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveSlug(); if (e.key === "Escape") setEditingSlug(false); }}
                    placeholder="e.g. smith-2024"
                    className="h-8 text-xs w-40 font-body"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSaveSlug} disabled={!slugValue.trim()}>
                    <CheckCircle2 size={12} /> Save & Copy
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingSlug(false)}>
                    <X size={12} />
                  </Button>
                </>
              ) : (
                <>
                  <code className="font-body text-xs bg-card border border-border rounded px-3 py-1.5 text-foreground/70 max-w-[220px] truncate">{shareUrl}</code>
                  <button
                    onClick={() => { setSlugValue(project?.clientSlug || ""); setEditingSlug(true); }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    title="Edit custom slug"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Copy link"
                  >
                    <Copy size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
          {project?.clientSlug && (
            <p className="font-body text-[11px] text-muted-foreground/60 mt-2 pl-9">
              Custom slug active: <span className="text-primary/70">{project.clientSlug}</span>
            </p>
          )}
        </div>

        {totalPendingRequests > 0 && (
          <div className="bg-palette-amber/10 border border-palette-amber/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3 mb-2">
              <AlertTriangle size={18} className="text-palette-amber mt-0.5 shrink-0" />
              <p className="font-display text-sm font-semibold text-foreground">
                {totalPendingRequests} pending client action{totalPendingRequests > 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap pl-7">
              {sorted.filter((t) => (t.feedbackRequests || []).some((r) => !r.resolved)).map((t) => {
                const count = (t.feedbackRequests || []).filter((r) => !r.resolved).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setExpandedTask(t.id);
                      setTimeout(() => document.getElementById(`task-${t.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                    }}
                    className="flex items-center gap-1.5 text-xs font-body bg-palette-amber/15 border border-palette-amber/30 text-palette-amber rounded-full px-2.5 py-1 hover:bg-palette-amber/25 transition-colors"
                  >
                    {t.title}
                    <span className="bg-palette-amber/30 rounded-full px-1.5 text-[10px] font-semibold">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">Deliveries &amp; Client Requests</p>

        {/* -- Final Deliveries Section -- */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-primary" />
              <h2 className="font-display text-sm font-semibold text-foreground">Final Deliveries</h2>
              {finalDeliveries.length > 0 && (
                <Badge variant="outline" className="text-[10px]">{finalDeliveries.length}</Badge>
              )}
            </div>
            <Button size="sm" variant="outline" className="text-xs gap-1.5 h-7"
              onClick={() => setDeliveryFormTarget((v) => v === "final" ? null : "final")}>
              <PlusCircle size={12} /> Add Final
            </Button>
          </div>

          {deliveryFormTarget === "final" && (
            <div className="p-4 border-b border-border/50">
              <NewDeliveryForm
                label="Add Final Delivery"
                onAdd={(d) => handleAddDelivery(d, undefined)}
                onCancel={() => setDeliveryFormTarget(null)}
              />
            </div>
          )}

          {finalDeliveries.length === 0 && deliveryFormTarget !== "final" ? (
            <div className="px-4 py-6 text-center">
              <p className="font-body text-xs text-muted-foreground">No final deliveries yet. Push the completed project files or links to your client.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {finalDeliveries.map((d) => (
                editingDelivery === d.id ? (
                  <div key={d.id} className="p-4">
                    <NewDeliveryForm
                      label="Edit Delivery"
                      initialType={d.type as DeliveryType}
                      initialTitle={d.title}
                      initialContent={d.content}
                      initialImages={d.images}
                      initialDescription={d.description}
                      onAdd={(updated) => handleUpdateDelivery(d, updated)}
                      onCancel={() => setEditingDelivery(null)}
                    />
                  </div>
                ) : (
                  <div key={d.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 shrink-0">{DELIVERY_ICON[d.type] ?? <Package size={14} />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-xs font-semibold text-foreground">{d.title}</p>
                      {d.description && (
                        <p className="font-body text-[10px] text-muted-foreground mt-0.5">{d.description}</p>
                      )}
                      {d.type === "image" && (
                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                          {(d.images?.length ? d.images : [d.content]).filter(Boolean).map((url, i) => (
                            <img key={i} src={url} alt={`${d.title} ${i + 1}`}
                              className="h-14 w-20 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => setLightboxUrl(url)}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ))}
                        </div>
                      )}
                      {d.type !== "text" && d.type !== "image" && d.content && (
                        <a href={d.content} target="_blank" rel="noopener noreferrer"
                          className="font-body text-xs text-primary hover:underline truncate block mt-0.5 max-w-xs">
                          {d.content}
                        </a>
                      )}
                      {d.type === "text" && d.content && (
                        <p className="font-body text-xs text-foreground/70 mt-0.5 whitespace-pre-wrap">{d.content}</p>
                      )}
                      {d.createdAt && (
                        <p className="font-body text-[10px] text-muted-foreground/40 mt-1 flex items-center gap-0.5">
                          <Clock size={9} /> {new Date(d.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => setEditingDelivery(d.id)}
                        className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                        title="Edit delivery"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteDelivery(d.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete delivery"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* -- Tasks / Client Requests -- */}
        {sorted.length === 0 ? (
          <p className="text-muted-foreground font-body text-sm">No tasks yet. Add tasks on the Roadmap.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map((task, i) => {
              const pendingRequests  = (task.feedbackRequests || []).filter((r) => !r.resolved);
              const resolvedRequests = (task.feedbackRequests || []).filter((r) => r.resolved);
              const subtasks         = task.subtasks || [];
              const completedCount   = subtasks.filter((s) => s.completed).length;
              const progress         = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;
              const isExpanded       = expandedTask === task.id;
              const stepDeliveryCount = allDeliveries.filter((d) => d.taskId === task.id).length;

              return (
                <div key={task.id} id={`task-${task.id}`} className={cn("bg-card border rounded-lg overflow-hidden", COLOR_BORDER[task.color || "primary"])}>
                  <button onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full text-left p-4 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0", COLOR_MAP[task.color || "primary"])}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-display text-sm font-semibold text-foreground">{task.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {pendingRequests.length > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30 gap-1">
                              <AlertTriangle size={9} /> {pendingRequests.length} pending
                            </Badge>
                          )}
                          {stepDeliveryCount > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-palette-sage/10 text-palette-sage border-palette-sage/30 gap-1">
                              <Package size={9} /> {stepDeliveryCount}
                            </Badge>
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
                      {(subtasks.length > 0 || isExpanded) && (
                        <div className="px-4 py-3 border-t border-border/50">
                          <SubtaskManager
                            subtasks={subtasks}
                            onChange={(updated) => updateTaskSubtasks(id!, task.id, updated)}
                          />
                        </div>
                      )}

                      {pendingRequests.length > 0 && (
                        <div className="px-4 py-3 space-y-3 bg-palette-amber/5 border-t border-palette-amber/20">
                          <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-palette-amber" /> Pending Client Actions
                          </p>
                          {pendingRequests.map((req) => {
                            const rtCfg = REQUEST_TYPE_CONFIG[req.type as RequestType];
                            const isEditing = editingRequest?.taskId === task.id && editingRequest?.request.id === req.id;
                            return isEditing ? (
                              <div key={req.id} className="bg-card border border-primary/20 rounded-lg overflow-hidden">
                                <NewRequestForm
                                  label="Edit Client Request"
                                  initialType={req.type as RequestType}
                                  initialMessage={req.message}
                                  initialImages={req.images}
                                  initialOptions={req.options}
                                  onAdd={(updated) => handleUpdateRequest(task.id, req.id, updated)}
                                  onCancel={() => setEditingRequest(null)}
                                />
                              </div>
                            ) : (
                              <div key={req.id} className="bg-card border border-palette-amber/20 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    {rtCfg?.icon ?? <MessageSquare size={12} className="text-palette-amber" />}
                                    <span className="font-body text-xs font-medium">{rtCfg?.label ?? req.type}</span>
                                    {req.createdAt && (
                                      <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                                        <Clock size={9} /> {new Date(req.createdAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingRequest({ taskId: task.id, request: req })}
                                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                                      title="Edit request"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      onClick={() => deleteFeedbackRequest(id!, task.id, req.id)}
                                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                                      title="Delete request"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                                <p className="font-body text-xs text-foreground/70 mb-2">{req.message}</p>
                                {req.type === "validation" && req.images && req.images.length > 0 && (
                                  <div className="flex gap-1.5 flex-wrap mb-2">
                                    {req.images.map((url, idx) => (
                                      <img key={idx} src={url} alt={`img${idx}`}
                                        className="h-14 w-20 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                                        onClick={() => setLightboxUrl(url)} />
                                    ))}
                                  </div>
                                )}
                                {req.type === "vote" && req.options && (
                                  <div className="flex gap-2 flex-wrap mb-2">
                                    {req.options.map((opt) => (
                                      <span key={opt.id} className="text-xs font-body bg-secondary/40 rounded px-2 py-1 border border-border">{opt.label}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Input placeholder="Record client's response…"
                                    value={requestResponses[req.id] || ""}
                                    onChange={(e) => setRequestResponses((prev) => ({ ...prev, [req.id]: e.target.value }))}
                                    className="text-xs h-8" />
                                  <Button size="sm" disabled={!requestResponses[req.id]?.trim()}
                                    onClick={() => handleRespondToRequest(task.id, req.id)}
                                    className="h-8 text-xs gap-1 shrink-0">
                                    <Send size={10} /> Mark Done
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {resolvedRequests.length > 0 && (
                        <div className="px-4 py-3 border-t border-border/50 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-palette-sage" />
                              Client Responses ({resolvedRequests.length})
                            </p>
                            {(() => {
                              const approvedCount = resolvedRequests.filter((r) => r.response === "approved").length;
                              const changesCount  = resolvedRequests.filter((r) => r.response?.startsWith("changes:")).length;
                              return (
                                <>
                                  {approvedCount > 0 && (
                                    <span className="text-[10px] font-body bg-palette-sage/15 text-palette-sage border border-palette-sage/30 rounded-full px-2 py-0.5">
                                      ✓ {approvedCount} approved
                                    </span>
                                  )}
                                  {changesCount > 0 && (
                                    <span className="text-[10px] font-body bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-2 py-0.5">
                                      ⚠ {changesCount} changes
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          {resolvedRequests.map((req) => {
                            const rtCfg = REQUEST_TYPE_CONFIG[req.type as RequestType];
                            const isApproved  = req.response === "approved";
                            const isChanges   = req.response?.startsWith("changes:");
                            const changesNote = isChanges ? req.response!.replace(/^changes:\s*/, "") : null;
                            const isVote      = req.type === "vote";
                            const isEditingResolved = editingResolvedRequest?.taskId === task.id && editingResolvedRequest?.request.id === req.id;
                            return isEditingResolved ? (
                              <div key={req.id} className="bg-card border border-primary/20 rounded-lg overflow-hidden">
                                <NewRequestForm
                                  label="Edit Request"
                                  initialType={req.type as RequestType}
                                  initialMessage={req.message}
                                  initialImages={req.images}
                                  initialOptions={req.options}
                                  onAdd={(updated) => handleUpdateResolvedRequest(task.id, req.id, updated)}
                                  onCancel={() => setEditingResolvedRequest(null)}
                                />
                              </div>
                            ) : (
                              <div key={req.id} className="bg-palette-sage/5 border border-palette-sage/20 rounded-lg p-3">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  {rtCfg?.icon ?? <MessageSquare size={12} />}
                                  <span className="font-body text-xs font-medium text-muted-foreground">{rtCfg?.label ?? req.type}</span>
                                  <span className="font-body text-xs text-muted-foreground mx-1">&middot;</span>
                                  <span className="font-body text-xs text-muted-foreground truncate">{req.message}</span>
                                </div>
                                {isApproved && (
                                  <div className="flex items-center gap-1.5 bg-palette-sage/15 text-palette-sage border border-palette-sage/30 rounded-md px-3 py-1.5">
                                    <CheckCircle2 size={13} className="shrink-0" />
                                    <span className="font-display text-xs font-semibold">Approved by client</span>
                                  </div>
                                )}
                                {isChanges && (
                                  <div className="bg-palette-amber/10 border border-palette-amber/30 rounded-md px-3 py-2">
                                    <div className="flex items-center gap-1.5 text-palette-amber mb-1">
                                      <AlertTriangle size={12} className="shrink-0" />
                                      <span className="font-display text-xs font-semibold">Changes requested</span>
                                    </div>
                                    <p className="font-body text-xs text-foreground/80">{changesNote}</p>
                                  </div>
                                )}
                                {isVote && !isApproved && !isChanges && (
                                  <div className="flex items-center gap-1.5 bg-palette-violet/10 text-palette-violet border border-palette-violet/30 rounded-md px-3 py-1.5">
                                    <Vote size={12} className="shrink-0" />
                                    <span className="font-display text-xs font-semibold">Voted for: <em className="font-normal not-italic">{req.response}</em></span>
                                  </div>
                                )}
                                {!isApproved && !isChanges && !isVote && req.response && (
                                  <div className="bg-secondary/30 border border-border rounded-md px-3 py-2">
                                    <p className="font-body text-xs text-foreground/80">{req.response}</p>
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-2">
                                  {req.respondedAt && (
                                    <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                                      <Clock size={9} /> {new Date(req.respondedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-0.5 ml-auto">
                                    <button
                                      onClick={() => handleRevertRequest(task.id, req)}
                                      title="Revert to pending"
                                      className="p-1 rounded text-muted-foreground hover:text-palette-amber transition-colors"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                    <button
                                      onClick={() => setEditingResolvedRequest({ taskId: task.id, request: req })}
                                      title="Edit request"
                                      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      onClick={() => deleteFeedbackRequest(id!, task.id, req.id)}
                                      title="Delete request"
                                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Step Deliveries for this task */}
                      {(() => {
                        const stepDeliveries = allDeliveries.filter((d) => d.taskId === task.id);
                        return stepDeliveries.length > 0 ? (
                          <div className="border-t border-border/50">
                            <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                              <Package size={12} className="text-palette-sage" />
                              <p className="font-display text-xs font-semibold text-muted-foreground">Step Deliveries</p>
                            </div>
                            <div className="divide-y divide-border/30">
                              {stepDeliveries.map((d) => (
                                editingDelivery === d.id ? (
                                  <div key={d.id} className="p-4">
                                    <NewDeliveryForm
                                      label="Edit Delivery"
                                      initialType={d.type as DeliveryType}
                                      initialTitle={d.title}
                                      initialContent={d.content}
                                      initialImages={d.images}
                                      initialDescription={d.description}
                                      onAdd={(updated) => handleUpdateDelivery(d, updated)}
                                      onCancel={() => setEditingDelivery(null)}
                                    />
                                  </div>
                                ) : (
                                  <div key={d.id} className="flex items-start gap-3 px-4 py-2.5">
                                    <div className="mt-0.5 shrink-0">{DELIVERY_ICON[d.type] ?? <Package size={13} />}</div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-display text-xs font-semibold text-foreground">{d.title}</p>
                                      {d.description && <p className="font-body text-[10px] text-muted-foreground mt-0.5">{d.description}</p>}
                                      {d.type === "image" && (
                                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                                          {(d.images?.length ? d.images : [d.content]).filter(Boolean).map((url, i) => (
                                            <img key={i} src={url} alt={`${d.title} ${i + 1}`}
                                              className="h-12 w-16 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                                              onClick={() => setLightboxUrl(url)}
                                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                            />
                                          ))}
                                        </div>
                                      )}
                                      {d.type !== "text" && d.type !== "image" && d.content && (
                                        <a href={d.content} target="_blank" rel="noopener noreferrer"
                                          className="font-body text-xs text-primary hover:underline truncate block mt-0.5 max-w-xs">
                                          {d.content}
                                        </a>
                                      )}
                                      {d.type === "text" && d.content && (
                                        <p className="font-body text-xs text-foreground/70 mt-0.5 whitespace-pre-wrap">{d.content}</p>
                                      )}
                                      {d.createdAt && (
                                        <p className="font-body text-[10px] text-muted-foreground/40 mt-1 flex items-center gap-0.5">
                                          <Clock size={9} /> {new Date(d.createdAt).toLocaleDateString()}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button onClick={() => setEditingDelivery(d.id)}
                                        className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                                        title="Edit delivery">
                                        <Pencil size={11} />
                                      </button>
                                      <button onClick={() => handleDeleteDelivery(d.id)}
                                        className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                                        title="Delete delivery">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {deliveryFormTarget === task.id && (
                        <div className="px-4 py-3 border-t border-border/50">
                          <NewDeliveryForm
                            label="Add Step Delivery"
                            onAdd={(d) => handleAddDelivery(d, task.id)}
                            onCancel={() => setDeliveryFormTarget(null)}
                          />
                        </div>
                      )}

                      {requestingTask === task.id ? (
                        <NewRequestForm
                          onAdd={(req) => handleAddRequest(task.id, req)}
                          onCancel={() => setRequestingTask(null)}
                        />
                      ) : deliveryFormTarget !== task.id ? (
                        <div className="px-4 py-3 border-t border-border/50 flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs gap-1.5 flex-1"
                            onClick={() => { setRequestingTask(task.id); }}>
                            <Send size={12} /> Request from Client
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1.5 flex-1"
                            onClick={() => setDeliveryFormTarget(task.id)}>
                            <Package size={12} /> Add Step Delivery
                          </Button>
                        </div>
                      ) : null}
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
