#!/usr/bin/env node
// Spec Growth — gate mecánico (v0.9).
// Checks: parse · estados (enum) · reason/superseded_by · overlaps (contención+globs,
//   severidad por trabajo activo; secuenciados por deps → warning) · [@test] · targets ·
//   fix/refactor→regresión · conflictos ⚔ · waivers
//   (granted vigente HABILITA; requested/vencido bloquean) · decisiones · conflictos · aceptación ·
//   hallazgos · zonas protegidas (targets + archivos reales + ADR) · capacidades
//   (case-insensitive) · requisitos/citas · deps · archivo · suite · evidencia
//   (substituted ≠ verde) · --pre-archive · --scope.
// Modos: [--root DIR] [--json] [--run-tests] [--tests-command "CMD"] [--pre-archive ID] [--diff BASE] [--scope ID]
// Exit: 1 si hay errores, 0 si no. Escribe openspec/evidence.json.
import { join, normalize, relative } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import * as lib from "./lib.mjs";

const args = process.argv.slice(2);
const getVal = (n) => {
  const eq = args.find((a) => a.startsWith(n + "="));
  if (eq) return eq.slice(n.length + 1);
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
};
const asJson = args.includes("--json");
const explicitCmd = getVal("--tests-command");
const wantTests = args.includes("--run-tests") || Boolean(explicitCmd);
const preArchiveId = getVal("--pre-archive");
const diffBase = getVal("--diff");
const scopeId = getVal("--scope");

const root = normalize(getVal("--root") || lib.resolveRoot(process.cwd()) || process.cwd());
if (!existsSync(join(root, "openspec", "changes"))) {
  console.error(`No existe openspec/changes/ bajo: ${root}`);
  console.error("Corré 'openspec init' primero, o pasá --root <dir> apuntando a la raíz del repo.");
  process.exit(1);
}

const cfgErrors = [];
const cfg = lib.readConfig(root, cfgErrors);
const testsCmd = explicitCmd || cfg.testCommand;
const parseErrors = [];
const changes = lib.listChanges(root, parseErrors);
const { archived, digestIds } = lib.listArchive(root);

const STATUSES = ["draft", "accepted", "applying", "verified", "blocked", "rejected", "superseded"];
const KINDS = ["fix", "feature", "architecture", "refactor"];
const ADVANCED = ["accepted", "applying", "verified"];
const TERMINAL = ["rejected", "superseded"];
const restId = (name) => name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const archiveResolves = (id) =>
  archived.some((a) => restId(a) === id || restId(a).endsWith("-" + id)) || digestIds.includes(id);

const errors = [];
const warnings = [];
const err = (msg, ids = []) => errors.push({ msg, ids });
const warn = (msg, ids = []) => warnings.push({ msg, ids });

// Un waiver "bloquea" si es requested, inválido, o granted sin owner/expires o vencido.
// Un granted VIGENTE habilita (es un permiso) y no bloquea.
const blameWaiver = (w) => {
  const st = String(w.state || "").toLowerCase();
  if (st !== "granted") return true;
  if (!w.owner || !w.expires) return true;
  const expRaw = String(w.expires);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw);
  return Number.isNaN(d.getTime()) || d < new Date();
};

for (const ce of cfgErrors) {
  warn(`config.yaml: línea ${ce.line} no interpretada — ${String(ce.text).slice(0, 60)}`);
}
{
  const tracked0 = lib.listTrackedFiles(root);
  if (tracked0 && tracked0.some((f) => lib.pathKey(f) === "openspec/evidence.json")) {
    err("openspec/evidence.json está commiteado — la evidencia es local ('git rm --cached openspec/evidence.json')");
  }
}

// 0) parse: líneas no interpretables / carpetas sin proposal
for (const pe of parseErrors) {
  const where = pe.file && pe.line ? `${relative(root, pe.file)} línea ${pe.line}` : pe.file;
  err(`${pe.id}: ${where} — ${pe.text.slice(0, 70)}`, [pe.id]);
}

// 1) enum de status/kind
for (const c of changes) {
  if (!STATUSES.includes(c.status)) err(`${c.id}: status inválido '${c.status}' (permitidos: ${STATUSES.join("|")})`, [c.id]);
  if (!KINDS.includes(c.kind)) err(`${c.id}: kind inválido '${c.kind}' (permitidos: ${KINDS.join("|")})`, [c.id]);
}

