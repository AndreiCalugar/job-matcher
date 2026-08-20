import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Session gate (Phase 8). Refreshes the Supabase session cookie on every
// request and sends signed-out users to /login. Public: /login,
// /auth/callback, /privacy. Fail closed: without the public Supabase env
// the app serves 503 rather than open.
const PUBLIC = [/^\/login$/, /^\/auth\/callback$/, /^\/privacy$/];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return new NextResponse("Access not configured.", { status: 503 });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const isPublic = PUBLIC.some((re) => re.test(request.nextUrl.pathname));
  if (!data.user && !isPublic) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
