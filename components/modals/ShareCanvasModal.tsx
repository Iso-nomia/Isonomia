"use client";

import { useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Props {
  onSubmit?: (description: string) => void;
}

export default function ShareCanvasModal({ onSubmit }: Props) {
  const [desc, setDesc] = useState("");

  return (
    <div>
      <DialogContent className="max-w-[40rem]">
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-2rem]">
          <b>Share Canvas</b>
        </DialogHeader>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Add a description"
          className="mt-2"
        />
        <div className="flex justify-end gap-2 mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={() => onSubmit?.(desc)}>Share</Button>
        </div>
      </DialogContent>
    </div>
  );
}