// 2) overlaps (case-insensitive; globs expandidos; severidad: error solo con trabajo activo)
//    Excepción explícita: si los changes están secuenciados por deps (directo o transitivo),
//    el solape es orden planificado → warning.
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
      for (const key of expanded) pairs.push({ c, raw: String(t), key });
    }
  }
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      const a = pairs[i];
      const b = pairs[j];
      if (a.c.id === b.c.id) continue;
      if (!lib.targetsOverlap(a.key, b.key)) continue;
      const k = [a.c.id, b.c.id].sort().join("|") + "::" + [a.key, b.key].sort().join(" ~ ");
      if (seen.has(k)) continue;
      seen.add(k);
      const msg = `overlap: '${a.raw}' (${a.c.id}, ${a.c.status}) y '${b.raw}' (${b.c.id}, ${b.c.status}) se solapan`;
      const active = a.c.status === "applying" || b.c.status === "applying";
      if (active && !sequenced(a.c.id, b.c.id)) err(msg, [a.c.id, b.c.id]);
      else if (active) warn(`${msg} — secuenciado por deps (orden declarado, no conflicto)`, [a.c.id, b.c.id]);
      else warn(msg, [a.c.id, b.c.id]);
    }
  }
}

// 3) [@test]: existencia de rutas declaradas
for (const c of changes) {
  for (const file of lib.walkMd(join(c.dir, "specs"))) {
    for (const ref of lib.testRefsIn(file)) {
      if (ref.includes("*")) {
        warn(`${c.id}: glob no soportado por el gate → ${ref}`, [c.id]);
        continue;
      }
      if (!existsSync(normalize(join(root, ref)))) {
        const msg = `${c.id}: [@test] no existe → ${ref} (en ${relative(root, file)})`;
        if (["applying", "verified"].includes(c.status)) err(msg, [c.id]);
        else warn(msg, [c.id]);
      }
    }
  }
}

// 4) targets existentes (aplicando/verificado): renombres sospechosos
for (const c of changes) {
  if (!["applying", "verified"].includes(c.status)) continue;
  for (const t of c.targets) {
    if (!existsSync(normalize(join(root, t)))) warn(`${c.id}: target no existe en disco (¿renombrado?) → ${t}`, [c.id]);
  }
}

// 5) kind: fix/refactor requieren test de regresión (solo refs literales, no globs)
for (const c of changes) {
  if (c.kind !== "fix" && c.kind !== "refactor") continue;
  const refs = lib.walkMd(join(c.dir, "specs"))
    .flatMap((f) => lib.testRefsIn(f))
    .filter((r) => !r.includes("*"));
  if (!refs.length) {
    const msg = `${c.id}: kind ${c.kind} sin ningún [@test] válido (regresión obligatoria; los globs no cuentan)`;
    if (ADVANCED.includes(c.status)) err(msg, [c.id]);
    else warn(msg, [c.id]);
  }
}

// 6) waivers (tipos válidos; granted vigente HABILITA; requested/vencido bloquean)
const WAIVER_TYPES = ["known-gap", "deferred-test", "pending-external-evidence", "frontier-stub"];
const today = new Date();
for (const c of changes) {
  for (const w of c.waivers) {
    const state = String(w.state || "").toLowerCase();
    const type = String(w.type || "?");
    if (!WAIVER_TYPES.includes(type)) {
      err(`${c.id}: waiver con tipo inválido '${type}' (permitidos: ${WAIVER_TYPES.join("|")})`, [c.id]);
    }
    if (!["requested", "granted"].includes(state)) {
      err(`${c.id}: waiver sin state válido (requested|granted) — tipo ${type}`, [c.id]);
      continue;
    }
    if (state === "requested") {
      if (!w.reason) err(`${c.id}: waiver ${type} requested sin razón`, [c.id]);
      warn(`${c.id}: waiver PENDIENTE (${type}, requested) — bloquea verified hasta tu decisión`, [c.id]);
    } else {
      if (!w.owner) err(`${c.id}: waiver ${type} granted sin owner`, [c.id]);
      if (!w.expires) err(`${c.id}: waiver ${type} granted sin expires`, [c.id]);
      let stillValid = false;
      if (w.expires) {
        const expRaw = String(w.expires);
        const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw);
        if (Number.isNaN(d.getTime())) err(`${c.id}: waiver ${type} con expires inválido (${w.expires})`, [c.id]);
        else if (d < today) err(`${c.id}: waiver ${type} VENCIDO (${w.expires})`, [c.id]);
        else {
          stillValid = Boolean(w.owner);
          if (d - today < 14 * 86400000) warn(`${c.id}: waiver ${type} vence pronto (${w.expires})`, [c.id]);
          else if (d - today > 180 * 86400000) {
            warn(`${c.id}: waiver ${type} con vigencia larga (>180 días) — ¿revisaste su motivo?`, [c.id]);
          }
        }
      }
      if (stillValid) warn(`${c.id}: waiver VIGENTE (${type}, hasta ${w.expires})`, [c.id]);
    }
  }
  if (c.status === "verified") {
    const blocking = c.waivers.filter(blameWaiver);
    if (blocking.length) err(`${c.id}: 'verified' con waiver(s) que bloquean (requested/vencidos)`, [c.id]);
  }
}

