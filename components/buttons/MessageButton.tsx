"use client";

import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Props {
  targetUserId: bigint;
  initialIsFollowing: boolean;
  initialIsFriend: boolean;
}

const MessageButton = ({ targetUserId }: Props) => {
  const { user } = useAuth();
  const router = useRouter();

  async function handleClick() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.userId) {
      router.push("/onboarding");
      return;
    }
    const res = await fetch("/api/messages/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: targetUserId.toString() }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/messages/${data.id}`);
    }
  }

  return (
    <Button variant="whiteborder" onClick={handleClick} className=" bg-transparent tab-button  px-8 py-6 outline-indigo-400 border-none hover:bg-transparent">
      Send Message
    </Button>
  );
};

export default MessageButton;
