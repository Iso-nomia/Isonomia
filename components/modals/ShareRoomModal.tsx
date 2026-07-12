import { CopyIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

const ShareRoomModal = ({ inviteToken }: { inviteToken: string }) => {
  const shareLink = `${window.location.origin}/room/join/${inviteToken}`;
  return (
    <div>
      <DialogContent className="max-w-[57rem]">
        <DialogTitle>Invite Other Users</DialogTitle>
        <div className="grid rounded-md px-4 py-2">
          <div>
            <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
              <b> Invite Other Users</b>
            </DialogHeader>
            <div className="flex">
              <Input
                readOnly
                value={shareLink}
                className="w-[45%] bg-gray-300"
              ></Input>
              <Button type="submit" size="icon" className="">
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
        <div className="py-4">
          <DialogClose
            id="animateButton"
            className={`form-submit-button pl-2 py-2 pr-[1rem]`}
          >
            <div className="w-2"></div>
            <> Close </>
          </DialogClose>
        </div>
      </DialogContent>
    </div>
  );
};

export default ShareRoomModal;
