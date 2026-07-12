import { YoutubePostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChangeEvent, useState } from "react";
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
  onSubmit: (values: z.infer<typeof YoutubePostValidation>) => void;
  currentVideoURL: string;
}

const YoutubeNodeForm = ({ onSubmit, currentVideoURL }: Props) => {
  const [isValidURL, setIsValidURL] = useState(true);
  const youtubeRegex =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const form = useForm({
    resolver: zodResolver(YoutubePostValidation),
    defaultValues: {
      videoURL: currentVideoURL,
    },
  });

  const handleYoutubeVideoURL = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: string) => void
  ) => {
    e.preventDefault();
    const url = e.target.value;
    var match = url.match(youtubeRegex);
    if (match && match[7].length == 11) {
      setIsValidURL(true);
      fieldChange(`https://www.youtube.com/embed/${match[7]}`);
    } else {
      setIsValidURL(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid   mt-2 mb-2"
      >
        <FormField
          control={form.control}
          name="videoURL"
          render={({ field }) => (
            <FormItem className="grid items-center gap-0 mb-2 w-[100%]">
              <FormLabel className="text-xl">
                <iframe
                  title="youtube video"
                  width={400}
                  height={225}
                  src={field.value}
                  allow="accelerometer; autoplay; showinfo=0; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                ></iframe>
              </FormLabel>
              <FormControl className="form-submit-button flex-1 text-base-semibold text-xl">
                <Input
                  type="text"
                  placeholder="Enter a youtube video URL"
                  defaultValue={currentVideoURL}
                  onChange={(e) => handleYoutubeVideoURL(e, field.onChange)}
                  className="w-[100%]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-[100%] h-max image-submit-button mt-2"
          disabled={!isValidURL}
        >
          Submit
        </Button>
      </form>
    </Form>
  );
};

export default YoutubeNodeForm;
