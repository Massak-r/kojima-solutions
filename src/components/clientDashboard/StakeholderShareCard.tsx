import { useState } from "react";
import { Users, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function StakeholderShareCard({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/project/s/${shareToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable / blocked — silently ignore.
    }
  };

  return (
    <div className="bg-violet-50/60 border border-violet-200/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-violet-600 shrink-0" />
        <h3 className="font-display text-xs font-bold text-violet-800">Invitez vos parties prenantes</h3>
      </div>
      <p className="text-[11px] font-body text-violet-700/70 leading-relaxed">
        Partagez ce lien pour que votre equipe puisse consulter le parcours et ajouter des commentaires.
        Seul vous pouvez valider les decisions.
      </p>
      <button
        onClick={handleCopy}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-body font-medium transition-all",
          copied
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-white text-violet-700 border border-violet-200/60 hover:border-violet-400 hover:bg-violet-50"
        )}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? "Lien copie !" : "Copier le lien de partage"}
      </button>
      <p className="text-[9px] font-body text-violet-500/60 text-center">
        Vue en lecture seule. Les parties prenantes peuvent commenter mais pas valider.
      </p>
    </div>
  );
}
