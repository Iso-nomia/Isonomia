"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { UserValidation } from "@/lib/validations/user";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { isBase64Image } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";
import { updateUser } from "@/lib/actions/user.actions";
import { useRouter, usePathname } from "next/navigation";
import { joinRoom } from "@/lib/actions/realtimeroom.actions";

interface Props {
  user: {
    authId: string;
    userId: bigint | null;
    username: string;
    name: string;
    bio: string | null;
    image: string | null;
  };
  btnTitle: string;
  onSuccess?: () => void | Promise<void>;
}

const AccountProfile = ({ user, btnTitle, onSuccess }: Props) => {
  const pathname = usePathname();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const { startUpload } = useUploadThing("media");
  const form = useForm({
    resolver: zodResolver(UserValidation),
    defaultValues: {
      profile_photo: user?.image || "",
      name: user?.name || "",
      username: user?.username || "",
      bio: user?.bio || "",
    },
  });

  const handleImage = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: string) => void
  ) => {
    e.preventDefault();

    const fileReader = new FileReader();

    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFiles(Array.from(e.target.files));
      if (!file.type.includes("image")) return;
      fileReader.onload = async (event) => {
        const imageDataUrl = event.target?.result?.toString() || "";

        fieldChange(imageDataUrl);
      };
      fileReader.readAsDataURL(file);
    }
  };

  const onSubmit = async (values: z.infer<typeof UserValidation>) => {
    const blob = values.profile_photo;

    const hasImageChanged = isBase64Image(blob ?? "");

    if (hasImageChanged) {
      const imgRes = await startUpload(files);
      if (imgRes && imgRes[0].url) {
        values.profile_photo = imgRes[0].url;
      }
    }

    await updateUser({
      userAuthId: user.authId,
      username: values.username,
      name: values.name,
      bio: values.bio,
      image: values.profile_photo ?? "",
      path: pathname ?? "",
    });

    if (onSuccess) {
      await onSuccess();
    } else if (pathname === "/profile/edit") {
      router.back();
    } else {
      await joinRoom({ roomId: "global" });
      router.push("/room/global");
    }
  };

  return (
    <div className="relative gap-y-2">
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col justify-center gap-1"
      >
        <FormField
          control={form.control}
          name="profile_photo"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center ">
              <FormLabel className="account-form_image-label ">
                {field.value ? (
                  <Image
                    src={field.value}
                    alt="profile photo"
                    width={96}
                    height={96}
                    priority
                    className="object-cover rounded-full "
                  />
                ) : (
                  <Image
                    src="/assets/profile.svg"
                    alt="profile photo needed"
                    width={96}
                    height={96}
                    priority
                    className="object-cover rounded-full"
                  />
                )}
              </FormLabel>
              <FormControl className="flex-1 ">
                <Input
                  type="file"
                  accept="image/*"
                  placeholder="Upload a photo"
                  className="account-form_image-input hover:border-[1px]"
                  onChange={(e) => handleImage(e, field.onChange)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="flex-2 flex-col  w-full">
              <FormLabel className="account_label_name">
                Enter Your Name
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
        
          control={form.control}
          name="username"
          
          render={({ field }) => (
            <FormItem className="flex-2 flex-col-1 w-full">
              <FormLabel className="account_label_name">
                Choose Username
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem className="flex-2 flex-col-1 w-full">
              <FormLabel className="account_label_name">
                Add a Bio
              </FormLabel>
              <FormControl>
                <Input
                  type="text"
                  className="account-form_input no-focus"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="bg-white w-40 mt-4">
          Submit
        </Button>
      </form>
    </Form>
    </div>
  );
};
export default AccountProfile;
