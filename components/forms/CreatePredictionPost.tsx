import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Form, FormField, FormItem, FormControl, FormMessage } from "../ui/form";
import { PredictionPostValidation } from "@/lib/validations/thread";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function CreatePredictionPost() {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(PredictionPostValidation),
    mode: "onChange",
    defaultValues: {
      question: "",
      closesAt: "",
      liquidity: 100,
    },
  });

  async function onSubmit(values: z.infer<typeof PredictionPostValidation>) {
    try {
      const resp = await fetch("/api/market", {
        method: "POST",
        body: JSON.stringify(values),
      });
      if (!resp.ok) throw new Error();
      const { postId } = await resp.json();
    //  router.push(`/post/${postId}`);
    } catch (e) {
      toast.error("Failed to create market");
    }
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="question"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input className="textinputfield " placeholder="Market question" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="closesAt"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input className="textinputfield " type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="liquidity"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input className="textinputfield " type="number" min={50} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <hr></hr>
        <button
          type="submit"
          className="savebutton px-5 py-2 rounded-xl text-[1.1rem] tracking-wide bg-white hover:bg-opacity-90"
          disabled={!(form.formState.isDirty && form.formState.isValid)}
        >
          Create
        </button>
      </form>
    </Form>
  );
}
