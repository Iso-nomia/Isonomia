import { MusicPostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChangeEvent, useState } from "react";
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
  onSubmit: (values: { audioFile: File; title: string }) => void;
}

const MusicNodeForm = ({ onSubmit }: Props) => {
  const form = useForm({
    resolver: zodResolver(MusicPostValidation),
    defaultValues: {
      audio: new File([""], "filename"),
      title: "",
    },
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: z.infer<typeof MusicPostValidation>) {
    setLoading(true);
    try {
      onSubmit({ audioFile: values.audio, title: values.title });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="grid gap-2 mt-2 mb-2"
      >
        <FormField
          control={form.control}
          name="audio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Audio File</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="audio/mpeg, audio/mp3, audio/wav"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) field.onChange(file);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Track title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full h-max image-submit-button mt-2"
          disabled={loading}
        >
          Submit
        </Button>
      </form>
    </Form>
  );
};

export default MusicNodeForm;
