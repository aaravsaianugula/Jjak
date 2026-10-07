/**
 * Home-screen landscape. One scene per season, matching the chapter the player
 * is in: layered ridges, a sun or moon, the season's flower reaching in from
 * the edge, and slow drifting particles (petals, fireflies, leaves, snow).
 */

interface SceneStyle {
  sky: [string, string];
  far: string;
  mid: string;
  near: string;
  disc: string;
  discY: number;
  motif: number;
  particle: 'petal' | 'firefly' | 'leaf' | 'snow';
}

const SCENES: SceneStyle[] = [
  // Spring — cherry
  { sky: ['#f8e3e3', '#f3ecdf'], far: '#ecd1d4', mid: '#dcb3ba', near: '#c98f9b', disc: '#e9a0a0', discY: 58, motif: 2, particle: 'petal' },
  // Summer — iris, evening fireflies
  { sky: ['#dfece8', '#f3ecdf'], far: '#bfd4c8', mid: '#93b5a1', near: '#6d927c', disc: '#e8bd5a', discY: 50, motif: 4, particle: 'firefly' },
  // Autumn — maple
  { sky: ['#f6e2cf', '#f3ecdf'], far: '#e6c0a2', mid: '#cf8e66', near: '#a9583a', disc: '#c4472f', discY: 62, motif: 9, particle: 'leaf' },
  // Winter — plum in snow, moon
  { sky: ['#e3e9ef', '#f3ecdf'], far: '#d0d9e2', mid: '#aebdcc', near: '#8798ad', disc: '#fbf7ec', discY: 48, motif: 1, particle: 'snow' },
];

export function sceneSvg(season: number): string {
  const s = SCENES[season % 4];
  const id = `sky${season}`;
  return `<svg class="scene__art" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient></defs>
    <rect width="400" height="220" fill="url(#${id})"/>
    <circle cx="300" cy="${s.discY}" r="30" fill="${s.disc}" opacity=".9"/>
    <circle cx="300" cy="${s.discY}" r="42" fill="${s.disc}" opacity=".18"/>
    <path d="M0 150 Q50 104 104 128 T214 112 T318 120 T400 106 V220 H0Z" fill="${s.far}"/>
    <path d="M0 176 Q72 136 150 160 T300 150 T400 160 V220 H0Z" fill="${s.mid}"/>
    <path d="M0 200 Q90 174 190 192 T400 186 V220 H0Z" fill="${s.near}"/>
    <path d="M24 158 Q60 150 96 158 M230 170 Q270 162 310 170" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round" fill="none"/>
    <use href="#motif-${s.motif}" x="268" y="-30" width="160" height="224" opacity=".95"/>
  </svg>`;
}

/** Drifting particles as positioned spans (animated in CSS). */
export function sceneParticles(season: number, count = 14): string {
  const kind = SCENES[season % 4].particle;
  let out = '';
  for (let i = 0; i < count; i++) {
    // deterministic spread so the layout is stable between renders
    const x = (i * 37) % 100;
    const delay = ((i * 1.7) % 9).toFixed(1);
    const dur = (9 + ((i * 2.3) % 7)).toFixed(1);
    const size = 5 + ((i * 3) % 5);
    out += `<span class="pt pt--${kind}" style="left:${x}%;--d:${delay}s;--t:${dur}s;--s:${size}px"></span>`;
  }
  return out;
}
