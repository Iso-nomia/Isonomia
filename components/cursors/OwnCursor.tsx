import useMousePosition from "@/components/hooks/MousePosition";
import Cursor from "./Cursor";
import { COLORS } from "@/constants";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useReactFlow } from "@xyflow/react";

// display all other live cursors
const OwnCursor = ({
  channel,
  username,
  offset,
}: {
  channel: RealtimeChannel;
  username: string;
  offset: { top: number; left: number };
}) => {
  const reactFlowInstance = useReactFlow();
  const mousePosition = useMousePosition(channel, username, reactFlowInstance);
  return (
    <Cursor
      color={COLORS[Number(username.charCodeAt(0)) % COLORS.length]}
      x={mousePosition.x - offset.left}
      y={mousePosition.y - offset.top}
      username={username}
    />
  );
};

export default OwnCursor;
