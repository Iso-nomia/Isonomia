"use client";

import { FormEvent, useState } from "react";
import Spinner from "@/components/ui/spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase/firebase";
import localFont from "next/font/local";

const founderslight = localFont({ src: "./NewEdgeTest-LightRounded.otf" });

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);
      const credential = await signInWithEmailAndPassword(
        getAuth(app),
        email,
        password
      );
      const idToken = await credential.user.getIdToken();

      await fetch("/api/login", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${founderslight.className}`}>
    
      <main className="flex min-h-screen max-w-screen w-full flex-col items-center justify-center  p-8"> 
         

          <h1 className="flex relative font-bold text-6xl tracking-[18px] justify-center text-center text-transparent drop-shadow-[0_0_25px_rgba(200,170,2100,0.5)]  textshadowmulti top-[-48px]">ISONOMIA</h1> 
        <div className="w-full bg-white bg-opacity-50  rounded-xl logincard dark:border md:mt-0 sm:max-w-md xl:p-0 dark:bg-gray-800 dark:border-gray-700">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h2 className="text-center textshadowbasic tracking-[5px] text-indigo-500/0  font-bold text-[33px]">
                Sign In
                            </h2>
            <form
              onSubmit={handleSubmit}
              className="space-y-10"
              action="#"
            >
              <div>
                <label
                  htmlFor="email"
                  className="block mb-3 text-[1.4rem] tracking-wide text-slate-700 dark:text-white"
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  id="email"
                  className=" text-gray-900 sm:text-sm rounded-lg  block w-full p-2.5 articlesearchfield"
                  placeholder="name@email.com"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block mb-3 text-[1.4rem] tracking-wide text-slate-700 dark:text-white"
                >
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  id="password"
                  placeholder="••••••••"
                  className=" text-gray-900 sm:text-sm rounded-lg  block w-full p-2.5 articlesearchfield"
                  required
                />
              </div>
              {error && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-4 rounded relative"
                  role="alert"
                >
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-[50%] text-[1.2rem] tracking-widest  items-center justify-center font-medium text-center content-center mx-auto text-slate-900 btnv2 py-3 px-2 rounded-full"
              >
                {loading && <Spinner className="mr-2" />} {loading ? "Loading" : "Next"}
              </button>
              <p className="text-[1.2rem] text-center mx-auto text-gray-500 dark:text-gray-400">
                No Account?{" "}
                <Link
                  href="/register"
                  className=" text-gray-800 ml-1 hover:underline dark:text-gray-500"
                >
                  Register Here
                </Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
