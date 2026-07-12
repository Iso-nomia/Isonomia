import { SplineViewerPostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

interface Props {
  onSubmit: (values: z.infer<typeof SplineViewerPostValidation>) => void;
  currentUrl: string;
}

const SplineViewerNodeForm = ({ onSubmit, currentUrl }: Props) => {
  const form = useForm({
    resolver: zodResolver(SplineViewerPostValidation),
    defaultValues: { sceneUrl: currentUrl },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 mt-4">
        <FormField
          control={form.control}
          name="sceneUrl"
          render={({ field }) => (
            <FormItem className="grid gap-2">
              <FormLabel className="text-[1.5rem] text-white mt-4">Scene URL</FormLabel>
              <FormControl>
                <Input type="text" defaultValue={currentUrl} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="form-submit-button mt-2 mb-4 ">
          Submit
        </Button>
      </form>
    </Form>
  );
};

export default SplineViewerNodeForm;