// 7) decisiones abiertas
for (const c of changes) {
  for (const d of c.open_decisions) {
    if (!d.question || !d.target) err(`${c.id}: decision request sin question/target`, [c.id]);
    else warn(`${c.id}: DECISIÓN PENDIENTE — "${d.question}" (→ ${d.target})`, [c.id]);
  }
  if (c.status === "verified" && c.open_decisions.length) {
    err(`${c.id}: 'verified' con decisión(es) pendiente(s)`, [c.id]);
  }
}

// 7b) conflictos a aprobar: contradicen algo ya decidido/escrito → bloquea el cierre, no la implementación
for (const c of changes) {
  for (const cf of c.conflicts) {
    if (!cf.with || !cf.what) err(`${c.id}: conflicto sin 'with'/'what'`, [c.id]);
    else warn(`${c.id}: ⚔ CONFLICTO a aprobar — "${cf.what}" (contra ${cf.with})${cf.proposal ? ` · propuesta: ${cf.proposal}` : ""}`, [c.id]);
  }
  if (c.status === "verified" && c.conflicts.length) {
    err(`${c.id}: 'verified' con conflicto(s) sin aprobar`, [c.id]);
  }
}

// 8) rastro de aceptación, reason y superseded
for (const c of changes) {
  if (ADVANCED.includes(c.status) && (!c.accepted_by || !c.accepted_at)) {
    warn(`${c.id}: sin rastro de aceptación (accepted_by / accepted_at)`, [c.id]);
  }
  if (c.status === "rejected" && !c.reason) {
    err(`${c.id}: 'rejected' sin reason (¿por qué se rechazó?)`, [c.id]);
  }
  if (c.status === "superseded") {
    if (!c.superseded_by) err(`${c.id}: 'superseded' sin superseded_by`, [c.id]);
    else if (!changes.some((x) => x.id === c.superseded_by) && !archiveResolves(c.superseded_by)) {
      warn(`${c.id}: superseded_by '${c.superseded_by}' no existe (ni activo ni archivado)`, [c.id]);
    }
  }
}

// 9) hallazgos abiertos del pase semántico
for (const c of changes) {
  if (!["applying", "verified"].includes(c.status)) continue;
  const fp = join(c.dir, "findings.md");
  if (existsSync(fp) && /^- \[ \]/m.test(lib.readText(fp))) {
    warn(`${c.id}: hallazgos abiertos en findings.md`, [c.id]);
  }
}

// 10) zonas protegidas: matches por targets, globs muertos, y --diff (CI)
for (const c of changes) {
  const hits = new Map();
  for (const t of c.targets) {
    const z = lib.matchZones(t, cfg.protectedZones);
    if (z) hits.set(z.glob, t);
  }
  if (hits.size && !c.human_approved && !TERMINAL.includes(c.status)) {
    const list = [...hits.entries()].map(([glob, t]) => `${t} (zona ${glob})`).join(" · ");
    const msg = `${c.id}: toca zona protegida sin aprobación humana → ${list}`;
    if (c.status === "applying") err(msg, [c.id]);
    else if (c.status === "verified") warn(`${msg} — verified: regularizá con tu aprobación`, [c.id]);
    else warn(`${msg} — requerirá aprobación`, [c.id]);
  }
}
{
  const tracked = lib.listTrackedFiles(root);
  if (!tracked && cfg.protectedZones.length) {
    warn("zonas protegidas: no verificable sin git (globs muertos sin chequear)");
  } else if (tracked && cfg.protectedZones.length) {
    for (const z of cfg.protectedZones) {
      const re = lib.globToRegExp(z.glob);
      const any = tracked.some((f) => re.test(lib.pathKey(f)) || re.test(lib.pathKey(f) + "/"));
      if (!any) warn(`zona protegida sin archivos que matcheen: ${z.glob} (¿renombre? — protección muerta)`);
    }
  }
}

