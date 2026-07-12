"use client";

import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";

// Example interface for the collage config
export interface CollageConfigType {
  layoutStyle: string;  // e.g. "grid" | "bento" | "scrapbook"
  columns: number;      // e.g. 1..10
  gap: number;          // e.g. 0..50
}

interface Props {
  // Node ID if editing an existing node
  id?: string;
  // Whether current user owns this node
  isOwned: boolean;
  // Callback after the user submits
  onSubmit?: (values: CollageConfigType) => void;
  // Current config (if any)
  currentConfig: Partial<CollageConfigType>;
}

function CollageNodeModal({ id, isOwned, onSubmit, currentConfig }: Props) {
  // If no ID but isOwned -> "create", if ID but isOwned -> "edit", else "view"
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;

  // Set up a default form
  const { register, handleSubmit } = useForm<CollageConfigType>({
    defaultValues: {
      layoutStyle: currentConfig.layoutStyle ?? "grid",
      columns: currentConfig.columns ?? 3,
      gap: currentConfig.gap ?? 8,
    },
  });

  const renderCreate = () => (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b>Create Collage</b>
      </DialogHeader>
      <hr />
      <form onSubmit={handleSubmit((vals) => onSubmit?.(vals))} className="flex flex-col gap-4 mt-4">
        <label className="flex flex-col text-sm text-white">
          Layout Style:
          <select
            {...register("layoutStyle")}
            className="p-1 mt-1 border border-gray-200"
          >
            <option value="grid">Grid</option>
            <option value="bento">Bento</option>
            <option value="scrapbook">Scrapbook</option>
          </select>
        </label>

        <label className="flex flex-col text-sm text-white">
          Columns:
          <Input
            type="number"
            min={1}
            max={10}
            {...register("columns", { valueAsNumber: true })}
            className="mt-1"
          />
        </label>

        <label className="flex flex-col text-sm text-white">
          Gap (px):
          <Input
            type="number"
            min={0}
            max={50}
            {...register("gap", { valueAsNumber: true })}
            className="mt-1"
          />
        </label>

        <Button type="submit" className="mt-2" variant="outline">
          Create
        </Button>
      </form>
    </div>
  );

  const renderEdit = () => (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b>Edit Collage</b>
      </DialogHeader>
      <hr />
      <form onSubmit={handleSubmit((vals) => onSubmit?.(vals))} className="flex flex-col gap-4 mt-4">
        {/* same fields as create */}
        <label className="flex flex-col text-sm text-white">
          Layout Style:
          <select
            {...register("layoutStyle")}
            className="p-1 mt-1 border border-gray-200"
          >
            <option value="grid">Grid</option>
            <option value="bento">Bento</option>
            <option value="scrapbook">Scrapbook</option>
          </select>
        </label>

        <label className="flex flex-col text-sm text-white">
          Columns:
          <Input
            type="number"
            min={1}
            max={10}
            {...register("columns", { valueAsNumber: true })}
            className="mt-1"
          />
        </label>

        <label className="flex flex-col text-sm text-white">
          Gap (px):
          <Input
            type="number"
            min={0}
            max={50}
            {...register("gap", { valueAsNumber: true })}
            className="mt-1"
          />
        </label>

        <Button type="submit" className="mt-2" variant="outline">
          Update
        </Button>
      </form>
    </div>
  );

  const renderView = () => (
    <div>
      <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
        <b>View Collage</b>
      </DialogHeader>
      <hr />
      <div className="mt-4 text-white">
        <p><b>Layout:</b> {currentConfig.layoutStyle}</p>
        <p><b>Columns:</b> {currentConfig.columns}</p>
        <p><b>Gap (px):</b> {currentConfig.gap}</p>
      </div>
      <hr />
      <div className="py-4">
        <DialogClose id="animateButton" className="form-submit-button pl-2 py-2 pr-[1rem]">
          <>Close</>
        </DialogClose>
      </div>
    </div>
  );

  return (
    <DialogContent className="max-w-[57rem]">
      <DialogTitle>CollageNodeModal</DialogTitle>
      <div className="grid rounded-md px-4 py-2">
        {isCreate && renderCreate()}
        {isEdit && renderEdit()}
        {isView && renderView()}
      </div>
    </DialogContent>
  );
}

export default CollageNodeModal;
