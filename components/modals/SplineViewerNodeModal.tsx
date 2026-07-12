import { SplineViewerPostValidation } from "@/lib/validations/thread";
import { z } from "zod";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SplineViewerNodeForm from "../forms/SplineViewerNodeForm";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof SplineViewerPostValidation>) => void;
  currentUrl: string;
}

const renderCreate = ({
  onSubmit,
}: {
  onSubmit?: (values: z.infer<typeof SplineViewerPostValidation>) => void;
}) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-2.5rem]">
      <b>Create Spline Viewer</b>
    </DialogHeader>
    <hr />

    <SplineViewerNodeForm onSubmit={onSubmit!} currentUrl="" />
  </div>
);

const renderEdit = ({
  onSubmit,
  currentUrl,
}: {
  onSubmit?: (values: z.infer<typeof SplineViewerPostValidation>) => void;
  currentUrl: string;
}) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
      <b>Edit Spline Viewer</b>
    </DialogHeader>
    <SplineViewerNodeForm onSubmit={onSubmit!} currentUrl={currentUrl} />
  </div>
);

const renderView = (currentUrl: string) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
      <b>View Spline</b>
    </DialogHeader>
    <hr />
    <div className="py-4">
      <a href={currentUrl} target="_blank" rel="noreferrer" className="underline text-blue-500 break-all">
        {currentUrl}
      </a>
    </div>
    <hr />
    <div className="py-4">
      <DialogClose id="animateButton" className="form-submit-button pl-2 py-2 pr-[1rem]">
        <div className="w-2" />
        <> Close </>
      </DialogClose>
    </div>
  </div>
);

const SplineViewerNodeModal = ({ id, isOwned, onSubmit, currentUrl }: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;
  return (
    <div>
      <DialogContent className="max-w-[40%] max-h-[60%] h-auto bg-slate-800 border-blue">
        <div className="grid rounded-md px-4 py-2 mt-8">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentUrl })}
          {isView && renderView(currentUrl)}
        </div>
      </DialogContent>
    </div>
  );
};

export default SplineViewerNodeModal;
