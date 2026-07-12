import { LivechatInviteValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Props {
  onSubmit: (values: z.infer<typeof LivechatInviteValidation>) => void;
  currentInvitee: string;
}

function LivechatNodeForm({ onSubmit, currentInvitee }: Props) {
  const form = useForm({
    resolver: zodResolver(LivechatInviteValidation),
    defaultValues: { invitee: currentInvitee },
  });

  return (
    <form method="POST" className="ml-3 mr-3" onSubmit={form.handleSubmit(onSubmit)}>
      <hr />
      <div className="py-4 grid gap-2">
        <label className="flex flex-col text-white gap-3 text-[1rem]">
          Invitee Username:
          <Input type="text" {...form.register("invitee")} placeholder="@username" className="text-black"/>
        </label>
      </div>
      <hr />
      <div className="py-4 mb-0">
        <Button type="submit" className="form-submit-button" size={"lg"}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}

export default LivechatNodeForm;
