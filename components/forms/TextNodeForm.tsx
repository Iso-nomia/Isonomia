import { TextPostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { DialogHeader } from "../ui/dialog";

interface Props {
  onSubmit: (values: z.infer<typeof TextPostValidation>) => void;
  currentText: string;
}

const TextNodeForm = ({ onSubmit, currentText }: Props) => {
  const form = useForm({
    resolver: zodResolver(TextPostValidation),
    defaultValues: {
      postContent: currentText,
    },
  });

  return (
    <form
      method="POST"
      className="ml-3 mr-3"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <hr />

      <div className="py-4 grid ">
        <textarea
          {...form.register("postContent")}
          name="postContent"
          className="rounded-xl textinputfield"
          placeholder="Enter Text"
          defaultValue={currentText}
          rows={12}
          cols={50}
        />
      </div>
      <hr />
      <div className="mt-2 ">
        <button type="submit" className="bg-white  text-[1.2rem] tracking-wide px-4 py-3 rounded-xl savebutton">
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default TextNodeForm;
