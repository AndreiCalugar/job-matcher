import type { ProfileEdit } from "@/lib/cv/schema";

// Resolve a dotted/indexed path like "experience[0].bullets[2]" against the
// profile. Returns undefined when any segment is missing. No eval, no
// prototype access: only own properties of plain data.
export function resolvePath(profile: ProfileEdit, p: string): unknown {
  if (p === "posting") return "posting";
  const segs = p.match(/[A-Za-z_]+|\[\d+\]/g);
  if (!segs || segs.join("") !== p.replace(/\./g, "")) return undefined;
  let node: unknown = profile;
  for (const seg of segs) {
    if (node == null || typeof node !== "object") return undefined;
    if (seg.startsWith("[")) {
      if (!Array.isArray(node)) return undefined;
      node = node[Number(seg.slice(1, -1))];
    } else {
      if (!Object.prototype.hasOwnProperty.call(node, seg)) return undefined;
      node = (node as Record<string, unknown>)[seg];
    }
  }
  return node;
}

// Flatten every string in the profile into one corpus for lexical checks.
export function profileCorpus(profile: ProfileEdit): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (typeof v === "number") parts.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(profile);
  return parts.join("\n");
}
