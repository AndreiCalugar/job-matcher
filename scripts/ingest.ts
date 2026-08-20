/**
 * Unattended ingest. `npm run ingest` locally (reads .env.local) or from
 * GitHub Actions on a schedule (reads secrets). Exit code is 0 even when
 * individual sources fail — failures are on the source rows and in
 * failed_ingest, and the cron must keep running. Exit 1 only if the run
 * itself could not start (no DB, bad env).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.resolve(__dirname, "..", ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
  }
}
loadEnvLocal();

async function main() {
  const { runIngest } = await import("../src/lib/ingest/run");
  const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };
  const report = await runIngest({
    log: (l) => console.log(l),
    scoreCap: arg("score-cap") ? Number(arg("score-cap")) : undefined,
    parseCap: arg("parse-cap") ? Number(arg("parse-cap")) : undefined,
    onlySourceId: arg("source"),
  });
  console.log(JSON.stringify(report, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
