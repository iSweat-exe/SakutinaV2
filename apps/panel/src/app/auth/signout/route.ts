import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST only: signing out must not be triggerable by a link or a prefetch. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303 turns the POST into a GET on /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
