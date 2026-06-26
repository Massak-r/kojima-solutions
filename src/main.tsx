import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Force check for updates immediately
      reg.update().catch(() => {});

      // Listen for new service worker versions
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // A new version is ready and waiting. Do NOT auto-skip/reload here —
            // that can reload mid-task (losing an in-flight capture). Surface the
            // "Mettre à jour" banner; the user's tap drives SKIP_WAITING, then
            // the controllerchange listener below reloads into the new bundle.
            window.dispatchEvent(
              new CustomEvent('sw-update-available', { detail: { registration: reg } })
            );
          }
        });
      });
    });

    // When a new SW takes control, reload so the page runs the new JS bundle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}
