import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** When this changes, a previously-caught error is cleared (e.g. on route change). */
  resetKey?: string;
}
interface State {
  hasError: boolean;
}

/**
 * Catches render-time errors in the page tree so a single bad render shows a
 * recoverable card instead of a blank white PWA. The app shell (header, nav,
 * FABs) stays mounted because this wraps only the routed page content.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prev: Props) {
    // Recover automatically when the user navigates to another route.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    // Best-effort: log to the console (no external/Anthropic reporting).
    console.error("ErrorBoundary caught a render error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center rounded-2xl border border-border bg-card shadow-card p-6 space-y-4">
          <div className="mx-auto h-11 w-11 rounded-full bg-palette-amber/15 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-palette-amber-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground">
              Cette page n'a pas pu s'afficher. Tes données sont intactes — recharge ou reviens à l'accueil.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            <Button onClick={() => window.location.reload()} className="gap-1.5">
              <RotateCw className="h-4 w-4" /> Recharger
            </Button>
            <Button variant="outline" asChild className="gap-1.5">
              <a href="/home"><Home className="h-4 w-4" /> Accueil</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/** Route-aware wrapper: clears the error when the path changes. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

export default ErrorBoundary;
