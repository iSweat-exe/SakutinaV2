import { NextResponse } from "next/server";
import { encodeGuilds, fetchUserGuilds, GUILDS_COOKIE, GUILDS_COOKIE_MAX_AGE } from "@/lib/discord-guilds";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(`${origin}/servers`);
      // Supabase gives the Discord token only now: read the servers, keep a compact copy, drop the token.
      const accessToken = data.session?.provider_token;

      if (accessToken) {
        response.cookies.set(GUILDS_COOKIE, encodeGuilds(await fetchUserGuilds(accessToken)), {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: GUILDS_COOKIE_MAX_AGE,
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
