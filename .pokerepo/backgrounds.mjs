// Per-type decorative layer drawn inside a 272x136 card. Everything is procedural, no external art.
const W = 272, H = 136;

function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const times = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");
const f = (n) => Number(n.toFixed(1));

export const BG_CSS = `
    .rise { animation: rise 6s linear infinite; }
    @keyframes rise { 0% { transform: translateY(0); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(-70px); opacity: 0 } }
    .fall { animation: fall 9s linear infinite; }
    @keyframes fall { 0% { transform: translateY(-20px); opacity: 0 } 15% { opacity: 1 } 100% { transform: translateY(60px); opacity: 0 } }
    .drift { animation: drift 7s linear infinite; }
    @keyframes drift { from { transform: translateX(0) } to { transform: translateX(-68px) } }
    .drift-slow { animation: drift-slow 30s linear infinite; }
    @keyframes drift-slow { from { transform: translateX(0) } to { transform: translateX(-120px) } }
    .twinkle { animation: twinkle 3s ease-in-out infinite; }
    @keyframes twinkle { 0%,100% { opacity: .15 } 50% { opacity: 1 } }
    .flicker { animation: flicker 2.4s steps(1) infinite; }
    @keyframes flicker { 0%,100% { opacity: 1 } 8% { opacity: .2 } 12% { opacity: 1 } 60% { opacity: .5 } 64% { opacity: 1 } }
    .pulse { animation: pulse 4s ease-in-out infinite; transform-origin: 236px 24px; }
    @keyframes pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
    .sway { animation: sway 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes sway { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(8deg) } }
    .bob { animation: bob 5s ease-in-out infinite; }
    @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
    @media (prefers-reduced-motion: reduce) { .rise,.fall,.drift,.drift-slow,.twinkle,.flicker,.pulse,.sway,.bob { animation: none } }`;

