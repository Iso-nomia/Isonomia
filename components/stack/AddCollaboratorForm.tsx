"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addCollaborator, type AddCollaboratorResult } from "@/lib/actions/stack.actions";
import { Select } from "@/components/ui/select";
interface AddCollaboratorFormProps {
  stackId: string;
}

export default function AddCollaboratorForm({ stackId }: AddCollaboratorFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const result: AddCollaboratorResult = await addCollaborator(formData);
      
      if (result.success) {
        setSuccess(true);
        formRef.current?.reset();
        router.refresh();
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <form ref={formRef} action={handleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="stackId" value={stackId} />
        <div className="flex gap-4 flex-wrap">
          <input
            name="userId"
            placeholder="User ID"
            className="bg-white/70 commentfield rounded-xl px-4 py-1 text-sm"
            disabled={isPending}
          />
          <input
            name="username"
            placeholder="Username"
            className="bg-white/70 commentfield rounded-xl px-3 py-1 text-sm"
            disabled={isPending}
          />
          <select 
            name="role" 
            className="border-none rounded-xl px-3 py-1 bg-white/70 text-sm text-start focus:border-none sendbutton"
            disabled={isPending}
          >
            
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>

          </select>
          <button 
            type="submit"
            className="px-3 py-1 bg-white/50 sendbutton text-center text-sm rounded-xl disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? "Adding..." : "Add User"}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mt-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
          Collaborator added successfully!
        </div>
      )}
    </div>
  );
}
