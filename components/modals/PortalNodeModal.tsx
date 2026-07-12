import { PortalNodeValidation } from "@/lib/validations/thread";
import { z } from "zod";
import PortalNodeForm from "@/components/forms/PortalNodeForm";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof PortalNodeValidation>) => void;
  currentX: number;
  currentY: number;
}

const renderCreate = ({
  onSubmit,
}: {
  onSubmit?: (values: z.infer<typeof PortalNodeValidation>) => void;
}) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b> Create Portal</b>
      </DialogHeader>
      <PortalNodeForm onSubmit={onSubmit!} currentX={0} currentY={0} />
    </div>
  );
};

const renderEdit = ({
  onSubmit,
  currentX,
  currentY,
}: {
  onSubmit?: (values: z.infer<typeof PortalNodeValidation>) => void;
  currentX: number;
  currentY: number;
}) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b> Edit Portal</b>
      </DialogHeader>
      <PortalNodeForm onSubmit={onSubmit!} currentX={currentX} currentY={currentY} />
    </div>
  );
};

const renderView = (currentX: number, currentY: number) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
        <b> View Portal</b>
      </DialogHeader>
      <hr />
      <div className="py-4 grid gap-2 text-black">
        <div>X: {currentX}</div>
        <div>Y: {currentY}</div>
      </div>
      <hr />
      <div className="py-4">
        <DialogClose id="animateButton" className={`form-submit-button pl-2 py-2 pr-[1rem]`}>
          <div className="w-2"></div>
          <> Close </>
        </DialogClose>
      </div>
    </div>
  );
};

const PortalNodeModal = ({ id, isOwned, onSubmit, currentX, currentY }: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;
  return (
    <div>
      <DialogContent className="max-w-[57rem]">
        <DialogTitle>PortalNodeModal</DialogTitle>
        <div className="grid rounded-md px-4 py-2">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentX, currentY })}
          {isView && renderView(currentX, currentY)}
        </div>
      </DialogContent>
    </div>
  );
};

export default PortalNodeModal;
