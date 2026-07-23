#!/usr/bin/env node
// tools/gen.mjs — generate data.json from live GitHub state.
//
// Reads catalog.json (hand-owned editorial truth), pulls per-repo state from
// GitHub via the `gh` CLI (already token-authed — no secrets in this file),
// and writes data.json, which index.html renders alongside the catalog.
//
// Never writes catalog.json. Safe to re-run. Requires: node >=18, gh (authed).
//
//   node tools/gen.mjs            # writes ./data.json
//   node tools/gen.mjs --dry      # print to stdout, don't write
//
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const execFileP = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

// ---- gh helpers -----------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Per-call wall-clock cap: a hung socket must not stall the whole run. On
// timeout execFile kills gh (err.killed / SIGTERM), which we retry.
const CALL_TIMEOUT_MS = 25000;

// Transient faults worth retrying (this link is flaky); a real HTTP 404 is NOT
// transient and must fall straight through to the caller.
function isTransient(err) {
  if (err && (err.killed || err.signal === "SIGTERM" || err.code === "ETIMEDOUT")) return true;
  const msg = String((err && (err.stderr || err.message)) || err || "");
  return /TLS handshake timeout|i\/o timeout|dial tcp|EOF|connection reset|timeout awaiting|deadline exceeded|handshake failure|ETIMEDOUT|ECONNRESET/i.test(
    msg,
  );
}

// execFile(gh) with a per-call timeout and backoff on transient errors only.
async function runGh(args, opts = {}) {
  const maxBuffer = opts.maxBuffer || 16 * 1024 * 1024;
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await execFileP("gh", args, { maxBuffer, timeout: CALL_TIMEOUT_MS });
    } catch (err) {
      const msg = String(err.stderr || err.message || "");
      if (/HTTP 404|Not Found/i.test(msg) || !isTransient(err)) throw err;
      lastErr = err;
      await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s
    }
  }
  throw lastErr;
}