const LAYERS = {
  normal: (c) => `
    <pattern id="p" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.4" fill="${c}"/></pattern>
    <rect width="${W}" height="${H}" fill="url(#p)" opacity=".28"/>`,

  fire: (c, r) => `<g fill="${c}">${times(16, () =>
    `<circle class="rise" cx="${f(20 + r() * 240)}" cy="${f(90 + r() * 50)}" r="${f(1.2 + r() * 2.4)}" style="animation-delay:-${f(r() * 6)}s"/>`)}</g>
    <path d="M0,${H} Q40,${H - 26} 80,${H - 10} T160,${H - 14} T272,${H - 20} V${H} Z" fill="${c}" opacity=".18"/>`,

  water: (c) => `<g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round">${times(4, (i) =>
    `<path class="drift" style="animation-duration:${7 + i * 2}s;animation-delay:-${i * 1.3}s" opacity="${f(0.42 - i * 0.08)}" d="M-68,${76 + i * 16} ${times(7, () => "q17,-7 34,0 t34,0 ")}"/>`)}</g>`,

  electric: (c, r) => `<g fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round">${times(4, () => {
    const x = 196 + r() * 64, y = 8 + r() * 96;
    return `<polyline class="flicker" style="animation-delay:-${f(r() * 2.4)}s" points="${f(x)},${f(y)} ${f(x - 8)},${f(y + 14)} ${f(x + 2)},${f(y + 14)} ${f(x - 6)},${f(y + 30)}"/>`;
  })}</g>`,

  grass: (c, r) => `<g fill="${c}">${times(11, () => {
    const x = 20 + r() * 240, y = 10 + r() * 120, a = f(r() * 180);
    return `<g transform="translate(${f(x)},${f(y)}) rotate(${a})"><g class="sway" style="animation-delay:-${f(r() * 5)}s"><path d="M-9,0 Q0,-6 9,0 Q0,6 -9,0 Z" opacity=".55"/><path d="M-9,0 H9" stroke="#0d1117" stroke-opacity=".35" stroke-width=".8"/></g></g>`;
  })}</g>`,

  ice: (c, r) => `<g stroke="${c}" stroke-width="1.4" stroke-linecap="round">${times(12, () => {
    const s = 3 + r() * 4;
    return `<g class="fall" style="animation-delay:-${f(r() * 9)}s"><g transform="translate(${f(10 + r() * 252)},${f(10 + r() * 90)})">${times(3, (k) =>
      `<line x1="${f(-s)}" y1="0" x2="${f(s)}" y2="0" transform="rotate(${k * 60})"/>`)}</g></g>`;
  })}</g>`,

  fighting: (c, r) => `<g stroke="${c}" stroke-linecap="round">${times(14, () => {
    const y = r() * (H + 40) - 20, len = 30 + r() * 80;
    return `<line x1="${W + 10}" y1="${f(y)}" x2="${f(W + 10 - len)}" y2="${f(y + len * 0.35)}" stroke-width="${f(1 + r() * 2)}" opacity="${f(0.25 + r() * 0.45)}"/>`;
  })}</g>`,

  poison: (c, r) => `<g fill="none" stroke="${c}" stroke-width="1.5">${times(12, () =>
    `<circle class="rise" cx="${f(20 + r() * 240)}" cy="${f(100 + r() * 40)}" r="${f(2 + r() * 6)}" style="animation-duration:${f(5 + r() * 4)}s;animation-delay:-${f(r() * 8)}s"/>`)}</g>`,

  ground: (c) => `<g fill="${c}">
    <path d="M0,${H} V104 Q60,86 130,100 T272,92 V${H} Z" opacity=".22"/>
    <path d="M0,${H} V118 Q80,104 160,116 T272,110 V${H} Z" opacity=".28"/>
    </g><g stroke="${c}" stroke-width="1" opacity=".35">${times(5, (i) => `<line x1="${168 + i * 18}" y1="${62 + i * 7}" x2="${190 + i * 18}" y2="${62 + i * 7}"/>`)}</g>`,

  flying: (c, r) => {
    const cloud = (x, y, s) => `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})"><circle cx="0" cy="0" r="10"/><circle cx="12" cy="-5" r="13"/><circle cx="26" cy="0" r="10"/><rect x="0" y="0" width="26" height="10"/></g>`;
    return `<g class="drift-slow" fill="${c}" opacity=".3">${times(4, (i) => cloud(40 + i * 120 + r() * 30, 20 + r() * 90, 0.6 + r() * 0.5))}</g>
    <g fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity=".5">${times(3, () => {
      const x = 140 + r() * 100, y = 20 + r() * 90;
      return `<path d="M${f(x)},${f(y)} q18,-10 36,0 t30,-2"/>`;
    })}</g>`;
  },

  psychic: (c) => `<g class="pulse" fill="none" stroke="${c}" stroke-width="1.3">${times(9, (i) =>
    `<circle cx="236" cy="24" r="${14 + i * 16}" opacity="${f(0.6 - i * 0.055)}"/>`)}</g>`,

  bug: (c) => `
    <pattern id="p" width="24" height="41.6" patternUnits="userSpaceOnUse" patternTransform="scale(.8)">
      <path d="M12,0 L24,6.9 V20.8 L12,27.7 L0,20.8 V6.9 Z M12,27.7 V41.6 M0,20.8 L-12,27.7 M24,20.8 L36,27.7" fill="none" stroke="${c}" stroke-width="1.2"/>
    </pattern>
    <rect width="${W}" height="${H}" fill="url(#p)" opacity=".2"/>`,

  rock: (c, r) => `<g fill="${c}">${times(9, () => {
    const x = 10 + r() * 252, y = 70 + r() * 70, s = 6 + r() * 12;
    const pts = times(6, (k) => {
      const a = (k / 6) * Math.PI * 2, d = s * (0.7 + r() * 0.3);
      return `${f(x + Math.cos(a) * d)},${f(y + Math.sin(a) * d * 0.75)} `;
    });
    return `<polygon points="${pts}" opacity="${f(0.2 + r() * 0.25)}"/>`;
  })}</g>`,

  ghost: (c, r) => `<defs><filter id="blur"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <g fill="${c}" filter="url(#blur)">${times(6, () =>
      `<ellipse class="bob" style="animation-delay:-${f(r() * 5)}s" cx="${f(40 + r() * 220)}" cy="${f(20 + r() * 100)}" rx="${f(10 + r() * 14)}" ry="${f(6 + r() * 8)}" opacity=".45"/>`)}</g>`,

  dragon: (c) => `
    <pattern id="p" width="20" height="12" patternUnits="userSpaceOnUse">
      <path d="M0,12 A10,10 0 0 1 20,12 M-10,6 A10,10 0 0 1 10,6 M10,6 A10,10 0 0 1 30,6" fill="none" stroke="${c}" stroke-width="1.1"/>
    </pattern>
    <rect width="${W}" height="${H}" fill="url(#p)" opacity=".2"/>`,

  dark: (c, r) => `
    <mask id="moon"><circle cx="232" cy="30" r="18" fill="#fff"/><circle cx="240" cy="24" r="16" fill="#000"/></mask>
    <circle cx="232" cy="30" r="18" fill="${c}" mask="url(#moon)" opacity=".7"/>
    <g fill="#f0f6fc">${times(14, () =>
      `<circle class="twinkle" style="animation-delay:-${f(r() * 3)}s" cx="${f(120 + r() * 150)}" cy="${f(6 + r() * 124)}" r="${f(0.6 + r() * 1)}"/>`)}</g>`,

  steel: (c, r) => `
    <pattern id="p" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="${c}" stroke-width="1"/></pattern>
    <rect width="${W}" height="${H}" fill="url(#p)" opacity=".16"/>
    <g fill="none" stroke="${c}" stroke-width="2" opacity=".45">${times(2, () => {
      const x = 170 + r() * 80, y = 20 + r() * 90, rr = 10 + r() * 8;
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" stroke-dasharray="4 3"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(rr / 2.6)}"/>`;
    })}</g>`,

  fairy: (c, r) => `<g fill="${c}">${times(12, () => {
    const x = 20 + r() * 240, y = 8 + r() * 120, s = 2.5 + r() * 4;
    return `<path class="twinkle" style="animation-delay:-${f(r() * 3)}s" d="M${f(x)},${f(y - s)} Q${f(x)},${f(y)} ${f(x + s)},${f(y)} Q${f(x)},${f(y)} ${f(x)},${f(y + s)} Q${f(x)},${f(y)} ${f(x - s)},${f(y)} Q${f(x)},${f(y)} ${f(x)},${f(y - s)} Z"/>`;
  })}</g>`,
};

export const BG_TYPES = Object.keys(LAYERS);

export function typeBackground(type, color, seed) {
  const layer = LAYERS[type] ?? LAYERS.normal;
  return layer(color, rng(seed));
}
