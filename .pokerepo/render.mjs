import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";

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
    return { name, types: poke.types.map((t) => t.type.name), sprite: `data:image/png;base64,${png.toString("base64")}` };
  })());
  return speciesCache.get(id);
}

const W = 272, H = 136, M = 6;

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
    .float { animation: float 3s ease-in-out infinite; animation-delay: ${delay}s; }
    @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
    @media (prefers-reduced-motion: reduce) { .float { animation: none } }
  </style>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${c2}" stop-opacity=".10"/>
    </linearGradient>
    <radialGradient id="r"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
  </defs>
  <g transform="translate(${M},${M})">
    <rect width="${W}" height="${H}" rx="18" fill="#161b22"/>
    <rect width="${W}" height="${H}" rx="18" fill="url(#g)" stroke="${c1}" stroke-opacity=".45"/>
    <circle cx="60" cy="68" r="56" fill="url(#r)"/>
    <g class="float"><image href="${mon.sprite}" x="4" y="12" width="112" height="112"/></g>
    <text x="118" y="34" class="name">${esc(mon.name)}</text>
    <text x="118" y="56" class="lv">Lv.<tspan class="lvnum">${mon.level}</tspan></text>
    ${chips}
    <rect x="118" y="104" width="132" height="6" rx="3" fill="#ffffff" fill-opacity=".12"/>
    <rect x="118" y="104" width="${bar}" height="6" rx="3" fill="${c1}"/>
    <text x="118" y="126" class="repo">${esc(repoShort)}</text>
  </g>
</svg>
`;
}

const state = JSON.parse(await readFile(STATE, "utf8"));
const login = state.login;
const entry = (repo) => ({ repo, ...state.repos[repo] });

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
    await writeFile(file, cardSvg(mon, ((i % 3) * 0.35).toFixed(2)));
    const tip = `${mon.name} · ${e.repo} · 커밋 ${e.commits}회 · 병합 PR ${e.merges}개`;
    return `<a href="https://github.com/${e.repo}" title="${esc(tip)}"><img src="${file}" alt="${esc(mon.name)} Lv.${e.level}" width="32%"></a>`;
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
if (rest.length) await writeFile(`${CARDS_DIR}/_more.svg`, await moreSvg(rest));

const readme = `<div align="center">

${partyHtml.join("\n")}

</div>
${restHtml.length ? `
<details>
<summary><img src="${CARDS_DIR}/_more.svg" alt="나머지 포켓몬 ${restHtml.length}마리 더 보기" width="96%" align="middle"></summary>
<br>
<div align="center">

${restHtml.join("\n")}

</div>
</details>
` : ""}
<p align="right"><sub><a href="https://wantaekchoi.github.io/pokerepo/?u=${login}">${login}'s Dex</a></sub></p>
`;

await writeFile(README, readme);
console.log(`party ${party.length}, rest ${rest.length}`);
