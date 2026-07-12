import { EntropyInviteValidation } from "@/lib/validations/thread";
import { z } from "zod";
import EntropyNodeForm from "@/components/forms/EntropyNodeForm";
import { DialogContent, DialogHeader } from "@/components/ui/dialog";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof EntropyInviteValidation>) => void;
  currentInvitee: string;
}

const renderCreate = ({ onSubmit }: { onSubmit?: (v: z.infer<typeof EntropyInviteValidation>) => void }) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mb-2">
      <b>Create Game</b>
    </DialogHeader>
    <hr />
    <EntropyNodeForm onSubmit={onSubmit!} currentInvitee="" />
  </div>
);

const renderEdit = ({ onSubmit, currentInvitee }: { onSubmit?: (v: z.infer<typeof EntropyInviteValidation>) => void; currentInvitee: string }) => (
  <div>
    <DialogHeader className="dialog-header ml-2 text-white text-lg mb-2 mt-0">
      <b>Edit Game</b>
    </DialogHeader>
    <EntropyNodeForm onSubmit={onSubmit!} currentInvitee={currentInvitee} />
  </div>
);

function EntropyNodeModal({ id, isOwned, onSubmit, currentInvitee }: Props) {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  return (
    <div>
      <DialogContent className="max-w-[57rem]">
        <div className="grid rounded-md px-4 py-4">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentInvitee })}
        </div>
      </DialogContent>
    </div>
  );
}

export default EntropyNodeModal;
