import { YoutubePostValidation } from "@/lib/validations/thread";
import { z } from "zod";
import YoutubeNodeForm from "@/components/forms/YoutubeNodeForm";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props 
{
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof YoutubePostValidation>) => void;
  currentVideoURL: string;
}

const renderCreate = ({
  onSubmit,
}: {
  onSubmit?: (values: z.infer<typeof YoutubePostValidation>) => void;
}) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-3rem]">
        <b> Create Post</b>
      </DialogHeader>
      <hr />
      <div className=" items-start justify-start">
      <YoutubeNodeForm onSubmit={onSubmit!} currentVideoURL={""} />
      </div>
    </div>
  );
};

const renderEdit = ({
  onSubmit,
  currentVideoURL,
}: {
  onSubmit?: (values: z.infer<typeof YoutubePostValidation>) => void;
  currentVideoURL: string;
}) => {
  return (
    <div className="justify-start items-start relative">
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b> Edit Post</b>
      </DialogHeader>
      <hr />
      <YoutubeNodeForm onSubmit={onSubmit!} currentVideoURL={currentVideoURL} />
    </div>
  );
};
const renderView = (currentVideoURL: string) => {
  return (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4">
        <b> View Post</b>
      </DialogHeader>
      <hr />

      <div className="py-4 grid">
        <iframe
          title="youtube video"
          width={400}
          height={225}
          src={currentVideoURL}
          allow="accelerometer; autoplay; showinfo=0; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        ></iframe>
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

const YoutubeNodeModal = ({
  id,
  onSubmit,
  isOwned,
  currentVideoURL,
}: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;
  return (
    <div>
      <DialogContent className="max-w-[34rem] bg-slate-800 border-blue">
        <div className="grid rounded-md px-4 py-2 mt-8">
          {isCreate && renderCreate({ onSubmit })}
          {isEdit && renderEdit({ onSubmit, currentVideoURL })}
          {isView && renderView(currentVideoURL)}
        </div>
      </DialogContent>
    </div>
  );
};

export default YoutubeNodeModal;
