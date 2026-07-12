"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Page() {
    const router = useRouter();
    function gotowordrails() {
      router.push("/wordrails");
    }
    function gotopivot() {
      router.push("/pivot");
    }
    function gotoentropy() {
      router.push("/entropy");
    }
    return (
      <section className="p-4 space-y-4">
        <h1 className="text-[2rem] px-[35%] pb-4  font-bold">MESH Applications</h1>
        <div className="space-y-4 ">
            <div  className="flex flex-wrap gap-4 w-fit h-full">
              <Button variant={"outline"} className="likebutton text-[1.2rem] h-full p-4" type="submit" onClick={gotowordrails}>
              <Image
              src="/assets/workspace.svg"
              alt="wordrails"
              className="mr-2"
              width={24}
              height={24}
            />
                Word Rails              
                </Button>
                <div className="space-y-4"></div>
                <Button variant={"outline"} className="likebutton text-[1.2rem] h-full p-4" type="submit" onClick={gotopivot}>
              <Image
              src="/assets/pivotgame.svg"
              alt="pivot"
              className="mr-2"
              width={24}
              height={24}
            />
                Pivot            
                </Button>
                <div className="space-y-4"></div>
                <Button variant={"outline"} className="likebutton text-[1.2rem] h-full p-4" type="submit" onClick={gotoentropy}>
              <Image
              src="/assets/data-blob.svg"
              alt="entropy"
              className="mr-2"
              width={24}
              height={24}
            />
                Entropy            
                </Button>
            </div>
        </div>
      </section>
    );
  }
  