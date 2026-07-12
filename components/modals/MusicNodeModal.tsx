import MusicNodeForm from "@/components/forms/MusicNodeForm";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: { audioFile: File; title: string }) => void;
  currentUrl: string;
  currentTitle: string;
}

const renderCreate = ({ onSubmit }: { onSubmit?: (values: { audioFile: File; title: string }) => void }) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
      <b>Create Post</b>
    </DialogHeader>
    <hr />
    <div className="items-start justify-start">
      <MusicNodeForm onSubmit={onSubmit!} />
    </div>
  </div>
);

const renderView = (currentTitle: string) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4">
      <b>{currentTitle}</b>
    </DialogHeader>
    <hr />
    <div className="py-4">
      <DialogClose id="animateButton" className="form-submit-button pl-2 py-2 pr-[1rem]">
        <div className="w-2"></div>
        <>Close</>
      </DialogClose>
    </div>
  </div>
);

const MusicNodeModal = ({ id, isOwned, onSubmit, currentUrl, currentTitle }: Props) => {
  const isCreate = !id && isOwned;
  const isView = id && !isOwned;
  return (
    <DialogContent className="max-w-[34rem] bg-slate-800 border-blue">
      <div className="grid rounded-md px-4 py-2 mt-8">
        {isCreate && renderCreate({ onSubmit })}
        {isView && renderView(currentTitle)}
      </div>
    </DialogContent>
  );
};

export default MusicNodeModal;
