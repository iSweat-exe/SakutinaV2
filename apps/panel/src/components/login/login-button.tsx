"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/browser";

/** Starts the Discord OAuth flow through Supabase; /auth/callback finishes it. */
export function LoginButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const callbackError = useSearchParams().get("error") === "auth";

  async function signIn() {
    setPending(true);
    setFailed(false);

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "guilds" },
      });
      if (error) {
        throw error;
      }
    } catch {
      setPending(false);
      setFailed(true);
    }
  }

  const message = failed
    ? "Sign-in is not available right now. Try again in a moment."
    : callbackError
      ? "Discord sign-in did not complete. Please try again."
      : null;

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] border border-line-strong bg-raised text-[15px] font-semibold text-fg transition-colors hover:border-accent hover:bg-[#1f1a1a] disabled:cursor-wait disabled:opacity-70"
      >
        <Icon name="chat" size={20} strokeWidth={1.8} className="text-[#9aa3ff]" />
        <span>{pending ? "Redirecting to Discord…" : "Login with Discord"}</span>
      </button>
      {message ? (
        <p role="alert" className="m-0 text-[13px] text-danger">
          {message}
        </p>
      ) : null}
    </>
  );
}
