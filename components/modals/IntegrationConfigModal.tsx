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

export default function IntegrationConfigModal() {
  const [service, setService] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !apiKey) return;
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service, credential: apiKey }),
    });
    setService("");
    setApiKey("");
  };

  return (
    <DialogContent className="max-w-[40rem]">
      <DialogHeader>
        <DialogTitle  className="text-white">Configure Integration</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          placeholder="Service (e.g. slack)"
          value={service}
          onChange={(e) => setService(e.target.value)}
        />
        <Input
          placeholder="API Key or credential"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
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
