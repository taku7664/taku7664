import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const CARD = process.env.CARD ?? ".pokerepo/card.md";
const OUT = process.env.OUT ?? "party.svg";

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
  const party = [];
  for (let i = 0; i + 1 < rows.length; i += 2) {
    for (const td of rows[i + 1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)) {
      const cell = td[1];
      party.push({
        id: Number(cell.match(/[?&]m=(\d+)/)[1]),
        level: Number(cell.match(/Lv\.(\d+)/)[1]),
        repo: cell.match(/title="([^"]+)"/)?.[1] ?? "",
      });
    }
  }
  return party;
}

async function enrich(mon) {
  const poke = await json(`https://pokeapi.co/api/v2/pokemon/${mon.id}`);
  const species = await json(poke.species.url);
  const ko = species.names.find((n) => n.language.name === "ko")?.name;
  const en = species.names.find((n) => n.language.name === "en")?.name ?? poke.name;
  const art = poke.sprites.other?.home?.front_default ?? poke.sprites.other?.["official-artwork"]?.front_default;
  const png = await sharp(Buffer.from(await (await fetch(art)).arrayBuffer()))
    .resize(160, 160, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return {
    ...mon,
    name: ko ?? en,
    types: poke.types.map((t) => t.type.name),
    sprite: `data:image/png;base64,${png.toString("base64")}`,
  };
}

function slot(mon, x, y, i) {
  const W = 272, H = 136;
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
  return `
  <g transform="translate(${x},${y})">
    <defs>
      <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c1}" stop-opacity=".38"/>
        <stop offset="1" stop-color="${c2}" stop-opacity=".10"/>
      </linearGradient>
      <radialGradient id="r${i}"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" rx="18" fill="#161b22"/>
    <rect width="${W}" height="${H}" rx="18" fill="url(#g${i})" stroke="${c1}" stroke-opacity=".45"/>
    <circle cx="60" cy="68" r="56" fill="url(#r${i})"/>
    <g class="float" style="animation-delay:${(i * 0.35).toFixed(2)}s">
      <image href="${mon.sprite}" x="4" y="12" width="112" height="112"/>
    </g>
    <text x="118" y="34" class="name">${esc(mon.name)}</text>
    <text x="118" y="56" class="lv">Lv.<tspan class="lvnum">${mon.level}</tspan></text>
    ${chips}
    <rect x="118" y="104" width="132" height="6" rx="3" fill="#ffffff" fill-opacity=".12"/>
    <rect x="118" y="104" width="${bar}" height="6" rx="3" fill="${c1}"/>
    <text x="118" y="126" class="repo">${esc(repoShort)}</text>
  </g>`;
}

const md = await readFile(CARD, "utf8");
const party = await Promise.all(parseParty(md).map(enrich));

const COLS = 3, GAP = 14, PAD = 16, W = 272, H = 136;
const rows = Math.ceil(party.length / COLS);
const width = PAD * 2 + COLS * W + (COLS - 1) * GAP;
const height = PAD * 2 + rows * H + (rows - 1) * GAP;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Helvetica, Arial, sans-serif; }
    .name { font-size: 20px; font-weight: 700; fill: #f0f6fc; }
    .lv { font-size: 13px; font-weight: 600; fill: #8b949e; }
    .lvnum { font-size: 17px; font-weight: 800; fill: #f0f6fc; }
    .chip { font-size: 11px; font-weight: 700; fill: #fff; text-anchor: middle; }
    .repo { font-size: 11px; fill: #8b949e; }
    .float { animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
    @media (prefers-reduced-motion: reduce) { .float { animation: none } }
  </style>
  <rect width="${width}" height="${height}" rx="22" fill="#0d1117"/>
  ${party.map((m, i) => slot(m, PAD + (i % COLS) * (W + GAP), PAD + Math.floor(i / COLS) * (H + GAP), i)).join("")}
</svg>
`;

await writeFile(OUT, svg);
console.log(`wrote ${OUT} (${party.length} mons, ${(svg.length / 1024).toFixed(0)} KB)`);
