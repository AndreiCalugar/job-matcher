// Replaces `import "server-only"` in lib modules. That package throws in
// any non-React-server runtime, which includes the ingest script run by
// GitHub Actions. This guard keeps the intent — these modules must never
// reach a browser bundle — while allowing plain Node.
if (typeof window !== "undefined") {
  throw new Error("This module is server-only and must not be imported from client code.");
}
export {};
