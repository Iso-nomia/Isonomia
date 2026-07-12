import { RoomCanvasPostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface Props {
  onSubmit: (values: z.infer<typeof RoomCanvasPostValidation>) => void;
  currentRoomId: string;
  currentDescription: string;
}

export default function RoomCanvasForm({ onSubmit, currentRoomId, currentDescription }: Props) {
  const form = useForm({
    resolver: zodResolver(RoomCanvasPostValidation),
    defaultValues: { roomId: currentRoomId, description: currentDescription },
  });

  return (
    <form method="POST" className="ml-3 mr-3" onSubmit={form.handleSubmit(onSubmit)}>
      <hr />
      <div className="py-4 grid gap-2">
        <label className="flex flex-col text-white gap-3 text-[1rem]">
          Room ID:
          <Input type="text" {...form.register("roomId")} className="text-black" />
        </label>
        <label className="flex flex-col text-white gap-3 text-[1rem]">
          Description:
          <Textarea {...form.register("description")} className="text-black" />
        </label>
      </div>
      <hr />
      <div className="py-4 mb-0">
        <Button type="submit" className="form-submit-button" size={"lg"}>
          Share
        </Button>
      </div>
    </form>
  );
}
