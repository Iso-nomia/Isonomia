"use client";
import React from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import LibraryPostModal from "@/components/modals/LibraryPostModal";

export default function StackAddModal({ stackId }: { stackId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
      <button className="px-3 py-1 text-sm bg-slate-100/70 sendbutton rounded-md text-slate-700 ">
          Upload</button>
      </DialogTrigger>
      <LibraryPostModal onOpenChange={setOpen} stackId={stackId} />
    </Dialog>
  );
}
