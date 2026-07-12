import { PortalNodeValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Props {
  onSubmit: (values: z.infer<typeof PortalNodeValidation>) => void;
  currentX: number;
  currentY: number;
}

const PortalNodeForm = ({ onSubmit, currentX, currentY }: Props) => {
  const form = useForm({
    resolver: zodResolver(PortalNodeValidation),
    defaultValues: { x: currentX, y: currentY },
  });

  return (
    <form method="POST" className="ml-3 mr-3" onSubmit={form.handleSubmit(onSubmit)}>
      <hr />
      <div className="py-4 grid gap-2">
        <label className="flex flex-col text-slate-500 gap-3 text-[14px]">
          X:
          <Input type="number" {...form.register("x", { valueAsNumber: true })} />
        </label>
        <label className="flex flex-col text-slate-500 gap-3 text-xl">
          Y:
          <Input type="number" {...form.register("y", { valueAsNumber: true })} />
        </label>
      </div>
      <hr />
      <div className="py-4 mb-4">
        <Button type="submit" className="form-submit-button" size={"lg"}>
          Save Changes
        </Button>
      </div>
    </form>
  );
};

export default PortalNodeForm;
