"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  src: string;
  title?: string;
}

const SoundCloudPlayer = ({ src, title }: Props) => {
  const waveRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1);
    gradient.addColorStop(0, "#9fb4ff");
    // gradient.addColorStop((canvas.height * 0.65 ) / canvas.height, "#E8E8E8");

    // gradient.addColorStop((canvas.height * 0.65) / canvas.height, "#464646");
    gradient.addColorStop(1, "#8da0e8");

    const progressGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 1);
    progressGradient.addColorStop(0, "#fdba74");
    // progressGradient.addColorStop((canvas.height * 0.65) / canvas.height, "#f97316");
    // progressGradient.addColorStop((canvas.height * 0.65) / canvas.height, "#fb923c");
    progressGradient.addColorStop(1, "#ea580c");

    waveRef.current = WaveSurfer.create({
      container: containerRef.current,
      // waveColor: "#000000",
      waveColor: gradient,

      progressColor: progressGradient,
      width:600,
      height: 58,
      normalize: true,
      barWidth: 4,
      barGap: 3,
      barRadius: 40,
      cursorColor: "#ffffff",
      cursorWidth: 2,
      autoplay: false,
      mediaControls: false,


    });
    if (src) waveRef.current.load(src).catch(() => null);
    waveRef.current.on("ready", () => setIsReady(true));
    return () => {
      try {
        waveRef.current?.destroy();
      } catch (err) {
        console.error("WaveSurfer destroy failed", err);
      }
    };
  }, [src]);

  const togglePlay = () => {
    if (!waveRef.current) return;
    waveRef.current.playPause();
    setIsPlaying(waveRef.current.isPlaying());
  };

  return (
    <div className="flex flex-1 w-[100%] flex-col">
      <h1 className=" px-20 tracking-wide text-[1.2rem] whitespace-nowrap justify-center items-center  mt-0 w-full pb-2">{title}</h1>
      <hr />
      {!isReady && <Skeleton className="flex w-full h-[90px] items-center gap-5 mt-2 py-2 w-full" />}
      <div className={`flex items-center gap-7 mt-2 py-2 w-full ${!isReady ? "hidden" : ""}`}>
        {isPlaying ? (
          <button
            onClick={togglePlay}
            className="playbutton outline-transparent  bg-rose-100 bg-opacity-20 p-4 rounded-full"
          >
            <Image src="/assets/pause--filled.svg" alt="pause" width={20} height={20} />
          </button>
        ) : (
          <button
            onClick={togglePlay}
            className="playbutton outline-transparent bg-rose-100 bg-opacity-20 p-4 rounded-full "
          >
            <Image src="/assets/play--filled--alt.svg" alt="play" width={20} height={20} />
          </button>
        )}
        <div className="flex flex-1 w-full ">
          <div ref={containerRef} className="flex flex-1 px-0 py-0 rounded-full  w-full" />
        </div>
      </div>
    </div>
  );
};

export default SoundCloudPlayer;
