import { forwardRef, useImperativeHandle, useState } from "react";
import Cursor from "./Cursor";
import { COLORS } from "@/constants";
import { UserStatus } from "@/lib/definitions";
import { mergeArrays } from "@/lib/utils";
import { useReactFlow } from "@xyflow/react";

export type LiveCursorHandles = {
  triggerUserUpdate: (payload: UserStatus) => void;
  triggerUserJoin: (newUserStatuses: UserStatus[]) => void;
  triggerUserLeave: (username: string) => void;
};

interface Props {
  offset: { top: number; left: number };
}

// display all other live cursors
const LiveCursors = forwardRef<LiveCursorHandles, Props>((props, ref) => {
  const [otherUsers, setOtherUsers] = useState<UserStatus[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const { flowToScreenPosition } = useReactFlow();
  // Expose methods to the parent using the ref
  useImperativeHandle(ref, () => ({
    triggerUserUpdate(payload: UserStatus) {
      // This function can be called from the parent component
      setOtherUsers(
        otherUsers.map((otherUser: UserStatus) =>
          otherUser.username === payload.username
            ? {
                ...otherUser,
                mousePosition: payload.mousePosition,
              }
            : otherUser
        )
      );
    },
    triggerUserJoin(newUserStatuses: UserStatus[]) {
      setOtherUsers(mergeArrays(otherUsers, newUserStatuses));
      newUserStatuses.forEach((u) =>
        addNotification(`${u.username} joined`)
      );
    },
    triggerUserLeave(username: string) {
      setOtherUsers(otherUsers.filter((u) => u.username !== username));
      addNotification(`${username} left`);
    },
  }));

  function addNotification(text: string) {
    setNotifications((prev) => [...prev, text]);
    setTimeout(() => {
      setNotifications((prev) => prev.slice(1));
    }, 3000);
  }
  return (
    <>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 space-y-1 z-50">
        {notifications.map((n, i) => (
          <div
            key={i}
            className="rounded bg-black/80 px-3 py-1 text-white text-sm"
          >
            {n}
          </div>
        ))}
      </div>
      {otherUsers.map((otherUser: UserStatus) => {
        if (!otherUser.mousePosition) {
          return null;
        }
        const positionOnScreen = flowToScreenPosition(otherUser.mousePosition);
        return (
          <Cursor
            key={otherUser.username}
            color={
              COLORS[Number(otherUser.username.charCodeAt(0)) % COLORS.length]
            }
            x={positionOnScreen.x - props.offset.left}
            y={positionOnScreen.y - props.offset.top}
            username={otherUser.username}
          />
        );
      })}
    </>
  );
});
LiveCursors.displayName = "LiveCursors";

export default LiveCursors;
