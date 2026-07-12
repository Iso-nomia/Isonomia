import { ImagePostValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
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

import clockicon from "/public/assets/clock.svg";

interface Props {
  onSubmit: (values: z.infer<typeof ImagePostValidation>) => void;
  currentImageURL: string;
  currentCaption: string;
}

const ImageNodeForm = ({ onSubmit, currentImageURL, currentCaption }: Props) => {
  const [imageURL, setImageURL] = useState(currentImageURL);
  const form = useForm({
    resolver: zodResolver(ImagePostValidation),
    defaultValues: {
      image: new File([""], "filename"),
      caption: currentCaption,
    },
  });

  const handleImage = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: File) => void
  ) => {
    e.preventDefault();
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
      const uploadedFile = e.target.files[0];
      if (!uploadedFile.type.includes("image")) return;
      fileReader.onload = async (event) => {
        const imageDataUrl = event.target?.result?.toString() || "";
        setImageURL(imageDataUrl);
        fieldChange(uploadedFile);
      };
      fileReader.readAsDataURL(uploadedFile);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col justify-center mt-8 mb-2 "
      >
        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
           // <FormItem className="flex items-center gap-4 mb-2 text-xl">
                          <FormItem className="flex justify-center mx-auto w-full gap-4 mb-2 mt-0 text-xl">

              {/* <FormLabel className="account-form_image-label text-xl">
                <Image
                  src={imageURL}
                  alt="upload"
                  width={96}
                  height={96}
                  className="object-cover"
                  priority
                />
              </FormLabel> */}
              {/* <FormControl className="form-submit-button flex-1 text-base-semibold text-gray-200 text-xl"> */}
              <FormControl className=" flex h-max text-base-semibold text-gray-200 text-[1.25rem]">

                <Input
                  hidden
                  type="file"
                  accept="image/*"
                  placeholder="Upload an image"
                  className="rounded-xl savebutton hover:bg-opacity-90 p-2 w-full"
                  onChange={(e) => handleImage(e, field.onChange)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
                <hr className="mt-4"></hr>

        <FormField
          control={form.control}
          name="caption"
          render={({ field }) => (
            <FormItem className="mb-4 mt-6  rounded-xl">
              <FormLabel hidden>Caption</FormLabel>
              <FormControl>
              <Input className="flex textinputfield w-full justify-center mx-auto text-[1.1rem]" type="text" placeholder="Caption" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <Button
          type="submit"
          className="w-[100%] h-max image-submit-button mt-2"
        >
          Submit
        </Button> */}
        <div className="mt-4 justify-center items-center mx-auto mb-0">
        <button type="submit" className="bg-white  text-[1.2rem] tracking-wide px-4 py-3 w-full rounded-xl savebutton hover:bg-opacity-90">
          Save Changes
        </button>
      </div>
      </form>
    </Form>
  );
};

export default ImageNodeForm;