// ADR obligatorio para aprobaciones humanas: una línea con verbo de aprobación que mencione el id
// como palabra completa (no substring; una línea de rechazo no aprueba).
const adrApproves = (dec, id) => {
  const esc = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const reId = new RegExp(`(?:^|[^A-Za-z0-9_-])${esc}(?![A-Za-z0-9_-])`);
  return dec
    .split(/\r?\n/)
    .filter((l) => reId.test(l))
    .some((l) => /aprob|approv/i.test(l) && !/rechaz|reject/i.test(l));
};
for (const c of changes) {
  if (!c.human_approved) continue;
  const decPath = join(root, "DECISIONS.md");
  const dec = existsSync(decPath) ? lib.readText(decPath) : "";
  if (!adrApproves(dec, c.id)) {
    err(
      `${c.id}: human_approved sin ADR válido en DECISIONS.md (línea con 'aprobado'/'approved' que mencione '${c.id}' como palabra)`,
      [c.id]
    );
  }
}

// Zonas sobre archivos REALES cambiados (working tree + staged), aunque los targets no matcheen el glob
if (!diffBase) {
  try {
    let changed = [];
    for (const gitArgs of [
      ["diff", "--name-only", "HEAD"],
      ["diff", "--name-only", "--cached"],
      ["ls-files", "--others", "--exclude-standard"],
    ]) {
      try {
        changed.push(
          ...execFileSync("git", gitArgs, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .split(/\r?\n/)
            .filter(Boolean)
        );
      } catch {
        /* sin git o sin HEAD */
      }
    }
    changed = [...new Set(changed)];
    for (const f of changed) {
      const z = lib.matchZones(f, cfg.protectedZones);
      if (!z) continue;
      const owners = changes.filter((c) => !TERMINAL.includes(c.status) && c.targets.some((t) => lib.pathCoveredBy(f, t)));
      if (!owners.length) err(`archivo protegido modificado sin change que lo reclame → ${f} (zona ${z.glob})`);
      else
        for (const o of owners) {
          if (!o.human_approved) err(`${o.id}: modifica archivo protegido sin aprobación → ${f} (zona ${z.glob})`, [o.id]);
        }
    }
  } catch {
    /* sin git */
  }
}
if (diffBase) {
  let changed = [];
  let ok = false;
  let usedFallback = false;
  for (const range of [`${diffBase}...HEAD`, diffBase]) {
    try {
      changed = execFileSync("git", ["diff", "--name-only", range], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .split(/\r?\n/)
        .filter(Boolean);
      ok = true;
      usedFallback = range === diffBase;
      break;
    } catch {
      /* probar el siguiente rango */
    }
  }
  if (!ok) {
    warn(`--diff ${diffBase}: no se pudo obtener el diff (¿git? ¿ref?)`);
  } else {
    if (usedFallback) warn(`--diff: no se pudo usar ${diffBase}...HEAD; se usó 'git diff ${diffBase}' (incluye working tree)`);
    for (const f of changed) {
      const z = lib.matchZones(f, cfg.protectedZones);
      if (!z) continue;
      const owners = changes.filter((c) => !TERMINAL.includes(c.status) && c.targets.some((t) => lib.pathCoveredBy(f, t)));
      if (!owners.length) {
        err(`--diff: archivo protegido modificado sin change que lo reclame → ${f} (zona ${z.glob})`);
        continue;
      }
      for (const o of owners) {
        if (!o.human_approved) err(`--diff: ${o.id} toca archivo protegido sin aprobación → ${f} (zona ${z.glob})`, [o.id]);
      }
    }
  }
}

// 11) capacidades: vivas + deltas
{
  const caps = new Map();
  const pushCap = (id, source, path, status) => {
    const key = String(id).trim().toLowerCase();
    if (!caps.has(key)) caps.set(key, []);
    caps.get(key).push({ source, path, status });
  };
  for (const cap of lib.listCapabilities(root)) for (const id of cap.provides) pushCap(id, "living", cap.path, "living");
  for (const c of changes) {
    for (const f of lib.walkMd(join(c.dir, "specs"))) {
      const fm = lib.readFrontmatter(f);
      for (const id of lib.arr(fm.provides)) pushCap(id, c.id, relative(root, f), c.status);
    }
  }
  for (const [id, entries] of caps) {
    const living = entries.filter((e) => e.source === "living");
    const deltas = entries.filter((e) => e.source !== "living");
    if (living.length > 1) err(`capacidad duplicada ${id} (specs vivas): ${living.map((e) => e.path).join(" · ")}`);
    for (const d of deltas) {
      if (!living.length) continue;
      const msg = `capacidad duplicada ${id}: delta de '${d.source}' vs spec viva (${d.path})`;
      if (ADVANCED.includes(d.status)) err(msg, [d.source]);
      else warn(msg, [d.source]);
    }
    for (let a = 0; a < deltas.length; a++) {
      for (let b = a + 1; b < deltas.length; b++) {
        if (deltas[a].source === deltas[b].source) continue;
        const msg = `capacidad duplicada ${id}: '${deltas[a].source}' y '${deltas[b].source}' la proveen`;
        const both = ADVANCED.includes(deltas[a].status) && ADVANCED.includes(deltas[b].status);
        if (both) err(msg, [deltas[a].source, deltas[b].source]);
        else warn(msg, [deltas[a].source, deltas[b].source]);
      }
    }
  }
}

// 12) requisitos y citas (opcional: se activa si el repo usa IDs [REQ-...])
const rel = (f) => relative(root, f);
const livingIds = new Map();
for (const f of lib.walkMd(join(root, "openspec", "specs"))) {
  const seen = new Set();
  for (const id of lib.requirementIdsIn(lib.readText(f))) {
    if (seen.has(id)) err(`${rel(f)}: ID de requisito duplicado en el archivo → ${id}`);
    seen.add(id);
    if (livingIds.has(id)) err(`ID de requisito duplicado entre specs vivas → ${id} (${rel(livingIds.get(id))} y ${rel(f)})`);
    else livingIds.set(id, f);
  }
}
const changeIds = new Map();
const idOwner = new Map();
for (const c of changes) {
  const map = new Map();
  changeIds.set(c.id, map);
  for (const f of lib.walkMd(join(c.dir, "specs"))) {
    const seen = new Set();
    for (const id of lib.requirementIdsIn(lib.readText(f))) {
      if (seen.has(id)) err(`${c.id}: ID de requisito duplicado en el archivo → ${id} (${rel(f)})`, [c.id]);
      seen.add(id);
      map.set(id, f);
    }
  }
  for (const id of map.keys()) {
    if (idOwner.has(id) && idOwner.get(id) !== c.id) {
      warn(`ID ${id} tocado por dos cambios activos (${idOwner.get(id)}, ${c.id})`, [c.id]);
    } else {
      idOwner.set(id, c.id);
    }
  }
}
const allIds = new Set([
  ...livingIds.keys(),
  ...changes.filter((c) => ADVANCED.includes(c.status)).flatMap((c) => [...(changeIds.get(c.id) || new Map()).keys()]),
]);
for (const c of changes) {
  // Citas: archivos del change; si un target es directorio, se expande a sus archivos de código.
  const files = [];
  for (const t of [...c.targets, ...c.tests]) {
    const p = normalize(join(root, t));
    if (!existsSync(p)) continue;
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isFile()) files.push(p);
    else if (st.isDirectory()) files.push(...lib.walkFiles(p));
  }
  const cites = [];
  for (const f of files) cites.push(...lib.citationsIn(lib.readText(f)));
  for (const id of cites) {
    if (!allIds.has(id)) {
      const msg = `${c.id}: cita rota @cita ${id} — no existe ese requisito (posible alucinación)`;
      if (["applying", "verified"].includes(c.status)) err(msg, [c.id]);
      else warn(msg, [c.id]);
    }
  }
  if (cites.length) {
    const cited = new Set(cites);
    for (const id of (changeIds.get(c.id) || new Map()).keys()) {
      if (!cited.has(id)) warn(`${c.id}: requisito sin cita en sus archivos → ${id}`, [c.id]);
    }
  }
}

// 13) deps: change activo verificado, carpeta archivada o digest compactado
{
  const activeById = new Map(changes.map((c) => [c.id, c]));
  for (const c of changes) {
    for (const dep of c.deps) {
      const depStr = String(dep);
      const act = activeById.get(depStr);
      if (act) {
        if (act.status !== "verified") warn(`${c.id}: dep '${depStr}' activa pero en estado '${act.status}' (no verificada)`, [c.id]);
      } else if (!archiveResolves(depStr)) {
        err(`${c.id}: dep '${depStr}' no existe (ni activa, ni archivada, ni compactada)`, [c.id]);
      }
    }
  }
}

// 14) archivo: waivers/decisiones sin cerrar en changes archivados
{
  const archiveDir = join(root, "openspec", "changes", "archive");
  if (existsSync(archiveDir)) {
    for (const name of readdirSync(archiveDir)) {
      const p = join(archiveDir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;
      const metaPath = join(p, ".openspec.yaml");
      if (!existsSync(metaPath)) continue;
      const m = lib.parseYaml(lib.readText(metaPath));
      const ws = lib.arr(m.waivers);
      const ds = lib.arr(m.open_decisions);
      const cs = lib.arr(m.conflicts);
      if (ws.length) {
        const expired = ws.filter((w) => {
          if (String(w.state || "").toLowerCase() !== "granted") return false;
          const expRaw = String(w.expires || "");
          const exp = expRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(expRaw) ? expRaw + "T23:59:59" : expRaw) : null;
          return !exp || Number.isNaN(exp.getTime()) || exp < new Date();
        });
        warn(`archivo ${name}: ${ws.length} waiver(s) registrados sin cerrar${expired.length ? ` (${expired.length} VENCIDO/s)` : ""}`);
      }
      if (ds.length) warn(`archivo ${name}: ${ds.length} decisión(es) pendiente(s) al archivar`);
      if (cs.length) warn(`archivo ${name}: ${cs.length} conflicto(s) sin aprobar al archivar`);
    }
  }
}

// 15) suite de tests (opcional; --tests-command NO produce verde — ver evidencia)
let testsRecord = null;
const substituted = Boolean(explicitCmd);
if (wantTests) {
  if (explicitCmd && process.env.CI) {
    err("--tests-command prohibido en CI — usá test_command (config) con --run-tests");
  } else if (!testsCmd) {
    warn("--run-tests sin test_command configurado (openspec/config.yaml: test_command)");
  } else if (/[;|&`$<>]/.test(testsCmd) && process.env.SPEC_GROWTH_ALLOW_SHELL_CMD !== "1") {
    err(`test_command con metacaracteres requiere SPEC_GROWTH_ALLOW_SHELL_CMD=1 — ${testsCmd}`);
  } else {
    let exit = 0;
    let tail = "";
    try {
      const out = execSync(testsCmd, {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        timeout: 15 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
      tail = out.toString();
    } catch (e) {
      if (e && (e.code === "ENOBUFS" || e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")) {
        exit = 1;
        tail = "salida excedió maxBuffer (64MB)";
      } else {
        exit = e && typeof e.status === "number" ? e.status : 1;
        tail = (e && e.stdout ? e.stdout.toString() : "") + (e && e.stderr ? e.stderr.toString() : "");
      }
    }
    testsRecord = { command: testsCmd, exit, substituted };
    if (exit !== 0) {
      err(`suite de tests ROJA — ${testsCmd}`); // global: no degradable por --scope
      const lines = tail.split(/\r?\n/).filter(Boolean);
      const last = lines.slice(-15).join("\n");
      if (last) warnings.push({ msg: `últimas líneas de la suite:\n${last}`, ids: [] });
    }
  }
}

// 15b) --scope <id>: validación temprana (el filtro real corre al FINAL, solo sobre el reporte)
if (scopeId && !changes.some((c) => c.id === scopeId)) {
  err(`--scope: no existe el change '${scopeId}'`);
}

// (re-lectura cerca del uso y la escritura: minimiza lost-update con hook/otro agente)
const prevEvidence = lib.readEvidence(root);

// 16) evidencia: merge por-change (sin acoplamiento global); substituted != verde
const now = new Date().toISOString();
const currentOk = (c) => !errors.some((e) => e.ids.includes(c.id)) && (!testsRecord || testsRecord.exit === 0);
const staleMemo = new Map();
function targetStaleness(c) {
  if (staleMemo.has(c.id)) return staleMemo.get(c.id);
  const list = [...c.targets, ...c.tests];
  let maxTs = 0;
  let nul = 0;
  for (const t of list) {
    const ts = lib.gitLastCommitTs(root, t);
    if (ts) maxTs = Math.max(maxTs, ts);
    else nul++;
  }
  const res = { maxTs, allNull: list.length > 0 && nul === list.length };
  staleMemo.set(c.id, res);
  return res;
}
// Verde: solo de una corrida real (--run-tests sin sustitución), verde y sin errores del change.
// Si el green previo sigue vigente para el estado actual, se conserva (no refresca).
function mergedGreen(c) {
  const prevGreen =
    (prevEvidence && prevEvidence.changes && prevEvidence.changes[c.id] && prevEvidence.changes[c.id].green_tests) || null;
  const freshOk = testsRecord && !testsRecord.substituted && testsRecord.exit === 0 && currentOk(c);
  if (freshOk) {
    const st = targetStaleness(c);
    if (prevGreen && !(st.maxTs && st.maxTs > Date.parse(prevGreen.at))) return prevGreen;
    return { at: now, ok: true, mode: "tests" };
  }
  return prevGreen;
}
for (const c of changes) {
  if (c.status !== "verified") continue;
  if (!c.targets.length) warn(`${c.id}: verified sin targets declarados (frescura no evaluable)`, [c.id]);
  const green = mergedGreen(c);
  if (!green) {
    const msg = `${c.id}: 'verified' sin evidencia verde local — corré 'gate-check --run-tests'`;
    if (testsRecord) err(msg, [c.id]);
    else warn(`${msg} (en estático es aviso; en pre-archive es error)`, [c.id]);
    continue;
  }
  const st = targetStaleness(c);
  if (st.allNull) warn(`${c.id}: frescura de evidencia no verificable (git ausente/shallow)`, [c.id]);
  else if (st.maxTs && st.maxTs > Date.parse(green.at)) {
    warn(`${c.id}: evidencia VIEJA (el código cambió después de la última corrida verde)`, [c.id]);
  }
}

// 17) pre-archive <id>: precondiciones de archivado
let preArchiveResult = null;
if (preArchiveId) {
  const c = changes.find((x) => x.id === preArchiveId);
  if (!c) {
    err(`pre-archive: no existe el change '${preArchiveId}'`);
  } else {
    if (c.status !== "verified") err(`pre-archive ${c.id}: status '${c.status}' — se requiere verified`, [c.id]);
    const blockingW = c.waivers.filter(blameWaiver);
    if (blockingW.length) err(`pre-archive ${c.id}: ${blockingW.length} waiver(s) que bloquean (requested/vencidos)`, [c.id]);
    if (c.open_decisions.length) err(`pre-archive ${c.id}: ${c.open_decisions.length} decisión(es) pendiente(s)`, [c.id]);
    if (c.conflicts.length) err(`pre-archive ${c.id}: ${c.conflicts.length} conflicto(s) sin aprobar`, [c.id]);
    const findingsPath = join(c.dir, "findings.md");
    if (existsSync(findingsPath) && /^- \[ \]/m.test(lib.readText(findingsPath))) {
      warn(`pre-archive ${c.id}: hallazgos abiertos en findings.md (¿los resolviste?)`, [c.id]);
    }
    const green = mergedGreen(c);
    if (c.status === "verified") {
      if (!green) {
        err(`pre-archive ${c.id}: sin evidencia verde — corré 'gate-check --run-tests' antes de archivar`, [c.id]);
      } else {
        const st = targetStaleness(c);
        if (st.maxTs && st.maxTs > Date.parse(green.at)) {
          err(`pre-archive ${c.id}: evidencia verde VIEJA — re-corré 'gate-check --run-tests' antes de archivar`, [c.id]);
        }
      }
    }
    const refCandidate = c.merged_as || c.gitref;
    if (!refCandidate) {
      warn(`pre-archive ${c.id}: sin gitref ni merged_as — merge no verificable`, [c.id]);
    } else {
      const anc = lib.gitIsAncestor(root, refCandidate);
      if (anc === true) {
        const trackedNow = lib.listTrackedFiles(root) || [];
        const concrete = [];
        for (const t of c.targets) {
          const ts = String(t);
          if (!/[*?]/.test(ts)) concrete.push(ts);
          else {
            const reT = lib.globToRegExp(ts);
            concrete.push(...trackedNow.filter((f) => reT.test(lib.pathKey(f))));
          }
        }
        const uniq = [...new Set(concrete)];
        if (!uniq.length) {
          err(`pre-archive ${c.id}: sin archivos concretos para verificar el merge (targets vacíos o globs sin match)`, [c.id]);
        } else {
          try {
            const diffOut = execFileSync("git", ["diff", "--name-only", `${refCandidate}..HEAD`, "--", ...uniq], {
              cwd: root,
              stdio: ["ignore", "pipe", "ignore"],
            })
              .toString()
              .trim();
            if (diffOut) {
              err(`pre-archive ${c.id}: '${refCandidate}' no contiene el estado actual de los targets (¿archivado previo al merge real?)`, [c.id]);
            }
          } catch {
            warn(`pre-archive ${c.id}: no se pudo comparar contenido contra '${refCandidate}'`, [c.id]);
          }
        }
      } else if (anc === false) {
        if (c.merged_as) err(`pre-archive ${c.id}: merged_as ${c.merged_as} no es ancestro de HEAD`, [c.id]);
        else {
          err(
            `pre-archive ${c.id}: gitref ${c.gitref} no es ancestro de HEAD (¿sin mergear? — con squash-merge: 'merged_as: <sha del commit squash>')`,
            [c.id]
          );
        }
      } else {
        const head = lib.gitHead(root);
        if (head) err(`pre-archive ${c.id}: ${c.merged_as ? "merged_as" : "gitref"} '${refCandidate}' inválido o ambiguo (git presente, la ref no resuelve)`, [c.id]);
        else warn(`pre-archive ${c.id}: no se pudo verificar el merge (¿git?)`, [c.id]);
      }
    }
    preArchiveResult = { id: c.id, ok: !errors.some((e) => e.ids.includes(c.id)) };
  }
}

// evidencia (merge: conserva la última corrida verde por change)
const changesEv = {};
for (const c of changes) {
  const prevRec = (prevEvidence && prevEvidence.changes && prevEvidence.changes[c.id]) || {};
  changesEv[c.id] = {
    last: { at: now, ok: currentOk(c), mode: testsRecord ? "tests" : "static", status: c.status },
    green_tests: mergedGreen(c) || prevRec.green_tests || null,
  };
}
const evidence = {
  generated_at: now,
  gate_ok: errors.length === 0,
  scope: scopeId || null,
  mode: testsRecord ? (testsRecord.substituted ? "tests-substituted" : "tests") : "static",
  tests: testsRecord,
  changes: changesEv,
};
lib.writeEvidence(root, evidence);

// scope: SOLO afecta el reporte y el exit; la evidencia y gate_ok se calcularon SIN filtrar
if (scopeId) {
  const inScope = (e) => e.ids.length === 0 || e.ids.includes(scopeId);
  for (const e of errors.filter((x) => !inScope(x))) {
    warnings.push({ msg: `(fuera de scope: ${e.ids.join(", ")}) ${e.msg}`, ids: e.ids });
  }
  errors.splice(0, errors.length, ...errors.filter(inScope));
}

// reporte
const errorMsgs = errors.map((e) => e.msg);
const warnMsgs = warnings.map((w) => w.msg);
if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        mode: evidence.mode,
        tests: testsRecord,
        pre_archive: preArchiveResult,
        errors: errorMsgs,
        warnings: warnMsgs,
      },
      null,
      2
    )
  );
} else {
  console.log(`Spec Growth · gate-check (${evidence.mode})${scopeId ? ` · scope: ${scopeId}` : ""} — ${changes.length} change(s) activo(s)`);
  console.log(`Errores: ${errors.length} · Warnings: ${warnings.length}\n`);
  if (errorMsgs.length) console.log(errorMsgs.map((e) => `  ✖ ${e}`).join("\n") + "\n");
  if (warnMsgs.length) console.log(warnMsgs.map((w) => `  ⚠ ${w}`).join("\n") + "\n");
  if (preArchiveResult) {
    console.log(
      preArchiveResult.ok
        ? `PRE-ARCHIVE ${preArchiveResult.id}: OK — podés archivar (openspec archive ${preArchiveResult.id})`
        : `PRE-ARCHIVE ${preArchiveResult.id}: BLOQUEADO — resolvé los errores de arriba`
    );
  }
  console.log(errors.length ? "GATE ROJO — corregir antes de commitear/mergear." : "GATE VERDE.");
}
process.exit(errors.length ? 1 : 0);
