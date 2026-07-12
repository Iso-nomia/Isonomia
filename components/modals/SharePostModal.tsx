import { CopyIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

interface Props {
  feedpostId?: bigint;
  realtimePostId?: string;
}

const SharePostModal = ({ feedpostId, realtimePostId }: Props) => {
  const shareLink = realtimePostId
    ? `${window.location.origin}/post/${realtimePostId}`
    : `${window.location.origin}/thread/${feedpostId?.toString()}`;
  return (
    <div>
      <DialogContent className="max-w-[57rem]">
        <DialogTitle>Share Post</DialogTitle>
        <div className="grid  rounded-md px-4 py-2">
          <div>
            <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
              <b>Share Post</b>
            </DialogHeader>
            <div className="flex flex-1 ">
              <Input
                readOnly
                value={shareLink}
                className="w-[55%] bg-gray-300"
              />
              <Button type="submit" className="relative top-0 w-fit ml-4  px-4 py-5 ">
                <CopyIcon
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                  }}
                />
              </Button>
            </div>
          </div>
        </div>
        <div className="py-0">
          <DialogClose id="animateButton" className={`bg-white ml-4 py-2 px-4 text-[1.25rem] mt-2 rounded-lg   `}>
            <div className="w-2"></div>
            <>Close</>
          </DialogClose>
        </div>
      </DialogContent>
    </div>
  );
};

export default SharePostModal;