"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createAndJoinLounge } from "@/lib/actions/realtimeroom.actions";
import { useAuth } from "@/lib/AuthContext";
import { uploadFileToSupabase } from "@/lib/utils";
import { LoungeValidation } from "@/lib/validations/thread";
import { redirect, usePathname, useRouter } from "next/navigation";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

function CreateLounge() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth().user;
  if (!user?.onboarded) redirect("/onboarding");
  const [imageURL, setImageURL] = useState("");
  const form = useForm({
    resolver: zodResolver(LoungeValidation),
    defaultValues: {
      roomName: "",
      userId: user.userId!,
      roomIcon: "",
      isPublic: true,
    },
  });

  const onSubmit = async (values: z.infer<typeof LoungeValidation>) => {
    const result = await uploadFileToSupabase(values.roomIcon);
    if (result.error) {
      return;
    }
    const lounge = await createAndJoinLounge({
      loungeName: values.roomName,
      roomIcon: result.fileURL ?? "",
      isPublic: values.isPublic,
      path: pathname ?? "",
    });

    router.push(`/lounges/${lounge.id}`);
  };

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
    <div className="justify-center items-center">
            <hr className="h-1"></hr>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-0 flex flex-col justify-center  gap-0  "
        >
          <FormField
            control={form.control}
            name="roomIcon"
            render={({ field }) => (
              <FormItem className="flex flex-col items-center mx-auto justify-center w-full gap-4 mt-4 ">
                <FormLabel className=" rounded-full bg-white p-4 items-center align-center ">
                  {imageURL != "" ? (
                    <Image
                      src={imageURL}
                      alt="profile photo"
                      width={48}
                      height={48}
                      priority
                      className="object-cover"
                    />
                  ) : (
                    <Image
                      src="/assets/profile.svg"
                      alt="profile photo"
                      width={24}
                      height={24}
                      priority
                      className="object-cover"
                    />
                  )}
                </FormLabel>
                <FormControl className=" items-center justify-center border-none grid flex flex-col w-[50%] text-base-semibold text-gray-200">
                  <Input
                  hidden
                    type="file"
                    accept="image/*"
                    placeholder="Upload a photo"
                    className=" rounded-full savebutton hover:bg-opacity-90 p-2 w-full"
                    onChange={(e) => handleImage(e, field.onChange)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="roomName"
            render={({ field }) => (
              <FormItem className="flex flex-col w-full  mt-6 ">
                <FormLabel className="text-[1.1rem] text-center ">Name</FormLabel>
                <FormControl className=" bg-white text-black ">
                  <Input
                  className="flex modalfield  bg-white  py-4 px-4 rounded-full w-full justify-center mx-auto " 
                  type="text" 
                  placeholder="Enter lounge name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <FormItem className="flex flex-col   mt-6 ">
                <FormLabel className="text-[1.1rem] text-center">Visibility</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={(v) => field.onChange(v === "public")}
                    value={field.value ? "public" : "private"}
                    
                  >
                    <SelectTrigger className="savebutton  rounded-full">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[8rem] border-blue   rounded-xl">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Invite Only</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <button
            type="submit"
            className="likebutton bg-white bg-opacity-80 h-fit items-center text-center mx-auto py-2 px-4 mt-8 rounded-full tracking-wide w-fit justify-center text-[1.15rem]  outline-blue  "
          >
           <p> Create </p>
            </button>
        </form>
      </Form>
    </div>
  );
}

export default CreateLounge;
