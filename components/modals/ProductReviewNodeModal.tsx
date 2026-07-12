import { ProductReviewValidation } from "@/lib/validations/thread";
import { z } from "zod";
import ProductReviewNodeForm from "../forms/ProductReviewNodeForm";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  id?: string;
  isOwned: boolean;
  onSubmit?: (values: z.infer<typeof ProductReviewValidation>) => void;
  currentProductName: string;
  currentRating: number;
  currentSummary: string;
  currentProductLink: string;
  currentClaims: string[];
  currentImages: string[];
}

const renderCreate = ({ onSubmit, currentProductName, currentRating, currentSummary, currentProductLink, currentClaims, currentImages }: Omit<Props, "id" | "isOwned">) => (
  <div >
    <DialogHeader className="dialog-header  text-black text-lg py-3 mt-[-4rem]">
      <b>Create Review</b>
    </DialogHeader>
      <ProductReviewNodeForm
        onSubmit={onSubmit!}
        currentProductName={currentProductName}
        currentRating={currentRating}
        currentSummary={currentSummary}
        currentProductLink={currentProductLink}
        currentClaims={currentClaims}
        currentImages={currentImages}
      />
  </div>
);

const renderEdit = ({ onSubmit, currentProductName, currentRating, currentSummary, currentProductLink, currentClaims, currentImages }: Omit<Props, "id" | "isOwned">) => (
  <div>
    <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
      <b>Edit Review</b>
    </DialogHeader>
      <ProductReviewNodeForm
        onSubmit={onSubmit!}
        currentProductName={currentProductName}
        currentRating={currentRating}
        currentSummary={currentSummary}
        currentProductLink={currentProductLink}
        currentClaims={currentClaims}
        currentImages={currentImages}
      />
  </div>
  
);

const ProductReviewNodeModal = ({
  id,
  isOwned,
  onSubmit,
  currentProductName,
  currentRating,
  currentSummary,
  currentProductLink,
  currentClaims,
  currentImages,
}: Props) => {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  return (

    <DialogContent className="max-w-[40rem] h-fit bg-indigo-200 bg-opacity-100 border-blue">
        <DialogTitle hidden>ProductReviewNodeModal</DialogTitle>
        <div className="grid rounded-md px-4 py-2 mt-10">
          {isCreate &&
            renderCreate({ onSubmit, currentProductName, currentRating, currentSummary, currentProductLink, currentClaims, currentImages })}
          {isEdit &&
            renderEdit({ onSubmit, currentProductName, currentRating, currentSummary, currentProductLink, currentClaims, currentImages })}
          {!isOwned && (
            <DialogClose id="animateButton" className={`form-submit-button pl-2 py-2 pr-[1rem]`}>
              <> Close </>
            </DialogClose>
          )}
        </div>
      </DialogContent>
  );
};

export default ProductReviewNodeModal;
