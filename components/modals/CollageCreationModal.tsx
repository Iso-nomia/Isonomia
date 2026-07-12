"use client";

import {
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The type of data we want for collage settings:
export interface CollageCreationValues {
  layoutStyle: string;
  columns: number;
  gap: number;
}

// If you need to do Zod validation, define it here (optional):
// const CollageCreationValidation = z.object({
//   layoutStyle: z.enum(["grid", "bento", "scrapbook"]).default("grid"),
//   columns: z.number().min(1).max(10).default(3),
//   gap: z.number().min(0).max(50).default(8),
// });
// type CollageCreationValues = z.infer<typeof CollageCreationValidation>;

interface Props {
  id?: string; // If no `id`, we treat it as "create," if `id` and `isOwned` => "edit," etc.
  isOwned: boolean; 
  onSubmit?: (vals: CollageCreationValues) => void;

  // If you're viewing or editing an existing collage, pass these
  currentLayoutStyle?: string;
  currentColumns?: number;
  currentGap?: number;
}

/** 
 * Render "create," "edit," or "view" using the same pattern as ImageNodeModal 
 */
function CollageCreationModal({
  id,
  isOwned,
  onSubmit,
  currentLayoutStyle = "grid",
  currentColumns = 3,
  currentGap = 8,
}: Props) {
  const isCreate = !id && isOwned;
  const isEdit = id && isOwned;
  const isView = id && !isOwned;

  // We'll use a single form for create/edit. For "view," we'll just display values.
  const form = useForm<CollageCreationValues>({
    defaultValues: {
      layoutStyle: currentLayoutStyle,
      columns: currentColumns,
      gap: currentGap,
    },
  });

  // A separate function for each scenario (create, edit, view) 
  // so we can keep the style consistent with your ImageNodeModal approach.

  const renderCreate = () => {
    return (
      <div>
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
          <b>Create Collage</b>
        </DialogHeader>
        <hr />
        <form
          onSubmit={form.handleSubmit((vals) => onSubmit?.(vals))}
          className="flex flex-col gap-4 mt-4"
        >
          {/* Layout Style */}
          <label className="flex flex-col text-sm text-white">
            Layout Style:
            <select
              {...form.register("layoutStyle")}
              className="p-1 mt-1 border border-gray-200"
            >
              <option value="grid">Grid</option>
              <option value="bento">Bento</option>
              <option value="scrapbook">Scrapbook</option>
            </select>
          </label>

          {/* Columns */}
          <label className="flex flex-col text-sm text-white">
            Columns:
            <Input
              type="number"
              min={1}
              max={10}
              {...form.register("columns", { valueAsNumber: true })}
              className="mt-1"
            />
          </label>

          {/* Gap */}
          <label className="flex flex-col text-sm text-white">
            Gap (px):
            <Input
              type="number"
              min={0}
              max={50}
              {...form.register("gap", { valueAsNumber: true })}
              className="mt-1"
            />
          </label>

          <hr />
          <Button type="submit" className="mt-2" variant="outline">
            Create
          </Button>
        </form>
      </div>
    );
  };

  const renderEdit = () => {
    return (
      <div>
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
          <b>Edit Collage</b>
        </DialogHeader>
        <hr />
        <form
          onSubmit={form.handleSubmit((vals) => onSubmit?.(vals))}
          className="flex flex-col gap-4 mt-4"
        >
          {/* same fields as create */}
          <label className="flex flex-col text-sm text-white">
            Layout Style:
            <select
              {...form.register("layoutStyle")}
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
              {...form.register("columns", { valueAsNumber: true })}
              className="mt-1"
            />
          </label>

          <label className="flex flex-col text-sm text-white">
            Gap (px):
            <Input
              type="number"
              min={0}
              max={50}
              {...form.register("gap", { valueAsNumber: true })}
              className="mt-1"
            />
          </label>

          <hr />
          <Button type="submit" className="mt-2" variant="outline">
            Update
          </Button>
        </form>
      </div>
    );
  };

  const renderView = () => {
    return (
      <div>
        <DialogHeader className="dialog-header text-white text-lg py-4 mt-[-4rem]">
          <b>View Collage</b>
        </DialogHeader>
        <hr />
        <div className="mt-4 text-white">
          <p>
            <b>Layout Style:</b> {currentLayoutStyle}
          </p>
          <p>
            <b>Columns:</b> {currentColumns}
          </p>
          <p>
            <b>Gap (px):</b> {currentGap}
          </p>
        </div>
        <hr />
        <div className="py-4">
          <DialogClose id="animateButton" className="form-submit-button pl-2 py-2 pr-[1rem]">
            <>Close</>
          </DialogClose>
        </div>
      </div>
    );
  };

  return (
    <div>
      <DialogContent className="max-w-[57rem]">
        <DialogTitle>CollageNodeModal</DialogTitle>
        <div className="grid rounded-md px-4 py-2">
          {isCreate && renderCreate()}
          {isEdit && renderEdit()}
          {isView && renderView()}
        </div>
      </DialogContent>
    </div>
  );
}

export default CollageCreationModal;

