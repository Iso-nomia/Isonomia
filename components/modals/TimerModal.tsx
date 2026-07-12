"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useModalStore } from "@/lib/stores/modalStore";

interface Props {
  postId?: bigint;
  realtimePostId?: string;
  feedPostId?: bigint;
  isOwned: boolean;
  expirationDate?: string | null;
}

import { updatePostExpiration } from "@/lib/actions/thread.actions";

const TimerModal = ({
  postId,
  realtimePostId,
  feedPostId,
  isOwned,
  expirationDate,
}: Props) => {
  const { closeModal } = useModalStore();
  const [duration, setDuration] = useState("none");

  const remaining = useMemo(() => {
    if (!expirationDate) return "No expiration";
    const diff = new Date(expirationDate).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m remaining`;
  }, [expirationDate]);

  const renderOwned = () => (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-2 ">
        <b>Set Expiration</b>
      </DialogHeader>
      <hr />
      <div className="py-4 text-white flex flex-col ">
        <select
          className="px-2 bg-slate-800 rounded-xl py-4"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          <option value="none">No expiration</option>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
        </select>
      </div>
      <hr />
      <div className="py-4 flex justify-start">
        <button
          onClick={async () => {
            await updatePostExpiration({
              realtimePostId,
              feedPostId,
              duration,
            });
            closeModal();
          }}
          className="px-5 py-2 mt-2 savebutton bg-white text-[1.1rem] tracking-wide hover:bg-opacity-90 rounded-xl"
        >
          Save
        </button>
      </div>
    </div>
  );

  const renderView = () => (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b>Post Expiration</b>
      </DialogHeader>
      <hr />
      <div className="py-4 text-white">{remaining}</div>
      <hr />
      <div className="py-4">
        <DialogClose id="animateButton" className="form-submit-button pl-2 py-2 pr-[1rem]">
          <>Close</>
        </DialogClose>
      </div>
    </div>
  );

  return (
    <div>
           <DialogContent className="max-w-[37rem]  bg-slate-700  border-blue">
        <div className="grid rounded-xl px-4">
        <DialogTitle hidden>Timer</DialogTitle>
        <div className="grid">
          {isOwned ? renderOwned() : renderView()}
        </div>
        </div>
      </DialogContent>
    </div>
  );
};

export default TimerModal;
