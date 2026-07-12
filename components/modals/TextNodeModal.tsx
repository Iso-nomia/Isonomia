import { TextPostValidation } from "@/lib/validations/thread";
import { z } from "zod";
import TextNodeForm from "@/components/forms/TextNodeForm";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof TextPostValidation>) => void;
  currentText: string;
}

const renderCreate = ({
  onSubmit,
}: {
  onSubmit?: (values: z.infer<typeof TextPostValidation>) => void;
}) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg  ml-2 ">
        <b> Create Post</b>
      </DialogHeader>
      <TextNodeForm onSubmit={onSubmit!} currentText={""} />
    </div>
  );
};

const renderEdit = ({
  onSubmit,
  currentText,
}: {
  onSubmit?: (values: z.infer<typeof TextPostValidation>) => void;
  currentText: string;
}) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 ">
        <b> Edit Post</b>
      </DialogHeader>
      <hr />
      <TextNodeForm onSubmit={onSubmit!} currentText={currentText} />
    </div>
  );
};

const renderView = (currentText: string) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
        <b> View Post</b>
      </DialogHeader>
      <hr />

      <div className="py-4 grid ">
        <textarea
          name="postContent"
          className="dialog-text-area "
          placeholder="Enter Text"
          disabled={true}
          defaultValue={currentText}
          rows={12}
          cols={50}
        />
      </div>
      <hr />
      <div className="py-4">
        <DialogClose
          id="animateButton"
          className={`form-submit-button pl-2 py-2 pr-[1rem]`}
        >
          <div className="w-2"></div>
          <> Close </>
        </DialogClose>
      </div>
    </div>
  );
};

const TextNodeModal = ({ id, isOwned, onSubmit, currentText }: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;
  return (
    <div>
      <DialogContent className="max-w-[57rem]  bg-slate-700 border-blue">
        <div className="grid rounded-md px-4 py-2 ">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentText })}
          {isView && renderView(currentText)}
        </div>
      </DialogContent>
    </div>
  );
};

export default TextNodeModal;
