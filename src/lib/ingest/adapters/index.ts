import type { Adapter, SourceKind } from "@/lib/ingest/types";
import { ashby } from "./ashby";
import { arbeitnow, jobicy, remoteok } from "./aggregators";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";

export const ADAPTERS: Partial<Record<SourceKind, Adapter>> = {
  greenhouse, lever, ashby, arbeitnow, jobicy, remoteok,
};
// Not yet: workable, recruitee, personio (XML), adzuna/jsearch (keys).
