import CreatePredictionPost from "../forms/CreatePredictionPost";
import { DialogContent, DialogHeader } from "@/components/ui/dialog";
import { z } from "zod";
import { PredictionPostValidation } from "@/lib/validations/thread";

interface Props {
  onSubmit: (values: z.infer<typeof PredictionPostValidation>) => void;
}

export default function PredictionMarketModal(_props: Props) {
  return (
    <DialogContent className="max-w-[40rem] px-8 py-8  bg-slate-700  border-blue">
    <div className="grid rounded-xl px-4">
  <DialogHeader className="dialog-header text-lg mb-4 text-white">
        Create Prediction Market
        <hr></hr>
      </DialogHeader>
      <CreatePredictionPost />
      </div>
    </DialogContent>
  );
}
