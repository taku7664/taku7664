import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { BG_CSS, typeBackground } from "./backgrounds.mjs";

const CARD = ".pokerepo/card.md";
const STATE = "trainer.json";
const CARDS_DIR = "cards";
const README = "README.md";

const TYPE_COLORS = {
  normal: "#A8A77A", fire: "#EE8130", water: "#6390F0", electric: "#F7D02C",
  grass: "#7AC74C", ice: "#96D9D6", fighting: "#C22E28", poison: "#A33EA1",
  ground: "#E2BF65", flying: "#A98FF3", psychic: "#F95587", bug: "#A6B91A",
  rock: "#B6A136", ghost: "#735797", dragon: "#6F35FC", dark: "#705746",
  steel: "#B7B7CE", fairy: "#D685AD",
};
const TYPE_KO = {
  normal: "노말", fire: "불꽃", water: "물", electric: "전기", grass: "풀", ice: "얼음",
  fighting: "격투", poison: "독", ground: "땅", flying: "비행", psychic: "에스퍼", bug: "벌레",
  rock: "바위", ghost: "고스트", dragon: "드래곤", dark: "악", steel: "강철", fairy: "페어리",
};

const bust = (svg) => createHash("sha1").update(svg).digest("hex").slice(0, 8);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function parseParty(md) {
  const rows = [...md.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const repos = [];
  for (let i = 0; i + 1 < rows.length; i += 2) {
    for (const td of rows[i + 1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) {
      repos.push(td[1].match(/title="([^"]+)"/)[1]);
    }
  }
  return repos;
}

const speciesCache = new Map();
function pokemon(id) {
  if (!speciesCache.has(id)) speciesCache.set(id, (async () => {
    const poke = await json(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const species = await json(poke.species.url);
    const name = species.names.find((n) => n.language.name === "ko")?.name
      ?? species.names.find((n) => n.language.name === "en")?.name ?? poke.name;
    const art = poke.sprites.other?.home?.front_default ?? poke.sprites.other?.["official-artwork"]?.front_default;
    const png = await sharp(Buffer.from(await (await fetch(art)).arrayBuffer()))
      .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return { name, dex: species.id, types: poke.types.map((t) => t.type.name), sprite: `data:image/png;base64,${png.toString("base64")}` };
  })());
  return speciesCache.get(id);
}

const W = 272, H = 136, M = 6;

function badge(mon) {
  const b = mon.isNew ? ["NEW!", "#f2cc60"] : mon.lvUp ? ["LV UP ▲", "#3fb950"] : null;
  if (!b) return "";
  const w = b[0].length * 7 + 14;
  return `<g transform="translate(172,43)"><rect width="${w}" height="17" rx="8.5" fill="${b[1]}"/><text x="${w / 2}" y="12.5" class="badge">${b[0]}</text></g>`;
}

function cardSvg(mon, delay) {
  const c1 = TYPE_COLORS[mon.types[0]] ?? "#888";
  const c2 = TYPE_COLORS[mon.types[1]] ?? c1;
  const repo = mon.repo.split("/").pop();
  const repoShort = repo.length > 22 ? repo.slice(0, 21) + "…" : repo;
  const bar = Math.max(4, Math.round((mon.level / 100) * 132));
  const chips = mon.types.map((t, k) => `
    <g transform="translate(${118 + k * 58},76)">
      <rect width="52" height="18" rx="9" fill="${TYPE_COLORS[t]}"/>
      <text x="26" y="13" class="chip">${TYPE_KO[t] ?? t}</text>
    </g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + M * 2}" height="${H + M * 2}" viewBox="0 0 ${W + M * 2} ${H + M * 2}">
  <style>
    text { font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Helvetica, Arial, sans-serif; }
    .name { font-size: 20px; font-weight: 700; fill: #f0f6fc; }
    .lv { font-size: 13px; font-weight: 600; fill: #8b949e; }
    .lvnum { font-size: 17px; font-weight: 800; fill: #f0f6fc; }
    .chip { font-size: 11px; font-weight: 700; fill: #fff; text-anchor: middle; }
    .repo { font-size: 11px; fill: #58a6ff; text-decoration: underline; }
    .no { font-size: 11px; font-weight: 700; fill: #8b949e; text-anchor: end; }
    .pin { font-size: 10px; font-weight: 700; fill: #c9d1d9; }
    .badge { font-size: 10.5px; font-weight: 800; fill: #0d1117; text-anchor: middle; }
    .float { animation: float 3s ease-in-out infinite; animation-delay: ${delay}s; }
    @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
    @media (prefers-reduced-motion: reduce) { .float { animation: none } }${BG_CSS}
  </style>
  <defs>
    <clipPath id="clip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${c2}" stop-opacity=".10"/>
    </linearGradient>
    <radialGradient id="r"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
  </defs>
  <g transform="translate(${M},${M})">
    <rect width="${W}" height="${H}" rx="18" fill="#161b22"/>
    <rect width="${W}" height="${H}" rx="18" fill="url(#g)"/>
    <g clip-path="url(#clip)">${typeBackground(mon.types[0], c1, mon.repo)}</g>
    <rect width="${W}" height="${H}" rx="18" fill="none" stroke="${c1}" stroke-opacity=".45"/>
    <circle cx="60" cy="68" r="56" fill="url(#r)"/>
    <g class="float"><image href="${mon.sprite}" x="4" y="12" width="112" height="112"/></g>
    <text x="118" y="34" class="name">${esc(mon.name)}</text>
    <text x="118" y="56" class="lv">Lv.<tspan class="lvnum">${mon.level}</tspan></text>
    ${chips}
    <rect x="118" y="104" width="132" height="6" rx="3" fill="#ffffff" fill-opacity=".12"/>
    <rect x="118" y="104" width="${bar}" height="6" rx="3" fill="${c1}"/>
    <text x="118" y="126" class="repo">${esc(repoShort)}</text>
    <text x="${W - 12}" y="22" class="no">No.${String(mon.dex).padStart(3, "0")}</text>
    ${mon.pinned ? `<g transform="translate(10,10)">
      <rect width="58" height="18" rx="9" fill="#0d1117" fill-opacity=".75" stroke="#30363d"/>
      <path d="M9,4.5 h6 l-1.2,3.6 l2.4,2.4 h-8.4 l2.4,-2.4 z M12,10.5 v4" fill="#c9d1d9" stroke="#c9d1d9" stroke-width="1" stroke-linejoin="round"/>
      <text x="21" y="12.8" class="pin">Pinned</text>
    </g>` : ""}
    ${badge(mon)}
  </g>
</svg>
`;
}

const state = JSON.parse(await readFile(STATE, "utf8"));
const login = state.login;
const RAW = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY ?? `${login}/${login}`}/HEAD`;
let prev = {};
try { prev = JSON.parse(execSync(`git show HEAD:${STATE}`, { stdio: ["ignore", "pipe", "ignore"] })).repos ?? {}; } catch {}

async function profile() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { name: login, pinned: new Set() };
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: `{ user(login: "${login}") { name pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { nameWithOwner parent { nameWithOwner } } } } } }` }),
    });
    const user = (await res.json()).data?.user;
    const nodes = user?.pinnedItems?.nodes ?? [];
    return {
      name: user?.name || login,
      pinned: new Set(nodes.flatMap((n) => [n.nameWithOwner, n.parent?.nameWithOwner].filter(Boolean))),
    };
  } catch {
    return { name: login, pinned: new Set() };
  }
}
const { name: trainerName, pinned } = await profile();

const INTRO = ".pokerepo/intro.txt";
const introRaw = (await readFile(INTRO, "utf8").catch(() => ""))
  .split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const nameLine = introRaw.find((l) => /^name\s*:/i.test(l));
const displayName = nameLine ? nameLine.replace(/^name\s*:/i, "").trim() : trainerName;
const introLines = introRaw.filter((l) => l !== nameLine);

const hasPrev = Object.keys(prev).length > 0;
const entry = (repo) => {
  const cur = state.repos[repo], old = prev[repo];
  return {
    repo, ...cur,
    pinned: pinned.has(repo),
    isNew: hasPrev && !old?.caught,
    lvUp: !!old && cur.level > old.level,
  };
};

const partyRepos = parseParty(await readFile(CARD, "utf8"));
const party = partyRepos.map(entry);
const rest = Object.keys(state.repos)
  .filter((r) => state.repos[r].caught && !partyRepos.includes(r))
  .map(entry)
  .sort((a, b) => b.level - a.level || b.exp - a.exp);

await rm(CARDS_DIR, { recursive: true, force: true });
await mkdir(CARDS_DIR);

async function render(list) {
  return Promise.all(list.map(async (e, i) => {
    const mon = { ...e, ...(await pokemon(e.mon)) };
    const file = `${CARDS_DIR}/${e.repo.replace("/", "__")}.svg`;
    const svg = cardSvg(mon, ((i % 3) * 0.35).toFixed(2));
    await writeFile(file, svg);
    const tip = `${mon.name} · ${e.repo} · 커밋 ${e.commits}회 · 병합 PR ${e.merges}개`;
    return `<a href="https://github.com/${e.repo}" title="${esc(tip)}"><img src="${RAW}/${file}?v=${bust(svg)}" alt="${esc(mon.name)} Lv.${e.level}" width="32%"></a>`;
  }));
}

const partyHtml = await render(party);
const restHtml = await render(rest);

const MAX_FACES = 10;
async function moreSvg(list) {
  const BW = 3 * (W + M * 2) - M * 2, BH = 64;
  const faces = await Promise.all(list.slice(0, MAX_FACES).map((e) => pokemon(e.mon)));
  const extra = list.length - faces.length;
  const step = 36, right = BW - 42 - (extra > 0 ? 44 : 0);
  const x0 = right - (faces.length - 1) * step - 22;
  const avatars = faces.map((p, i) => {
    const cx = x0 + 22 + i * step;
    return `<circle cx="${cx}" cy="32" r="22" fill="#21262d" stroke="#30363d"/><image href="${p.sprite}" x="${cx - 20}" y="12" width="40" height="40"/>`;
  }).join("");
  const plus = extra > 0
    ? `<text x="${BW - 24}" y="38" class="plus" text-anchor="end">+${extra}</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BW + M * 2}" height="${BH + M * 2}" viewBox="0 0 ${BW + M * 2} ${BH + M * 2}">
  <style>
    text { font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Helvetica, Arial, sans-serif; }
    .label { font-size: 17px; font-weight: 700; fill: #f0f6fc; }
    .plus { font-size: 15px; font-weight: 700; fill: #8b949e; }
  </style>
  <g transform="translate(${M},${M})">
    <rect width="${BW}" height="${BH}" rx="18" fill="#161b22" stroke="#30363d"/>
    <g transform="translate(36,32)">
      <circle r="14" fill="#f0f6fc"/>
      <path d="M-14,0 A14,14 0 0 1 14,0 Z" fill="#e5484d"/>
      <rect x="-14" y="-1.5" width="28" height="3" fill="#0d1117"/>
      <circle r="5" fill="#f0f6fc" stroke="#0d1117" stroke-width="3"/>
    </g>
    <text x="62" y="39" class="label">나머지 포켓몬 ${list.length}마리 더 보기</text>
    ${avatars}
    ${plus}
  </g>
</svg>
`;
}
const more = rest.length ? await moreSvg(rest) : "";
if (more) await writeFile(`${CARDS_DIR}/_more.svg`, more);

const caught = Object.values(state.repos).filter((r) => r.caught);
const totalCommits = caught.reduce((n, r) => n + (r.commits ?? 0), 0);
const FW = 3 * (W + M * 2);
const FONT = `font-family="Segoe UI, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, Helvetica, Arial, sans-serif"`;
const pokeball = (x, y, r) => `<g transform="translate(${x},${y})"><circle r="${r}" fill="#f0f6fc"/><path d="M${-r},0 A${r},${r} 0 0 1 ${r},0 Z" fill="#e5484d"/><rect x="${-r}" y="-1.5" width="${r * 2}" height="3" fill="#0d1117"/><circle r="${r * 0.36}" fill="#f0f6fc" stroke="#0d1117" stroke-width="3"/></g>`;
const topSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="64" viewBox="0 0 ${FW} 64">
  <defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#1f2a44"/><stop offset="1" stop-color="#161b22"/></linearGradient></defs>
  <path d="M${M},64 V24 Q${M},${M} 24,${M} H${FW - 24} Q${FW - M},${M} ${FW - M},24 V64" fill="url(#t)" stroke="#30363d"/>
  <rect x="${M}" y="60" width="${FW - M * 2}" height="4" fill="#e5484d" opacity=".85"/>
  ${pokeball(34, 34, 13)}
  <text x="58" y="41" ${FONT} font-size="20" font-weight="900" fill="#f0f6fc" letter-spacing="3">PARTY</text>
  <text x="166" y="40" ${FONT} font-size="13" font-weight="600" fill="#8b949e">트레이너 ${esc(displayName)}</text>
  <text x="${FW - 26}" y="40" ${FONT} font-size="13" font-weight="700" fill="#c9d1d9" text-anchor="end">${party.length}/6  ·  도감 ${caught.length}  ·  총 커밋 ${totalCommits.toLocaleString("en-US")}</text>
</svg>
`;
const bottomSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="30" viewBox="0 0 ${FW} 30">
  <path d="M${M},0 V6 Q${M},24 24,24 H${FW - 24} Q${FW - M},24 ${FW - M},6 V0" fill="#161b22" stroke="#30363d"/>
  <rect x="${M}" y="0" width="${FW - M * 2}" height="3" fill="#e5484d" opacity=".85"/>
</svg>
`;
await writeFile(`${CARDS_DIR}/_top.svg`, topSvg);
await writeFile(`${CARDS_DIR}/_bottom.svg`, bottomSvg);
const frameImg = (name, svg) => `<picture><img src="${RAW}/${CARDS_DIR}/${name}.svg?v=${bust(svg)}" alt="" width="97%"></picture>`;


function introSvg(lines, speaker) {
  const TYPE = 0.045, LINE_PAUSE = 0.35, START = 0.5, LH = 32, FS = 17, X0 = 36;
  const boxY = 18, boxH = 34 + lines.length * LH;
  const h = boxY + boxH + M;
  // Rough glyph width so the reveal ends where the text ends: CJK is ~1em, the rest ~0.55em.
  const textWidth = (line) => [...line].reduce((w, ch) => w + (/[ᄀ-￿]/.test(ch) ? FS : FS * 0.55), 0);
  let t = START;
  const clips = [], text = [];
  lines.forEach((line, li) => {
    const n = [...line].length, dur = n * TYPE, y = boxY + 40 + li * LH;
    clips.push(`<clipPath id="l${li}"><rect x="${X0 - 2}" y="${y - FS - 4}" height="${FS + 10}" width="0">
      <animate attributeName="width" from="0" to="${Math.ceil(textWidth(line) + 8)}" begin="${t.toFixed(2)}s" dur="${dur.toFixed(2)}s" fill="freeze"/>
    </rect></clipPath>`);
    text.push(`<text x="${X0}" y="${y}" class="line" clip-path="url(#l${li})">${esc(line)}</text>`);
    t += dur + LINE_PAUSE;
  });
  const tabW = [...speaker].length * 11 + 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${h}" viewBox="0 0 ${FW} ${h}">
  <style>
    text { font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Helvetica, Arial, sans-serif; white-space: pre; }
    .line { font-size: 17px; font-weight: 600; fill: #f0f6fc; }
    .name { font-size: 14px; font-weight: 800; fill: #fff; letter-spacing: 1px; }
    .next { opacity: 0; animation: next 1s steps(1) ${t.toFixed(2)}s infinite; }
    @keyframes next { 0% { opacity: 1 } 50% { opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .next { opacity: 1; animation: none } }
  </style>
  <defs>${clips.join("")}<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2436"/><stop offset="1" stop-color="#121826"/></linearGradient></defs>
  <rect x="${M}" y="${boxY}" width="${FW - M * 2}" height="${boxH}" rx="14" fill="url(#bg)" stroke="#c9d1d9" stroke-width="2.5"/>
  <rect x="${M + 6}" y="${boxY + 6}" width="${FW - M * 2 - 12}" height="${boxH - 12}" rx="9" fill="none" stroke="#e5484d" stroke-opacity=".55" stroke-width="1.5"/>
  <g transform="translate(26,4)">
    <rect width="${tabW}" height="28" rx="8" fill="#e5484d" stroke="#0d1117" stroke-width="2"/>
    <text x="${tabW / 2}" y="19" class="name" text-anchor="middle">${esc(speaker)}</text>
  </g>
  ${text.join("\n  ")}
  <path class="next" d="M${FW - 40},${boxY + boxH - 26} h14 l-7,9 z" fill="#e5484d"/>
</svg>
`;
}

let introHtml = "";
if (introLines.length) {
  const svg = introSvg(introLines, displayName);
  await writeFile(`${CARDS_DIR}/_intro.svg`, svg);
  introHtml = `<picture><img src="${RAW}/${CARDS_DIR}/_intro.svg?v=${bust(svg)}" alt="${esc(introLines.join(" "))}" width="97%"></picture>\n\n`;
}

const readme = `<div align="center">

${introHtml}${frameImg("_top", topSvg)}

${partyHtml.join("\n")}

${frameImg("_bottom", bottomSvg)}

</div>
${restHtml.length ? `
<details>
<summary><picture><img src="${RAW}/${CARDS_DIR}/_more.svg?v=${bust(more)}" alt="나머지 포켓몬 ${restHtml.length}마리 더 보기" width="96%" align="middle"></picture></summary>
<br>
<div align="center">

${restHtml.join("\n")}

</div>
</details>
` : ""}
<p align="right"><sub><a href="https://wantaekchoi.github.io/pokerepo/?u=${login}">${login}'s Dex</a> · powered by <a href="https://github.com/wantaekchoi/pokerepo">PokeRepo</a></sub></p>
`;

const START_MARK = "<!-- POKEREPO-CARDS:START -->", END_MARK = "<!-- POKEREPO-CARDS:END -->";
const current = await readFile(README, "utf8").catch(() => "");
const block = `${START_MARK}\n${readme}${END_MARK}`;
const s = current.indexOf(START_MARK), e = current.indexOf(END_MARK);
await writeFile(README, s >= 0 && e > s
  ? current.slice(0, s) + block + current.slice(e + END_MARK.length)
  : `${block}\n`);
console.log(`party ${party.length}, rest ${rest.length}`);
