#!/usr/bin/env node
/**
 * Copies the Supabase Storage `resumes` bucket into the Cloudflare R2 bucket.
 *
 * ## Key preservation is the whole point
 *
 * Objects are stored at `resumes/{uid}/{timestamp}-{filename}` *inside* a bucket already
 * named `resumes` — a doubled prefix, because app/api/resume/upload/route.ts builds the key
 * that way. Stored `user_resumes.file_url` values embed it, so keys are copied **verbatim**.
 * Rewriting them here would mean rewriting every row in the database too.
 *
 * ## Idempotent and resumable
 *
 * Every object is checked in R2 first and skipped if already present with a matching size,
 * so this can be re-run safely — which is what makes it usable both for the early bulk copy
 * and for the final delta sync inside the cutover window.
 *
 * ## Verification, and what it can and cannot prove
 *
 * Reports per-object size parity. It deliberately does NOT compare object count against
 * `SELECT count(*) FROM user_resumes`: the delete path in app/api/resume/route.ts has always
 * computed the wrong key (`file_url.split("/").pop()` yields only the filename, not the full
 * key), so `.remove()` has never actually deleted anything and the bucket holds orphans.
 * Object count exceeding row count is expected, not a migration failure.
 *
 * ## Known limitation: keys containing spaces
 *
 * `wrangler r2 object put` percent-encodes the key while reporting the unencoded name, so
 * an object whose key contains a space lands at `...a%20b.pdf` — a literal `%20` — and a
 * later `get` of the real key misses. `put` encodes, `get` does not; the two are asymmetric,
 * and there is no CLI input that produces a literal space. Verified against wrangler 4.56.0.
 *
 * Those objects are therefore SKIPPED and reported rather than silently mis-keyed. Copying
 * them needs an S3-compatible path (rclone or aws4fetch with R2 access keys) or a Worker
 * with an R2 binding, both of which write keys literally.
 *
 * Only legacy objects are affected: lib/utils/sanitize-filename.ts replaces whitespace with
 * underscores and is applied at app/api/resume/upload/route.ts:203, so no upload since then
 * can produce such a key.
 *
 * Usage:
 *   node scripts/migration/supabase-storage-to-r2.mjs --dry-run
 *   node scripts/migration/supabase-storage-to-r2.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SOURCE_BUCKET = "resumes";
const TARGET_BUCKET = "careerotter-resumes";
const DRY_RUN = process.argv.includes("--dry-run");

function fromEnvFile(key) {
  for (const f of [".env", ".env.local"]) {
    try {
      const m = readFileSync(join(ROOT, f), "utf-8").match(
        new RegExp(`^${key}=(.*)$`, "m")
      );
      if (m) return m[1].trim().replace(/^"|"$/g, "");
    } catch {
      /* next */
    }
  }
}

const supabase = createClient(
  fromEnvFile("NEXT_PUBLIC_SUPABASE_URL"),
  fromEnvFile("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

/** Walks the bucket depth-first. Supabase's list() is one level at a time. */
async function listAllObjects(prefix = "") {
  const { data, error } = await supabase.storage
    .from(SOURCE_BUCKET)
    .list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${prefix}: ${error.message}`);

  const objects = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // A directory placeholder has no id; only real objects carry metadata.
    if (entry.id === null || entry.metadata == null) {
      objects.push(...(await listAllObjects(path)));
    } else {
      objects.push({ key: path, size: entry.metadata.size ?? 0 });
    }
  }
  return objects;
}

/** R2 HEAD via wrangler. The OAuth session has no S3 keys, so the CLI is the access path. */
function existsInR2(key) {
  try {
    const out = execFileSync(
      "wrangler",
      ["r2", "object", "get", `${TARGET_BUCKET}/${key}`, "--pipe"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
    );
    return out.length;
  } catch {
    return null;
  }
}

const objects = await listAllObjects();
console.log(
  `${objects.length} object(s), ${(objects.reduce((n, o) => n + o.size, 0) / 1024 / 1024).toFixed(2)} MB` +
    (DRY_RUN ? "  [DRY RUN]" : "")
);

const scratch = mkdtempSync(join(tmpdir(), "r2-migrate-"));
let copied = 0;
let skipped = 0;
const failures = [];

try {
  for (const [i, obj] of objects.entries()) {
    const progress = `[${i + 1}/${objects.length}]`;

    // See the docblock: wrangler mangles keys containing spaces, so refuse rather than
    // write an object nobody will be able to find.
    if (/\s/.test(obj.key)) {
      failures.push({
        key: obj.key,
        reason:
          "key contains whitespace; wrangler r2 object put would store it percent-encoded. " +
          "Copy via rclone/S3 or an R2 binding.",
      });
      continue;
    }

    const present = existsInR2(obj.key);
    if (present !== null && present === obj.size) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`${progress} would copy ${obj.key} (${obj.size} bytes)`);
      copied++;
      continue;
    }

    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .download(obj.key);
    if (error) {
      failures.push({ key: obj.key, reason: `download: ${error.message}` });
      continue;
    }

    // Staged through a file because `wrangler r2 object put` takes --file, and streaming
    // a multi-MB PDF through argv is not an option.
    const staged = join(scratch, "object.bin");
    writeFileSync(staged, Buffer.from(await data.arrayBuffer()));

    try {
      execFileSync(
        "wrangler",
        ["r2", "object", "put", `${TARGET_BUCKET}/${obj.key}`, "--file", staged],
        { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] }
      );
      copied++;
      if (copied % 10 === 0) console.log(`${progress} copied ${copied}…`);
    } catch (e) {
      failures.push({ key: obj.key, reason: `upload: ${String(e).slice(0, 120)}` });
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\ncopied: ${copied}   already present: ${skipped}   failed: ${failures.length}`);
for (const f of failures) console.log(`  FAIL ${f.key} — ${f.reason}`);
process.exit(failures.length === 0 ? 0 : 1);
