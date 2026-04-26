import { useState, useEffect } from "react";
import {
  Image, Link2, Download, AlignLeft,
  X, ChevronLeft, ChevronRight, ZoomIn, ExternalLink,
} from "lucide-react";
import type { Delivery } from "@/types/project";
import { cn } from "@/lib/utils";

// ── Image Lightbox ────────────────────────────────────────────

export function ImageLightbox({ delivery, initialIndex, onClose }: {
  delivery: Delivery;
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const imgs = (delivery.images?.filter(Boolean).length ? delivery.images! : [delivery.content]).filter(Boolean);
  const total = imgs.length;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft")  setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [total, onClose]);

  const TYPE_ICON: Record<string, React.ReactNode> = {
    image: <Image size={13} className="text-palette-violet" />,
    link:  <Link2 size={13} className="text-primary" />,
    file:  <Download size={13} className="text-palette-amber" />,
    text:  <AlignLeft size={13} className="text-palette-sage" />,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex"
      onClick={onClose}
    >
      {/* Left panel */}
      <div
        className="w-64 shrink-0 bg-black/60 border-r border-white/10 flex flex-col p-5 gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="self-start p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-1.5 mb-3">
            {TYPE_ICON[delivery.type]}
            <span className="font-body text-[10px] uppercase tracking-widest text-white/40">{delivery.type}</span>
          </div>
          <h3 className="font-display text-white text-base font-bold leading-snug mb-2">{delivery.title}</h3>
          {delivery.description && (
            <p className="font-body text-sm text-white/50 leading-relaxed">{delivery.description}</p>
          )}
        </div>

        {/* Thumbnail strip */}
        {total > 1 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
            {imgs.map((url, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "w-12 h-12 rounded-md overflow-hidden border-2 transition-all",
                  i === idx ? "border-white opacity-100" : "border-transparent opacity-40 hover:opacity-70"
                )}
              >
                <img src={url} alt={`${delivery.title} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {total > 1 && (
          <p className="font-body text-xs text-white/30 text-center">{idx + 1} / {total}</p>
        )}
      </div>

      {/* Right: main image */}
      <div
        className="flex-1 flex items-center justify-center relative p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {total > 1 && (
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all z-10"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <img
          src={imgs[idx]}
          alt={`${delivery.title} ${idx + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          style={{ maxHeight: "calc(100vh - 3rem)" }}
        />

        {total > 1 && (
          <button
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-20 transition-all z-10"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Delivery Card ─────────────────────────────────────────────

export function DeliveryCard({ d, onLightbox, isFinal = false }: {
  d: Delivery & { createdAt?: string };
  onLightbox: (index: number) => void;
  isFinal?: boolean;
}) {
  const isLink  = d.type === "link";
  const isImage = d.type === "image";
  const isText  = d.type === "text";
  const imgs    = isImage ? (d.images?.filter(Boolean).length ? d.images! : [d.content]).filter(Boolean) : [];

  const iconBg = isLink ? "bg-primary/10" : isImage ? "bg-palette-violet/10" : isText ? "bg-palette-sage/10" : "bg-palette-amber/10";
  const icon   = isLink  ? <Link2 size={15} className="text-primary" />
               : isImage ? <Image size={15} className="text-palette-violet" />
               : isText  ? <AlignLeft size={15} className="text-palette-sage" />
               :            <Download size={15} className="text-palette-amber" />;

  const inner = (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Multi-image grid */}
      {isImage && imgs.length > 0 && (
        <div className={cn("grid gap-0.5 bg-secondary/20", imgs.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {imgs.slice(0, 4).map((url, i) => {
            const isOverlay = i === 3 && imgs.length > 4;
            return (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLightbox(i); }}
                className="relative aspect-video overflow-hidden group"
              >
                <img src={url} alt={`${d.title} ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                {isOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="font-display text-white font-bold text-lg">+{imgs.length - 3}</span>
                  </div>
                )}
                {!isOverlay && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                    <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="font-display text-sm font-semibold text-foreground truncate">{d.title}</p>
              {isFinal && (
                <span className="font-body text-[9px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 shrink-0">Final</span>
              )}
            </div>
            {d.createdAt && (
              <p className="font-body text-[10px] text-muted-foreground/60 mb-1">
                {new Date(d.createdAt).toLocaleDateString()}
              </p>
            )}
            {d.description && (
              <p className="font-body text-xs text-muted-foreground mb-2 line-clamp-2">{d.description}</p>
            )}
            {isText && d.content && (
              <div className="bg-secondary/40 rounded-lg p-3 mt-1">
                <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{d.content}</p>
              </div>
            )}
            {d.type === "file" && d.content && (
              <span className="inline-flex items-center gap-1.5 font-body text-xs bg-secondary text-foreground px-3 py-1.5 rounded-lg mt-1">
                <Download size={12} /> Télécharger le fichier
              </span>
            )}
            {isLink && (
              <span className="inline-flex items-center gap-1 font-body text-xs text-primary mt-1">
                Ouvrir le lien <ExternalLink size={10} />
              </span>
            )}
            {isImage && imgs.length > 0 && (
              <span className="font-body text-[10px] text-muted-foreground mt-1 inline-block">
                {imgs.length} image{imgs.length > 1 ? "s" : ""} · cliquez pour agrandir
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isLink && d.content) {
    return (
      <a href={d.content} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
        {inner}
      </a>
    );
  }

  return inner;
}
