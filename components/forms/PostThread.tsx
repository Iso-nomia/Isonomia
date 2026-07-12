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
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
//import { updateUser } from "@/lib/actions/user.actions"
import { useRouter, usePathname } from "next/navigation";
import { ThreadValidation } from "@/lib/validations/thread";

// NOTE: `createPost` is not currently exported from thread.actions (its
// implementation is commented out). This local stub keeps the legacy
// PostThread form compiling without changing its runtime redirect behavior.
async function create(_params: {
  text: string;
  authorId: bigint;
  path: string | null;
}): Promise<void> {}

interface Props {
  user: {
    id: bigint;
    objectId: string;
    username: string;
    name: string;
    bio: string;
    image: string;
  };
  btnTitle: string;
}

function PostThread({ userId }: { userId: bigint }) {
  const pathname = usePathname();
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(ThreadValidation),
    defaultValues: {
      thread: "",
      accountId: userId,
    },
  });

  const onSubmit = async (values: z.infer<typeof ThreadValidation>) => {
    await create({
      text: values.thread,
      authorId: userId,
      path: pathname,
    });

    router.push("/");
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-0 flex flex-col justify-start gap-5 "
      >
        <FormField
          control={form.control}
          name="thread"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-3 w-full ">
              <FormLabel className="text-header-semibold text-light-2">
              
              </FormLabel>
              <FormControl className="border-2 border-slate-500  bg-white text-black hover:border-black focus:border-black">
                <Textarea
                  rows={15}
                  className="border-2 border-slate-500 outline-1 outline-slate-100 text-base-regular h-[15rem] "
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="create-post-button h-fit w-[20%] ml-0 mt-[1rem] gap-4 bg-white rounded-md ">
          Publish
        </Button>
      </form>
    </Form>
  );
}

export default PostThread;
