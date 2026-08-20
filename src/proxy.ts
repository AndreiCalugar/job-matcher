import { NextResponse, type NextRequest } from "next/server";

// Single-user gate until Phase 8 brings real auth. HTTP Basic Auth over
// every route: the app has unauthenticated forms that spend API credits
// and overwrite the profile, so the front door needs a lock even though
// the database (RLS, service role) does not.
//
// Fail closed: if the credentials are not configured in a deployed
// environment, respond 503 rather than serve the app open. Local dev
// (no VERCEL env) runs open so `next dev` needs no setup.

export function proxy(request: NextRequest) {
  const expectedUser = process.env.APP_BASIC_USER;
  const expectedPass = process.env.APP_BASIC_PASS;

  if (!expectedUser || !expectedPass) {
    if (process.env.VERCEL) {
      return new NextResponse("Access not configured.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = safeAtob(header.slice(6));
    const i = decoded.indexOf(":");
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    if (i > 0 && timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="job-match", charset="UTF-8"' },
  });
}

function safeAtob(s: string): string {
  try {
    return atob(s);
  } catch {
    return "";
  }
}

// Length-independent comparison; good enough for a shared secret on the
// edge runtime, which has no crypto.timingSafeEqual.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const config = {
  // Everything except Next's own assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
