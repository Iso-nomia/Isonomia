"use client";

import { useState } from "react";
import { UserAttributes } from "@prisma/client";
import AccountProfile from "@/components/forms/AccountProfile";
import CustomButtons from "@/app/(root)/(standard)/profile/[id]/customize/customize-components";
import { joinRoom } from "@/lib/actions/realtimeroom.actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import localFont from "next/font/local";

const founderslight = localFont({ src: "./NewEdgeTest-LightRounded.otf" });
interface UserData {
  authId: string;
  userId: bigint | null;
  username: string;
  name: string;
  bio: string | null;
  image: string | null;
}

interface Props {
  userData: UserData;
  userAttributes: UserAttributes;
}

export default function OnboardingFlow({ userData, userAttributes }: Props) {
  const [step, setStep] = useState<"profile" | "customize">("profile");
  const router = useRouter();

  const handleProfileComplete = () => {
    setStep("customize");
  };

  const finishOnboarding = async () => {
    await joinRoom({ roomId: "global" });
    router.push("/room/global");
  };

  return (
    <main className="mx-auto flex flex-col max-w-3xl  justify-center items-center px-10 py-10 text-black">
      {step === "profile" && (
        <>
            <h1 className={`head-text ${founderslight.className}`}>

              Edit Your Profile</h1>
          <section className={`postcard mt-5 bg-white bg-opacity-20 p-10 text-black ${founderslight.className}`}>
            <AccountProfile user={userData} btnTitle="Continue" onSuccess={handleProfileComplete} />
          </section>
        </>
      )}
      {step === "customize" && (
        <>
            <h1 className={`head-text relative ${founderslight.className}`}>
            Customize Profile</h1>
          <CustomButtons userAttributes={userAttributes} initialOpen />
          <Button onClick={finishOnboarding} className={`flex flex-row mt-[48rem] bg-white px-5 py-2 rounded-md z-100
 ${founderslight.className}`}>
            Finish
          </Button>
        </>
      )}
    </main>
  );
}
