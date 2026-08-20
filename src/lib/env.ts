import "@/lib/server-guard";
import { z } from "zod";

// Zod at the boundary (CLAUDE.md "Conventions"). A missing key fails at first
// import with a named field, not as an opaque 500 from the Supabase client.
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  // Service role: bypasses RLS. Server-only by construction — this module
  // imports the server guard, so bundling it into a client component is a
  // runtime error at module load, not a leak.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const env = schema.parse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