// Run `gh` and return parsed JSON. Throws on non-zero exit.
async function gh(args) {
  const { stdout } = await runGh(args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout.trim() ? JSON.parse(stdout) : null;
}

// `gh api <path> --jq <expr>`, tolerating 404 -> null.
async function ghApiJq(path, jq) {
  try {
    const { stdout } = await runGh(["api", path, "--jq", jq], { maxBuffer: 16 * 1024 * 1024 });
    const t = stdout.trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch { return t; }
  } catch (err) {
    const msg = String(err.stderr || err.message || "");
    if (/HTTP 404|Not Found/i.test(msg)) return null;
    throw err;
  }
}

function is403(msg) {
  return /HTTP 403|not accessible|Forbidden/i.test(msg);
}

// Soft JSON fetch: distinguishes "absent" (404 -> value:null) from "forbidden"
// (403 -> forbidden:true) so a token missing one permission (e.g. Actions:read)
// degrades that one field instead of failing the whole repo. Rethrows anything
// else. Returns { ok, value } | { ok:false, forbidden:true, msg }.
async function ghApiJqSoft(path, jq) {
  try {
    const { stdout } = await runGh(["api", path, "--jq", jq], { maxBuffer: 16 * 1024 * 1024 });
    const t = stdout.trim();
    let value = null;
    if (t) { try { value = JSON.parse(t); } catch { value = t; } }
    return { ok: true, value };
  } catch (err) {
    const msg = String(err.stderr || err.message || "");
    if (/HTTP 404|Not Found/i.test(msg)) return { ok: true, value: null };
    if (is403(msg)) return { ok: false, forbidden: true, msg };
    throw err;
  }
}

// Soft existence check: true (present) / false (404) / null (forbidden-unknown).
async function ghExistsSoft(path) {
  try {
    await runGh(["api", path, "--silent"], { maxBuffer: 8 * 1024 * 1024 });
    return true;
  } catch (err) {
    const msg = String(err.stderr || err.message || "");
    if (/HTTP 404|Not Found/i.test(msg)) return false;
    if (is403(msg)) return null;
    throw err;
  }
}

// Fetch a repo file's raw text. 404 -> value:null (absent); 403 -> forbidden.
async function ghRawSoft(path) {
  try {
    const { stdout } = await runGh(
      ["api", path, "-H", "Accept: application/vnd.github.raw"],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    return { ok: true, value: stdout };
  } catch (err) {
    const msg = String(err.stderr || err.message || "");
    if (/HTTP 404|Not Found/i.test(msg)) return { ok: true, value: null };
    if (is403(msg)) return { ok: false, forbidden: true };
    throw err;
  }
}

// ---- tiny concurrency limiter --------------------------------------------

function pLimit(n) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

// ---- derivation -----------------------------------------------------------

const DAY = 86400000;

function freshness(pushedAt, archived, now) {
  if (archived) return "archived";
  if (!pushedAt) return "unknown";
  const age = (now - new Date(pushedAt).getTime()) / DAY;
  if (age <= 30) return "fresh";
  if (age <= 180) return "active";
  return "stale";
}

// A repo is a titterpig DSL corpus when its slug starts titterpig-dsl-
// (the core `titterpig-dsl` grammar repo is excluded — it isn't a corpus).
function isDslCorpus(slug) {
  return slug.startsWith("titterpig-dsl-");
}

// Parse a TASKS.md into structured tasks. Convention: GitHub-flavored checkbox
// list items — `- [ ] text` (open) / `- [x] text` (done) — anywhere in the file.
// Optional inline markers: `(p1)`..`(p3)` priority, `#tag` tags (both stripped
// from the displayed text and collected). Non-checkbox lines (headings, prose)
// are ignored, so the file stays a normal, GitHub-rendered document.
function parseTasks(md) {
  const tasks = [];
  const re = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/;
  for (const line of String(md).split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    const done = m[1].toLowerCase() === "x";
    let text = m[2];
    let priority = null;
    const pm = text.match(/\(p([1-3])\)/i);
    if (pm) { priority = Number(pm[1]); text = text.replace(pm[0], " "); }
    const tags = [];
    for (const tm of text.matchAll(/(?:^|\s)#([a-z0-9][\w-]*)/gi)) tags.push(tm[1].toLowerCase());
    text = text.replace(/(?:^|\s)#[a-z0-9][\w-]*/gi, " ").replace(/\s+/g, " ").trim();
    if (text) tasks.push({ text, done, priority, tags, source: "backlog" });
  }
  return tasks;
}

// Turn Phase-1 standards gaps into open tasks, so the queue is populated even
// before anyone hand-writes a TASKS.md. Self-clearing: when the gap closes, the
// next generation run simply stops emitting the task. Skipped for archived repos
// and where standards couldn't be read (accessLimited).
function deriveStandardsTasks(out) {
  const s = out.standards;
  if (out.archived || !s) return [];
  const t = [];
  if (s.readme === false)
    t.push({ text: "Add a README", done: false, priority: 3, tags: ["docs"], source: "standards" });
  if (s.license === false)
    t.push({ text: "Add a LICENSE", done: false, priority: 3, tags: ["standards"], source: "standards" });
  // Generic CI task for any repo missing a workflow. NB: for DSL corpora this is
  // deliberately NOT a coverage gate — the coverageAudit gate can't run honestly
  // in CI (no committable/trusted source outline); see sortilege-index/TASKS.md.
  if (s.ci === false)
    t.push({ text: "Add a CI workflow", done: false, priority: 3, tags: ["ci"], source: "standards" });
  return t;
}

// ---- main -----------------------------------------------------------------

async function main() {
  const now = Date.now();
  const catalog = JSON.parse(await readFile(join(ROOT, "catalog.json"), "utf8"));
  const owner = catalog.owner;

  // Every tracked slug, plus a back-reference to where it lives.
  const tracked = new Map(); // slug -> { tab, group, name }
  for (const tab of catalog.tabs) {
    for (const group of tab.groups) {
      for (const p of group.projects) {
        tracked.set(p.repo, { tab: tab.id, group: group.name, name: p.name });
      }
    }
  }

  // One call for the whole org's baseline state.
  const orgList = await gh([
    "repo", "list", owner, "--limit", "300", "--no-archived=false",
    "--json", "name,description,pushedAt,isArchived,isPrivate,visibility,defaultBranchRef,primaryLanguage,licenseInfo,repositoryTopics,hasIssuesEnabled",
  ]);
  const orgByName = new Map(orgList.map((r) => [r.name, r]));

  const limit = pLimit(4);
  const errors = [];

  // Enrich one repo with the calls that need per-repo requests.
  async function enrich(slug, base) {
    const out = {
      slug,
      description: base?.description ?? null,
      pushedAt: base?.pushedAt ?? null,
      archived: !!base?.isArchived,
      visibility: base?.visibility ? String(base.visibility).toLowerCase() : null,
      defaultBranch: base?.defaultBranchRef?.name ?? null,
      language: base?.primaryLanguage?.name ?? null,
      license: base?.licenseInfo?.spdxId ?? base?.licenseInfo?.key ?? null,
      topics: (base?.repositoryTopics || []).map((t) => t.name).filter(Boolean),
      hasIssues: !!base?.hasIssuesEnabled,
    };
    out.freshness = freshness(out.pushedAt, out.archived, now);
    out.isDslCorpus = isDslCorpus(slug);

    try {
      // Repo detail (open issues+PRs) needs Metadata:read and gates the rest.
      // A 403 here means the token can't see into this repo at all — flag it
      // once, keep the org-list-derived fields (pushedAt/freshness), and stop.
      const meta = await ghApiJqSoft(`repos/${owner}/${slug}`, ".open_issues_count");
      if (meta.forbidden) {
        out.accessLimited = true;
        return out;
      }
      out.openItems = meta.value;

      // Latest Actions run needs Actions:read; a 403 just means "no CI
      // visibility" (common — the read-only token may omit Actions), not a
      // failure. Treat it as unknown rather than erroring the whole repo.
      const run = await ghApiJqSoft(
        `repos/${owner}/${slug}/actions/runs?per_page=1`,
        "if (.workflow_runs | length) > 0 then .workflow_runs[0] | {name,status,conclusion,created_at,head_branch} else null end",
      );
      out.lastRun = run.forbidden ? null : (run.value || null);

      // Standards checks (Contents:read). null = couldn't verify (forbidden).
      const [readme, ci] = await Promise.all([
        ghExistsSoft(`repos/${owner}/${slug}/readme`),
        ghExistsSoft(`repos/${owner}/${slug}/contents/.github/workflows`),
      ]);
      out.standards = {
        readme,
        license: !!out.license,
        ci,
      };

      // Hand-authored backlog (TASKS.md) + auto-derived standards-debt tasks.
      const backlog = await ghRawSoft(`repos/${owner}/${slug}/contents/TASKS.md`);
      const authored = backlog.ok && backlog.value ? parseTasks(backlog.value) : [];
      out.hasBacklog = !!(backlog.ok && backlog.value);
      out.tasks = [...authored, ...deriveStandardsTasks(out)];
    } catch (err) {
      errors.push({ slug, error: String(err.stderr || err.message || err).slice(0, 300) });
    }
    return out;
  }

  // Enrich all tracked repos.
  const repoEntries = await Promise.all(
    [...tracked.keys()].map((slug) =>
      limit(async () => {
        const base = orgByName.get(slug);
        if (!base) {
          errors.push({ slug, error: "in catalog but not found in org repo list" });
          return [slug, { slug, missing: true }];
        }
        return [slug, await enrich(slug, base)];
      }),
    ),
  );
  const repos = Object.fromEntries(repoEntries);

  // Untracked = in org, absent from catalog (skip archived-on-github noise? keep all).
  const untracked = orgList
    .filter((r) => !tracked.has(r.name))
    .map((r) => ({
      slug: r.name,
      description: r.description ?? null,
      pushedAt: r.pushedAt ?? null,
      archived: !!r.isArchived,
      visibility: r.visibility ? String(r.visibility).toLowerCase() : null,
      freshness: freshness(r.pushedAt, r.isArchived, now),
      isDslCorpus: isDslCorpus(r.name),
    }))
    .sort((a, b) => (b.pushedAt || "").localeCompare(a.pushedAt || ""));

  const data = {
    generatedAt: new Date(now).toISOString(),
    owner,
    counts: {
      tracked: tracked.size,
      org: orgList.length,
      untracked: untracked.length,
      accessLimited: Object.values(repos).filter((r) => r.accessLimited).length,
      openTasks: Object.values(repos).reduce(
        (n, r) => n + ((r.tasks || []).filter((t) => !t.done).length), 0),
      backlogRepos: Object.values(repos).filter((r) => r.hasBacklog).length,
      errors: errors.length,
    },
    repos,
    untracked,
    errors,
  };

  const json = JSON.stringify(data, null, 2) + "\n";
  if (DRY) {
    process.stdout.write(json);
  } else {
    await writeFile(join(ROOT, "data.json"), json);
    console.error(
      `data.json: ${tracked.size} tracked, ${untracked.length} untracked, ${errors.length} errors`,
    );
  }
}

// Pure helpers are exported for unit testing; main() runs only when this file
// is executed directly (not when imported).
export { parseTasks, deriveStandardsTasks, freshness, isDslCorpus };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("gen.mjs failed:", err);
    process.exit(1);
  });
}
