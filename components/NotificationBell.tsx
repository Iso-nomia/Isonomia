"use client";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const { notifications, refreshNotifications } = useNotifications();
  const unread = notifications.filter((n: any) => !n.read);

  async function markRead(id: string | number | bigint) {
    const idStr = typeof id === "bigint" ? id.toString() : String(id);
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [idStr] }),
    });
    refreshNotifications();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative cursor-pointer">
          <Image src="/assets/notification.svg" alt="bell" width={24} height={24} />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 text-xs text-red-500">{unread.length}</span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-gray-800 text-white">
        {notifications.slice(0, 10).map((n: any) => (
          <DropdownMenuItem
            key={n.id.toString()}
            onClick={() => markRead(n.id)}
            className="cursor-pointer"
          >
            {n.type}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
