"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import Image from "next/image";

interface Props {
  generateOnClick: (evt: React.MouseEvent<HTMLButtonElement>) => void;
}

const GenerateButton = ({ generateOnClick }: Props) => {
  return (
    <div>
      <Button
        className="relative -left-4 px-1 py-3"
        btype="delete"
        onClick={generateOnClick}
      >
        <Image src="/assets/robot.svg" width={24} height={24} alt="generate" />
      </Button>
    </div>
  );
};

export default GenerateButton;
