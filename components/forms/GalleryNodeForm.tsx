import {
  GalleryPostValidation,
  GalleryEditValidation,
} from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
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
  onSubmit: (
    values:
      | z.infer<typeof GalleryPostValidation>
      | z.infer<typeof GalleryEditValidation>
  ) => void;
  currentImages: string[];
  currentIsPublic: boolean;
  isOwned: boolean;
  currentCaption?: string;
}

const GalleryNodeForm = ({
  onSubmit,
  currentImages,
  currentIsPublic,
  isOwned,
  currentCaption,
}: Props) => {
  const [imageURLs, setImageURLs] = useState<string[]>(currentImages);
  const isEditing = currentImages.length > 0;
  const captionDefault = currentCaption ?? "";

  const form = useForm({
    resolver: zodResolver(
      isEditing ? GalleryEditValidation : GalleryPostValidation
    ),
    defaultValues: {
      images: [] as File[],
      isPublic: currentIsPublic,
      caption: captionDefault,
    },
  });

  const handleImages = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: File[]) => void
  ) => {
    e.preventDefault();
    const files = Array.from(e.target.files || []);
    fieldChange(files);
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) =>
              resolve(evt.target?.result?.toString() || "");
            reader.readAsDataURL(file);
          })
      )
    ).then((urls) => setImageURLs((prev) => [...prev, ...urls]));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem className="flex justify-center mx-auto w-full gap-4 mb-2 mt-6 text-xl">
              {/* <FormLabel className="account-form_image-label text-xl">
                <div className="flex gap-2 flex-wrap">
                  {imageURLs.map((url, idx) => (
                    <Image
                      key={idx}
                      src={url}
                      alt={`preview-${idx}`}
                      width={80}
                      height={80}
                      className="object-cover"
                    />
                  ))}
                </div>
              </FormLabel> */}
              <FormControl className=" flex h-max text-base-semibold text-gray-200 text-[1.25rem]">
                <Input
                  hidden
                  multiple
                  type="file"
                  accept="image/*"
                  placeholder="Upload images"
                  className="rounded-xl savebutton hover:bg-opacity-90 p-2 w-full"
                  onChange={(e) => handleImages(e, field.onChange)}
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
            <FormItem className="mb-4 mt-4  rounded-xl">
              <FormLabel hidden>Caption</FormLabel>
              <FormControl>
                <Input className="flex messagefield w-full rounded-xl justify-center mx-auto text-[1.1rem]" type="text" placeholder="Caption" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isOwned && (
          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <div className="flex flex-col ">
                <div className="grid justify-center align-center items-center">
                  <FormItem className=" justify-center items-center align-center">
                    <FormLabel hidden>Public?</FormLabel>
                    {/* <p className="relative justify-center align-center items-center flex  text-[1.1rem] tracking-wide text-white ">
                      Public?
                    </p> */}
                    <FormControl className="flex inline-block w-full h-full justify-center align-center items-center gap-3 ">
                      <div className="flex  inline-block w-full h-full">
                 
                        <p className="w-full relative justify-center align-center items-center flex  inline-block  text-[1.4rem] tracking-wide text-white ">
                          Public?
                        </p>
                        <Input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="justify-center align-center items-center relative w-full bg-white h-fit savebutton"
                         />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                {/* <Button
                  type="submit"
                  className="relative bottom-4 left-6 px-0 py-2 rounded-full h-min image-submit-button  "
                >
                  Submit
                </Button> */}
                 <div className="mt-4 justify-center items-center mx-auto mb-0">
        <button type="submit" className="bg-white  text-[1.2rem] tracking-wide px-4 py-3 w-full rounded-xl savebutton hover:bg-opacity-90">
          Save Changes
        </button>
      </div>
              </div>
            )}
          />
        )}
      </form>
    </Form>
  );
};

export default GalleryNodeForm;
