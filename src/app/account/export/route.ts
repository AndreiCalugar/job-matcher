import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

// GDPR Art. 20 — data portability. One JSON file, attachment.
export async function GET() {
  const user = await getUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 1), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="job-match-export-${data.exported_at.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
