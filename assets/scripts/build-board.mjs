#!/usr/bin/env node
// Spec Growth — genera BOARD.md y openspec/board.json (v0.9).
// Secciones humanas: aprobaciones pendientes · decisiones/⚔ conflictos · en curso (con
// evidencia verde real) · borradores · waivers registrados · estados inválidos · bloqueados ·
// archivo · warnings. La registry de capacidades es dato de máquina.
// Uso: node scripts/gates/build-board.mjs [--root DIR]
import { existsSync } from "node:fs";
import { join, normalize } from "node:path";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const eq = args.find((a) => a.startsWith(n + "="));
  if (eq) return eq.slice(n.length + 1);
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
};
const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes"))) {
  console.error(`No existe openspec/changes/ bajo: ${root}`);
  process.exit(1);
}

const STATUSES = ["draft", "accepted", "applying", "verified", "blocked", "rejected", "superseded"];
const ADVANCED = ["accepted", "applying", "verified"];
const TERMINAL = ["rejected", "superseded"];

const parseErrors = [];
const changes = lib.listChanges(root, parseErrors);
const { archived, digests } = lib.listArchive(root);
const cfg = lib.readConfig(root);
const evidence = lib.readEvidence(root);

// capacidades (vivas + deltas) — solo para duplicados visibles
const caps = new Map();
const pushCap = (id, source, path) => {
  const key = String(id).trim().toLowerCase();
  if (!caps.has(key)) caps.set(key, []);
  caps.get(key).push({ source, path });
};
for (const cap of lib.listCapabilities(root)) for (const id of cap.provides) pushCap(id, "living", cap.path);
for (const c of changes) {
  for (const f of lib.walkMd(join(c.dir, "specs"))) {
    const fm = lib.readFrontmatter(f);
    for (const id of lib.arr(fm.provides)) pushCap(id, c.id, `changes/${c.id}`);
  }
}
const duplicates = [...caps.entries()].filter(([, p]) => p.length > 1);

// warnings globales
const warnings = [];
for (const pe of parseErrors) {
  warnings.push(`${pe.id}: ${pe.file}${pe.line ? ` línea ${pe.line}` : ""} — ${pe.text.slice(0, 70)}`);
}
{
  const tracked = lib.listTrackedFiles(root);
  const byId = new Map(changes.map((c) => [c.id, c]));
  const reachMemo = new Map();
  const reach = (from) => {
    if (reachMemo.has(from)) return reachMemo.get(from);
    const seen = new Set();
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const dep of (byId.get(cur) || {}).deps || []) {
        if (seen.has(dep)) continue;
        seen.add(dep);
        if (byId.has(dep)) q.push(dep);
      }
    }
    reachMemo.set(from, seen);
    return seen;
  };
  const sequenced = (x, y) => reach(x).has(y) || reach(y).has(x);
  const pairs = [];
  for (const c of changes) {
    if (TERMINAL.includes(c.status)) continue;
    for (const t of c.targets) {
      const expanded = lib.expandTarget(root, t, tracked) || [lib.pathKey(t)];
      for (const key of expanded) pairs.push({ id: c.id, status: c.status, raw: String(t), key });
    }
  }
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.id === b.id) continue;
      if (!lib.targetsOverlap(a.key, b.key)) continue;
      const k = [a.id, b.id].sort().join("|") + "::" + [a.key, b.key].sort().join(" ~ ");
      if (seen.has(k)) continue;
      seen.add(k);
      warnings.push(
        `targets solapados: '${a.raw}' (${a.id}, ${a.status}) y '${b.raw}' (${b.id}, ${b.status})` +
          (sequenced(a.id, b.id) ? " — secuenciado por deps (orden declarado)" : "")
      );
    }
  }
}
for (const [id, providers] of duplicates) {
  warnings.push(`capacidad duplicada ${id}: ${providers.map((p) => p.source).join(", ")}`);
}

// clasificación
const pendingApproval = [];
const pendingDecision = [];
const pendingConflict = [];
const inProgress = [];
const drafts = [];
const blocked = [];
const invalid = [];
const openWaivers = [];
for (const c of changes) {
  const hits = new Map();
  for (const t of c.targets) {
    const z = lib.matchZones(t, cfg.protectedZones);
    if (z) hits.set(z.glob, t);
  }
  if (hits.size && !c.human_approved && !TERMINAL.includes(c.status)) {
    pendingApproval.push({ c, zones: [...hits.keys()] });
  }
  for (const d of c.open_decisions) {
    if (d.question && !TERMINAL.includes(c.status)) pendingDecision.push({ c, d });
  }
  for (const cf of c.conflicts) {
    if (cf.what && !TERMINAL.includes(c.status)) pendingConflict.push({ c, cf });
  }
  for (const w of c.waivers) {
    if (!TERMINAL.includes(c.status)) openWaivers.push({ c, w });
  }
  if (!STATUSES.includes(c.status)) invalid.push(c);
  else if (ADVANCED.includes(c.status)) inProgress.push(c);
  else if (c.status === "draft") drafts.push(c);
  else if (["blocked", "rejected", "superseded"].includes(c.status)) blocked.push(c);
}

const fmt = (iso) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

