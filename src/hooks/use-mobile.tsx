import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Lazy-initialised on the very first render so consumers that pick a
 * different primitive per breakpoint (e.g. ResponsiveDialog → Drawer vs.
 * Dialog) get the right answer immediately instead of mounting the desktop
 * variant and remounting once the effect runs.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
