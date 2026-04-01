import { useState } from 'react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;                        // 0 = unrated, 1–5
  onChange?: (v: number) => void;      // undefined = read-only
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, size = 'sm' }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const px = size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onMouseEnter={() => onChange && setHovered(n)}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={cn(
            px,
            'leading-none transition-colors',
            onChange ? 'cursor-pointer' : 'cursor-default pointer-events-none',
            n <= display ? 'text-amber-400' : 'text-muted-foreground/25',
          )}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
