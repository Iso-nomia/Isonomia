"use client";

import { MOUSE_EVENT } from "@/constants";
import { RealtimeChannel } from "@supabase/supabase-js";
import { ReactFlowInstance } from "@xyflow/react";
import { useState, useEffect } from "react";

let constant = 0;
// Helper function for sending our own mouse position.
function sendMousePosition(
  channel: RealtimeChannel,
  username: string,
  mousePosition: { x: number; y: number }
) {
  constant++;
  if (constant % 5 === 0) {
    return channel.send({
      type: "broadcast",
      event: MOUSE_EVENT,
      payload: { username, mousePosition },
    });
  }
}

const useMousePosition = (
  channel: RealtimeChannel,
  username: string,
  reactFlowInstance: ReactFlowInstance
) => {
  const [mousePosition, setMousePosition] = useState({
    x: 0,
    y: 0,
  });
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
      sendMousePosition(
        channel,
        username,
        reactFlowInstance.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
      );
    };
    window.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("drag", updateMousePosition);
    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      window.removeEventListener("drag", updateMousePosition);
    };
  }, [channel, username, reactFlowInstance]);
  return mousePosition;
};

export default useMousePosition;
