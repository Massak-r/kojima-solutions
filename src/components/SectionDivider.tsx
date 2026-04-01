/**
 * Zen-style section divider — a centered gradient line with
 * three small dots forming a minimal decorative motif.
 */
export default function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-4 select-none" aria-hidden>
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-border/60" />
      <div className="flex items-center gap-1.5 mx-3">
        <span className="w-1 h-1 rounded-full bg-primary/25" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <span className="w-1 h-1 rounded-full bg-primary/25" />
      </div>
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-border/60" />
    </div>
  );
}
