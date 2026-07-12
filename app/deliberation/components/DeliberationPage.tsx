"use client";

import { RhetoricProvider } from "@/components/rhetoric/RhetoricContext";
import { DialogueTargetProvider } from "@/components/dialogue/DialogueTargetContext";
import DeepDivePanel from "@/components/deepdive/DeepDivePanelV2";

type Props = {
  deliberationId?: string;
  hostName?: string | null;
};

export default function DeliberationReader({
  deliberationId,
  hostName,
}: Props) {
  return (
    <div className="relative">
      {deliberationId && (
        <section className="relative isolate">
          {/* Mirror the article layout's column exactly */}
          <div className="flex flex-col justify-center items-center mx-auto px-3 gap-6">
            <RhetoricProvider>
              <DialogueTargetProvider>
                <DeepDivePanel
                  deliberationId={deliberationId}
                  containerClassName="flex flex-col justify-start w-full gap-6"
                  hostName={hostName}
                />
              </DialogueTargetProvider>
            </RhetoricProvider>
          </div>
        </section>
      )}
    </div>
  );
}
