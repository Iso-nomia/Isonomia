// components/agora/CommunityDefenseMenu.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Target, Shield } from "lucide-react";
import { NonCanonicalResponseForm } from "./NonCanonicalResponseForm";
import { CommunityResponsesTab } from "./CommunityResponsesTab";
import { CommunityResponseBadge } from "./CommunityResponseBadge";

import "./deliberation-styles.css";

type ClaimRef = { id: string; text: string };
type Prem = { id: string; text: string };

export function CommunityDefenseMenu({
  deliberationId,
  authorId,
  target,
  onDone,
}: {
  deliberationId: string;
  authorId: string;
  target: { id: string; conclusion: ClaimRef; premises: Prem[] };
  onDone?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [helpDefendOpen, setHelpDefendOpen] = React.useState(false);
  const titleRef = React.useRef<HTMLDivElement | null>(null);

  const handleOpenChange = React.useCallback((v: boolean) => {
    setOpen(v);
  }, []);

  const handleDone = React.useCallback(() => {
    setOpen(false);
    onDone?.();
  }, [onDone]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="
            inline-flex btnv2--emerald  items-center gap-2 px-2 py-2 rounded-lg text-xs
            
            text-slate-800 font-medium
           
            transition-all duration-200
            
          "
        >
          <Users className="w-3 h-3" />
          Community Defense
          <CommunityResponseBadge
            targetType="argument"
            targetId={target.id}
            className="ml-1"
          />
        </button>
      </DialogTrigger>

        
      <DialogContent
        className="max-w-3xl max-h-screen overflow-hidden panel-edge-blue rounded-2xl
       bg-gradient-to-b from-sky-100/55 via-white/50 to-sky-50/50 backdrop-blur-xl shadow-2xl px-6 py-8"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >

        {/* <div className="absolute inset-0 bg-gradient-to-b from-slate-900/5 via-transparent to-slate-900/10 pointer-events-none" /> */}
          {/* Water droplet decorations - light mode */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-sky-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-cyan-400/8 rounded-full blur-3xl animate-pulse delay-1000" />
        <DialogHeader className="space-y-2 pb-4 border-b border-white/80">
          <DialogTitle
            ref={titleRef as any}
            tabIndex={-1}
            className= "text-3xl font-bold text-slate-900 flex items-center gap-3 drop-shadow-sm">
          
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100">
              <Shield className="w-5 h-5 text-emerald-700" />
            </div>
            <span className="tracking-wide bg-gradient-to-r from-teal-900 via-emerald-900 to-teal-900 bg-clip-text text-transparent text-3xl">

            Community Defense
            </span>
          </DialogTitle>
           <span className="ml-1 font-medium bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 bg-clip-text text-transparent  text-sm">
            Help defend this argument by providing responses to challenges, or view community contributions.
          </span>
          
        </DialogHeader>

        {/* Target summary card */}
        <div className="py-3 px-3  backdrop-blur-xl bg-white/70 rounded-xl shadow-md">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Target className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-sm font-semibold text-slate-900">Target Argument</div>
              <div className="text-sm text-slate-700 ml-1 font-medium">
                {target.conclusion.text}
              </div>
              {target.premises?.length > 0 && (
                <div className="space-y-1 pl-2 ml-2 border-l border-slate-600">
                  {target.premises.map((p) => (
                    <div key={p.id} className="text-xs text-slate-700">
                      • {p.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Help Defend Button */}
          <div className="flex items-center shadow-md justify-between p-4 bg-white/50 backdrop-blur-xl rounded-xl ">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Shield className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Contribute a Defense
                </div>
                <div className="text-xs text-slate-600">
                  Help the author respond to challenges
                </div>
              </div>
            </div>
            <button
              onClick={() => setHelpDefendOpen(true)}
              className="
                inline-flex btnv2 items-center gap-2 px-4 py-2 rounded-xl text-sm
                bg-gradient-to-r from-emerald-600 to-teal-600
                hover:from-emerald-600 hover:to-teal-700
                text-white font-medium
                shadow-sm hover:shadow-md
                transition-all duration-200
              "
            >
              <Shield className="w-4 h-4" />
              Help Defend This Argument
            </button>
          </div>

          {/* Community Responses */}
          <div className="bg-white/70 shadow-md rounded-xl border border-slate-200 p-2">
            <CommunityResponsesTab
              targetType="argument"
              targetId={target.id}
              status="PENDING,APPROVED,EXECUTED"
            />
          </div>
        </div>

        {/* Help Defend Modal */}
        {helpDefendOpen && (
          <NonCanonicalResponseForm
            open={helpDefendOpen}
            onOpenChange={setHelpDefendOpen}
            deliberationId={deliberationId}
            targetType="argument"
            targetId={target.id}
            targetLabel={target.conclusion.text}
            onSuccess={() => {
              setHelpDefendOpen(false);
              // Trigger refresh of community responses
              window.dispatchEvent(
                new CustomEvent("non-canonical:refresh", {
                  detail: { targetType: "argument", targetId: target.id },
                })
              );
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
