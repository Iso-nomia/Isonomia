import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GalleryPostValidation,
  GalleryEditValidation,
} from "@/lib/validations/thread";
import { z } from "zod";
import GalleryNodeForm from "../forms/GalleryNodeForm";
import Image from "next/image";
import { AnimatedDialog } from "../ui/AnimatedDialog";
import { motion } from "framer-motion";

interface Props {
  id?: string;
  isOwned: boolean;
  isPublic: boolean;
  onSubmit?: (
    values:
      | z.infer<typeof GalleryPostValidation>
      | z.infer<typeof GalleryEditValidation>
  ) => void;
  currentImages: string[];
  currentCaption?: string;
}

const renderCreate = ({
  onSubmit,
  currentIsPublic,
  currentCaption,
}: {
  onSubmit?: (
    values:
      | z.infer<typeof GalleryPostValidation>
      | z.infer<typeof GalleryEditValidation>
  ) => void;
  currentIsPublic: boolean;
  currentCaption?: string;
}) => (
  <div >
      <DialogHeader className="dialog-header text-white text-lg py-4  ml-2 ">
      <b>Create Gallery</b>
    </DialogHeader>
    <hr />
    <GalleryNodeForm
      onSubmit={onSubmit!}
      currentImages={[]}
      currentIsPublic={currentIsPublic}
      isOwned={true}
      currentCaption={currentCaption}
    />
  </div>
);

const renderEdit = ({
  onSubmit,
  currentImages,
  isOwned,
  currentIsPublic,
  currentCaption,
}: {
  onSubmit?: (
    values:
      | z.infer<typeof GalleryPostValidation>
      | z.infer<typeof GalleryEditValidation>
  ) => void;
  currentImages: string[];
  isOwned: boolean;
  currentIsPublic: boolean;
  currentCaption?: string;
}) => (
  <div >
      <DialogHeader className="dialog-header text-white text-lg py-4  ml-2 ">
      <b>Edit Gallery</b>
    </DialogHeader>
    <hr />
    <GalleryNodeForm
      onSubmit={onSubmit!}
      currentImages={[]}
      currentIsPublic={currentIsPublic}
      isOwned={true}
      currentCaption={currentCaption}
    />
  </div>
);

const renderView = (images: string[]) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4">
      <b>View Gallery</b>
    </DialogHeader>
    <hr />
    <div className="py-4 grid mt-4 grid-cols-3 gap-2">
      {images.map((url, idx) => (
        <Image key={idx} src={url} alt={`img-${idx}`} width={100} height={100} className="object-cover" />
      ))}
    </div>
    <hr />
    <div className="py-4">
      <DialogClose id="animateButton" className={`form-submit-button pl-2 py-2 pr-[1rem]`}>
        <> Close </>
      </DialogClose>
    </div>
  </div>
);

const GalleryNodeModal = ({ id, isOwned, isPublic, onSubmit, currentImages, currentCaption }: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && (isOwned || isPublic);
  const isView = id && !isOwned && !isPublic;
  return (
    <div>
      <DialogContent className="max-w-[57rem]  bg-slate-700  border-blue">
        <div className="grid rounded-xl px-4">
          {isCreate && renderCreate({ onSubmit, currentIsPublic: isPublic, currentCaption })}
          {isEdit &&
            renderEdit({
              onSubmit,
              currentImages,
              isOwned,
              currentIsPublic: isPublic,
              currentCaption,
            })}
          {isView && renderView(currentImages)}
        </div>
      </DialogContent>
    </div>
  );
};

export default GalleryNodeModal;
