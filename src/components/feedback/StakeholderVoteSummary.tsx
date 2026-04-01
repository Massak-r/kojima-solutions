import { Users, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StakeholderVote, VoteOption } from "@/types/timeline";

interface Props {
  votes: StakeholderVote[];
  options?: VoteOption[];
  type: "vote" | "validation" | "text" | "file";
}

export function StakeholderVoteSummary({ votes, options, type }: Props) {
  if (votes.length === 0) return null;

  const votesWithComments = votes.filter((v) => v.comment);

  return (
    <div className="bg-violet-50/40 border border-violet-200/30 rounded-lg p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-body font-semibold text-violet-700">
        <Users size={12} />
        Avis des parties prenantes ({votes.length})
      </div>

      {/* Vote-type tally */}
      {type === "vote" && options && options.length > 0 && (() => {
        const counts: Record<string, { count: number; names: string[] }> = {};
        for (const opt of options) counts[opt.id] = { count: 0, names: [] };
        for (const v of votes) {
          if (v.optionId && counts[v.optionId]) {
            counts[v.optionId].count++;
            counts[v.optionId].names.push(v.name);
          }
        }
        const total = votes.filter((v) => v.optionId).length;

        return (
          <div className="space-y-1.5">
            {options.map((opt) => {
              const data = counts[opt.id] || { count: 0, names: [] };
              const pct = total > 0 ? Math.round((data.count / total) * 100) : 0;
              return (
                <div key={opt.id} className="text-xs font-body">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn("font-medium", opt.isRecommended && "font-semibold")}>
                      {opt.label}
                    </span>
                    <span className="text-violet-600/70">
                      {data.count} vote{data.count !== 1 ? "s" : ""} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden mb-0.5">
                    <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {data.names.length > 0 && (
                    <p className="text-[10px] text-violet-500/70">
                      {data.names.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Validation-type tally */}
      {type === "validation" && (() => {
        const approved = votes.filter((v) => v.vote === "approve");
        const revised = votes.filter((v) => v.vote === "revise");
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 text-xs font-body">
              <span className="flex items-center gap-1">
                <Badge className="text-[8px] bg-emerald-50 text-emerald-600 border-emerald-200">
                  Approuve
                </Badge>
                <span className="font-medium text-emerald-700">{approved.length}</span>
              </span>
              <span className="flex items-center gap-1">
                <Badge className="text-[8px] bg-amber-50 text-amber-600 border-amber-200">
                  A reviser
                </Badge>
                <span className="font-medium text-amber-700">{revised.length}</span>
              </span>
            </div>
            <div className="space-y-1">
              {votes.map((v) => (
                <div key={v.id} className="flex items-center gap-1.5 text-[11px] font-body">
                  <span className="font-medium text-foreground/80">{v.name}</span>
                  {v.vote === "approve" && <Badge className="text-[7px] bg-emerald-50 text-emerald-600">Approuve</Badge>}
                  {v.vote === "revise" && <Badge className="text-[7px] bg-amber-50 text-amber-600">A reviser</Badge>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Comments */}
      {votesWithComments.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-violet-200/30">
          <p className="text-[10px] font-body font-semibold text-violet-600/70 flex items-center gap-1">
            <MessageSquare size={9} /> Commentaires
          </p>
          {votesWithComments.map((v) => (
            <div key={v.id} className="text-[11px] font-body">
              <span className="font-medium text-foreground/70">{v.name} :</span>{" "}
              <span className="text-foreground/60">{v.comment}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