function evidenceBadge(c) {
  if (evidence && evidence.gate_ok === false) return "⚠ última corrida del gate: ROJA (evidencia no vigente)";
  const rec = evidence && evidence.changes ? evidence.changes[c.id] : null;
  const green = rec && rec.green_tests;
  if (!green) return "⚠ sin evidencia verde de tests";
  let maxTs = 0;
  let nul = 0;
  for (const t of c.targets) {
    const ts = lib.gitLastCommitTs(root, t);
    if (ts) maxTs = Math.max(maxTs, ts);
    else nul++;
  }
  if (c.targets.length && nul === c.targets.length) return `⚠ evidencia (${fmt(green.at)}) — frescura no verificable`;
  if (maxTs && maxTs > Date.parse(green.at)) return `⚠ evidencia vieja (${fmt(green.at)})`;
  return `✅ evidencia ${fmt(green.at)} (tests)`;
}

const line = (c, extra = "") => `- [${c.status}] **${c.id}** (${c.kind})${c.title ? ` — ${c.title}` : ""}${extra}`;

// --- BOARD.md ---
let md = `# BOARD\n\n> Generado por \`node scripts/gates/build-board.mjs\` — **no editar a mano** · ${new Date().toISOString()}\n\n`;

md += `## 🔒 Esperando tu aprobación (zonas protegidas)\n\n`;
md += pendingApproval.length
  ? pendingApproval
      .map(
        ({ c, zones }) =>
          `- **${c.id}** (${c.kind}${c.status === "draft" ? ", draft" : ""}) — toca: ${zones.join(", ")} → al aprobar: \`human_approved: true\` + ADR en DECISIONS.md`
      )
      .join("\n")
  : "_(nada pendiente)_";
md += `\n\n## ⏸ Esperando tu decisión\n\n`;
md += pendingDecision.length || pendingConflict.length
  ? [
      ...pendingDecision.map(
        ({ c, d }) => `- **${c.id}** — "${d.question}"${d.proposal ? ` · propuesta: ${d.proposal}` : ""} → resolver + DECISIONS.md`
      ),
      ...pendingConflict.map(
        ({ c, cf }) =>
          `- **${c.id}** — ⚔ "${cf.what}" (contra ${cf.with})${cf.proposal ? ` · propuesta: ${cf.proposal}` : ""} → aprobar + DECISIONS.md`
      ),
    ].join("\n")
  : "_(nada pendiente)_";
md += `\n\n## En curso\n\n`;
md += inProgress.length
  ? inProgress.map((c) => line(c, c.status === "verified" ? ` · ${evidenceBadge(c)}` : "")).join("\n")
  : "_(vacío)_";
md += `\n\n## Borradores\n\n`;
md += drafts.length ? drafts.map((c) => line(c)).join("\n") : "_(vacío)_";
md += `\n\n## ⚠ Waivers registrados (pendientes y vigentes)\n\n`;
md += openWaivers.length
  ? openWaivers
      .map(({ c, w }) => `- **${c.id}** — ${w.type || "?"} (${w.state || "?"}${w.expires ? `, vence ${w.expires}` : ""}): ${w.reason || "sin razón"}`)
      .join("\n")
  : "_(ninguno)_";
if (invalid.length) {
  md += `\n\n## ⚠ Estado inválido (corregir .openspec.yaml)\n\n`;
  md += invalid.map((c) => `- **${c.id}** — status: \`${c.status}\``).join("\n");
}
md += `\n\n## Bloqueados / rechazados\n\n`;
md += blocked.length ? blocked.map((c) => line(c)).join("\n") : "_(vacío)_";
md += `\n\n## Archivo\n\n- Cambios archivados: ${archived.length}`;
if (digests.length) md += ` · digests: ${digests.join(", ")}`;
md += "\n";
if (archived.length) md += archived.slice(0, 5).map((a) => `- ${a}`).join("\n") + "\n";
if (warnings.length) md += `\n## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n`;
lib.writeAtomic(join(root, "BOARD.md"), md);

// --- board.json ---
const board = {
  generated_at: new Date().toISOString(),
  active_count: changes.length,
  active: changes,
  archive: { count: archived.length, digests, recent: archived.slice(0, 5) },
  registry: {
    capabilities: [...caps.entries()].map(([id, providers]) => ({ id, providers })),
    duplicates: duplicates.map(([id, providers]) => ({ id, providers })),
  },
  protected_zones: cfg.protectedZones,
  evidence: evidence
    ? { generated_at: evidence.generated_at, gate_ok: evidence.gate_ok !== false, mode: evidence.mode, tests: evidence.tests }
    : null,
  pacing: {
    pending_approval: pendingApproval.map(({ c }) => c.id),
    pending_decisions: pendingDecision.map(({ c }) => c.id),
    pending_conflicts: pendingConflict.map(({ c, cf }) => ({ change: c.id, with: cf.with, what: cf.what })),
    open_waivers: openWaivers.map(({ c, w }) => ({ change: c.id, type: w.type, state: w.state })),
    invalid_status: invalid.map((c) => c.id),
  },
  warnings,
};
lib.writeAtomic(join(root, "openspec", "board.json"), JSON.stringify(board, null, 2) + "\n");

console.log(
  `BOARD.md + openspec/board.json regenerados · ${changes.length} activo(s) · ${archived.length} archivado(s) · ` +
    `${pendingApproval.length} aprobación(es) · ${pendingDecision.length} decisión(es) · ${pendingConflict.length} conflicto(s) · ${openWaivers.length} waiver(s) abierto(s)` +
    (invalid.length ? ` · ⚠ ${invalid.length} estado(s) inválido(s)` : "")
);
if (warnings.length) console.log(`⚠ ${warnings.length} warning(s) — ver BOARD.md`);
