"use client";

import { useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ConnectAccountModal() {
  const [service, setService] = useState("");
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;
    const credential = JSON.stringify({ email, accessToken });
    try {
      await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, credential }),
      });
      setService("");
      setEmail("");
      setAccessToken("");
      setError("");
    } catch (err: any) {
      console.error("Failed to save integration", err);
      setError(err.message || "Failed to save integration");
    }
  };

  return (
    <DialogContent className="max-w-[40rem]">
      <DialogHeader>
        <DialogTitle className="text-white">Connect Account</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          placeholder="Service (e.g. gmail)"
          value={service}
          onChange={(e) => setService(e.target.value)}
        />
        <Input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Access Token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
        <div className="flex gap-2 mt-2">
          <Button type="submit">Save</Button>
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
