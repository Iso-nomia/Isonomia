"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { sendEmail } from "@/lib/actions/gmail.actions";

interface Props {
  from: string;
  accessToken: string;
}

export default function SendEmailModal({ from, accessToken }: Props) {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await sendEmail({
      from,
      to: email,
      subject: "",
      message: "hello",
      accessToken,
    });
    setEmail("");
  };

  return (
    <DialogContent className="max-w-[40rem]">
      <DialogHeader>
        <DialogTitle className="text-white">Send Email</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          placeholder="Recipient Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="flex gap-2 mt-2">
          <Button type="submit">Send</Button>
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              Close
            </Button>
          </DialogClose>
        </div>
      </form>
    </DialogContent>
  );
}
