/**
 * Dialog for inviting reviewers by email
 */

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { useInviteReviewer } from "@/lib/review/hooks";

interface InviteReviewerDialogProps {
  reviewId: string;
}

const roleOptions = [
  { value: "REVIEWER", label: "Reviewer" },
  { value: "SENIOR_REVIEWER", label: "Senior Reviewer" },
  { value: "STATISTICAL_REVIEWER", label: "Statistical Reviewer" },
  { value: "ETHICS_REVIEWER", label: "Ethics Reviewer" },
  { value: "GUEST_EDITOR", label: "Guest Editor" },
];

export function InviteReviewerDialog({ reviewId }: InviteReviewerDialogProps) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("REVIEWER");
  const [deadline, setDeadline] = useState("");

  const inviteReviewer = useInviteReviewer(reviewId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await inviteReviewer.mutateAsync({
        userId,
        role: role || undefined,
        deadline: deadline || undefined,
      });

      // Reset form and close
      setUserId("");
      setRole("REVIEWER");
      setDeadline("");
      setOpen(false);
    } catch (error) {
      console.error("Failed to invite reviewer:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Reviewer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Reviewer</DialogTitle>
            <DialogDescription>
              Invite a user to review this submission. They will receive a
              notification and can accept or decline.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                type="text"
                placeholder="Enter user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={inviteReviewer.isPending}>
              {inviteReviewer.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
