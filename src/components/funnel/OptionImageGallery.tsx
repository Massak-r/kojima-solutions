import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface OptionImageGalleryProps {
  images: string[];
  alt: string;
  variant: "compact" | "full";
  className?: string;
}

export function OptionImageGallery({ images, alt, variant, className }: OptionImageGalleryProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (images.length === 0) return null;

  // Single image — simple display, no carousel
  if (images.length === 1) {
    return (
      <>
        <div
          className={cn(
            "relative group rounded-lg overflow-hidden bg-secondary/20 cursor-pointer",
            variant === "compact" ? "aspect-video" : "aspect-[16/10]",
            className,
          )}
          onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}
        >
          <img src={images[0]} alt={alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
            <ZoomIn size={variant === "compact" ? 16 : 20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <ImageLightbox
          images={images}
          initialIndex={0}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // Multi-image carousel
  return (
    <>
      <div className={cn("relative group", className)}>
        {/* Main carousel */}
        <div
          ref={emblaRef}
          className={cn(
            "overflow-hidden rounded-lg",
            variant === "compact" ? "aspect-video" : "aspect-[16/10]",
          )}
        >
          <div className="flex h-full">
            {images.map((url, i) => (
              <div
                key={i}
                className="flex-[0_0_100%] min-w-0 relative cursor-pointer bg-secondary/20"
                onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              >
                <img src={url} alt={`${alt} ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                  <ZoomIn size={variant === "compact" ? 14 : 18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
          className={cn(
            "absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white backdrop-blur-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60",
            variant === "compact" ? "w-6 h-6" : "w-8 h-8",
          )}
        >
          <ChevronLeft size={variant === "compact" ? 14 : 18} className="mx-auto" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 text-white backdrop-blur-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60",
            variant === "compact" ? "w-6 h-6" : "w-8 h-8",
          )}
        >
          <ChevronRight size={variant === "compact" ? 14 : 18} className="mx-auto" />
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollTo(i); }}
              className={cn(
                "rounded-full transition-all",
                variant === "compact" ? "w-1.5 h-1.5" : "w-2 h-2",
                i === selectedIndex ? "bg-white scale-110" : "bg-white/50",
              )}
            />
          ))}
        </div>

        {/* Image counter */}
        <div className="absolute top-1.5 right-1.5 bg-black/40 backdrop-blur-sm text-white text-[9px] font-mono px-1.5 py-0.5 rounded-md">
          {selectedIndex + 1}/{images.length}
        </div>
      </div>

      {/* Thumbnail strip (full variant only) */}
      {variant === "full" && images.length > 1 && (
        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "w-14 h-10 rounded-md overflow-hidden shrink-0 border-2 transition-all",
                i === selectedIndex ? "border-primary ring-1 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <img src={url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

// ── Full-screen Lightbox ─────────────────────────────────────

function ImageLightbox({ images, initialIndex, open, onClose }: {
  images: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  // Reset index when opened
  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
      if (e.key === "ArrowRight") setIndex((i) => (i < images.length - 1 ? i + 1 : 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, images.length, onClose]);

  if (!open || images.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-0 bg-black/95 border-none overflow-hidden">
        <div className="relative flex items-center justify-center min-h-[50vh] max-h-[90vh]">
          <img
            src={images[index]}
            alt={`Image ${index + 1}`}
            className="max-w-full max-h-[85vh] object-contain"
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>

          {/* Navigation */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0))}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <ChevronRight size={20} />
              </button>

              {/* Counter */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white text-xs font-mono px-3 py-1 rounded-full">
                {index + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
