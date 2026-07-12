import { PdfViewerPostValidation } from "@/lib/validations/thread";
import { z } from "zod";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PdfViewerNodeForm from "../forms/PdfViewerNodeForm";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof PdfViewerPostValidation>) => void;
  currentUrl: string;
}

const renderCreate = ({
  onSubmit,
}: {
  onSubmit?: (values: z.infer<typeof PdfViewerPostValidation>) => void;
}) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
      <b>Create PDF Viewer</b>
    </DialogHeader>
    <PdfViewerNodeForm onSubmit={onSubmit!} currentUrl="" />
  </div>
);

const renderEdit = ({
  onSubmit,
  currentUrl,
}: {
  onSubmit?: (values: z.infer<typeof PdfViewerPostValidation>) => void;
  currentUrl: string;
}) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
      <b>Edit PDF Viewer</b>
    </DialogHeader>
    <PdfViewerNodeForm onSubmit={onSubmit!} currentUrl={currentUrl} />
  </div>
);

const renderView = (currentUrl: string) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
      <b>View PDF</b>
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

const PdfViewerNodeModal = ({ id, isOwned, onSubmit, currentUrl }: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;
  return (
    <div>
      <DialogContent className="max-w-[50%]">
        <div className="grid rounded-md px-4 py-2">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentUrl })}
          {isView && renderView(currentUrl)}
        </div>
      </DialogContent>
    </div>
  );
};

export default PdfViewerNodeModal;
