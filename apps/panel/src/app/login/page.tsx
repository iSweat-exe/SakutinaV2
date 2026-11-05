import type { Metadata } from "next";
import { Suspense } from "react";
import { BotStatusLine, BotStatusLineFallback } from "@/components/login/bot-status-line";
import { LoginButton } from "@/components/login/login-button";
import { LoginScene } from "@/components/login/login-scene";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <LoginScene>
      <main className="relative box-border flex w-full max-w-[380px] flex-col items-center gap-6 rounded-[22px] border border-line bg-card px-8 pt-[58px] pb-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute -top-6 left-1/2 box-border flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-[14px] border border-line bg-raised pr-[18px] pl-2.5">
          <span aria-hidden="true" className="avatar-ph size-7" />
          <span className="font-display text-[17px] font-bold tracking-[0.01em]">Sakutina</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <h1 className="m-0 font-display text-4xl font-bold tracking-[-0.01em]">Login</h1>
          <p className="m-0 text-sm leading-[1.55] text-pretty text-muted">
            Sakutina needs to know who you are. Please log in using one of the options below.
          </p>
        </div>

        <hr className="m-0 w-full border-0 border-t border-line" />

        {/* useSearchParams (sign-in error) needs a boundary. */}
        <Suspense
          fallback={
            <div className="h-[52px] w-full rounded-[14px] border border-line-strong bg-raised" aria-hidden="true" />
          }
        >
          <LoginButton />
        </Suspense>

        <p className="m-0 text-[12.5px] leading-normal text-muted">
          By logging in, you agree to our <span className="text-fg-soft underline decoration-dotted">Terms</span> &amp;{" "}
          <span className="text-fg-soft underline decoration-dotted">Privacy Policy</span>.
        </p>
      </main>

      <Suspense fallback={<BotStatusLineFallback />}>
        <BotStatusLine />
      </Suspense>
    </LoginScene>
  );
}
