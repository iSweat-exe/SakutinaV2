import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Pages reachable without being signed in (with everything under them). */
const PUBLIC_PATHS = ["/login", "/auth", "/design"];

/** The landing page; only "/" itself, not every path. Signed-in visitors go straight to /servers. */
const LANDING = "/";

function isPublic(pathname: string): boolean {
  return pathname === LANDING || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Keeps the Supabase session fresh and sends visitors who are not signed in
 * to /login. Authorization (who may manage the server) is separate and not
 * enforced yet: today every page shows layout and bot health only, and every
 * section that would show server data is locked.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let response = NextResponse.next({ request });
  let signedIn = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const { data } = await supabase.auth.getClaims();
    signedIn = data !== null;
  }

  if (!signedIn && !isPublic(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (signedIn && (pathname === "/login" || pathname === LANDING)) {
    return NextResponse.redirect(new URL("/servers", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
