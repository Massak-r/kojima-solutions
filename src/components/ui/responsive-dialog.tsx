import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for shadcn `Dialog`. On mobile (<768 px) it renders as a
 * vaul bottom-sheet `Drawer`; on desktop it falls back to the centered modal.
 * Mirrors the same compound-component API so swapping at call sites is a
 * straightforward Dialog→ResponsiveDialog rename.
 */

const Ctx = React.createContext<{ isMobile: boolean }>({ isMobile: false });

interface ResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <Ctx.Provider value={{ isMobile }}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </Ctx.Provider>
  );
}

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Set `false` for full-bleed designs (gradient headers, etc.) — drops the
   * horizontal padding the mobile drawer adds by default. Consumers then
   * own padding for each section. */
  padded?: boolean;
}

export const ResponsiveDialogContent = React.forwardRef<
  HTMLDivElement,
  ResponsiveDialogContentProps
>(({ className, children, padded = true, ...props }, ref) => {
  const { isMobile } = React.useContext(Ctx);
  if (isMobile) {
    return (
      <DrawerContent
        ref={ref}
        className={cn("font-body max-h-[92vh]", className)}
        {...props}
      >
        {/* Scrollable body — vaul ignores drag attempts that originate inside
            this region, so Radix selects/inputs don't fight the drawer. */}
        <div
          className={cn("overflow-y-auto", padded && "px-4 pb-5")}
          data-vaul-no-drag
        >
          {children}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent ref={ref} className={className} {...props}>
      {children}
    </DialogContent>
  );
});
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

export function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile } = React.useContext(Ctx);
  if (isMobile) {
    return <div className={cn("grid gap-1.5 pt-2 pb-3 text-left", className)} {...props} />;
  }
  return <DialogHeader className={className} {...props} />;
}

export const ResponsiveDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(Ctx);
  const Cmp = isMobile ? DrawerTitle : DialogTitle;
  return <Cmp ref={ref} className={className} {...props} />;
});
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

export const ResponsiveDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { isMobile } = React.useContext(Ctx);
  const Cmp = isMobile ? DrawerDescription : DialogDescription;
  return <Cmp ref={ref} className={className} {...props} />;
});
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

export function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isMobile } = React.useContext(Ctx);
  if (isMobile) {
    // `flex-col` keeps DOM order: consumers declare buttons as Cancel-first,
    // primary-last, so the primary action lands at the BOTTOM of the
    // bottom-sheet — where the thumb naturally rests.
    return (
      <div
        className={cn(
          "mt-4 flex flex-col gap-2 pt-3 border-t border-border/50 [&>button]:w-full",
          className,
        )}
        {...props}
      />
    );
  }
  return <DialogFooter className={className} {...props} />;
}
