/**
 * The Garden (정원 · 庭): a small courtyard the player decorates with items
 * bought in the Market. Every item has a fixed, hand-composed spot, so the
 * garden always looks arranged, whatever the player owns.
 *
 * CONTRACT (the Market sells GARDEN_ITEMS; the Garden screen calls gardenSvg):
 *   GARDEN_ITEMS            — catalog data; ids are stable save keys
 *   gardenSvg(season, ids)  — the full scene with those items placed
 */

export interface GardenItem {
  id: string;
  name: string;
  ko: string;
  ja: string;
  blurb: string;
  /** another item this one needs first (e.g. koi need the pond) */
  needs?: string;
}

export const GARDEN_ITEMS: GardenItem[] = [
  { id: 'stones', name: 'Stepping stones', ko: '디딤돌', ja: '飛び石', blurb: 'A path to walk the garden.' },
  { id: 'lantern', name: 'Stone lantern', ko: '석등', ja: '石灯籠', blurb: 'Glows softly after dusk.' },
  { id: 'pond', name: 'Lotus pond', ko: '연못', ja: '池', blurb: 'Still water that holds the sky.' },
  { id: 'koi', name: 'Koi', ko: '잉어', ja: '鯉', blurb: 'Three koi circling slowly.', needs: 'pond' },
  { id: 'bridge', name: 'Stone bridge', ko: '돌다리', ja: '石橋', blurb: 'A low arch over the water.', needs: 'pond' },
  { id: 'bamboo', name: 'Bamboo grove', ko: '대나무', ja: '竹林', blurb: 'Rustles when the wind passes.' },
  { id: 'plum', name: 'Plum tree', ko: '매화나무', ja: '梅の木', blurb: 'The first blossom of the year.' },
  { id: 'maple', name: 'Maple tree', ko: '단풍나무', ja: '紅葉', blurb: 'Turns crimson in autumn.' },
  { id: 'persimmon', name: 'Persimmon tree', ko: '감나무', ja: '柿の木', blurb: 'Orange fruit hanging into winter.' },
  { id: 'bonsai', name: 'Pine bonsai', ko: '분재', ja: '盆栽', blurb: 'A hundred-year pine in a tray.' },
  { id: 'wisteria', name: 'Wisteria trellis', ko: '등나무', ja: '藤棚', blurb: 'Purple sprays hanging overhead.' },
  { id: 'irises', name: 'Iris bed', ko: '붓꽃', ja: '菖蒲', blurb: 'Blue irises at the water’s edge.' },
  { id: 'wall', name: 'Stone wall', ko: '돌담', ja: '石垣', blurb: 'A low wall of stacked stones and tiles.' },
  { id: 'onggi', name: 'Onggi jars', ko: '옹기', ja: '甕', blurb: 'Earthen jars for soy and kimchi.' },
  { id: 'pavilion', name: 'Pavilion', ko: '정자', ja: '東屋', blurb: 'A roofed seat to watch the seasons.' },
  { id: 'teatable', name: 'Tea table', ko: '찻상', ja: '茶卓', blurb: 'A low table set for two.' },
  { id: 'chime', name: 'Wind chime', ko: '풍경', ja: '風鈴', blurb: 'A clear note on a summer breeze.' },
  { id: 'lanterns', name: 'Paper lanterns', ko: '등불', ja: '提灯', blurb: 'A string of warm lights.' },
  { id: 'fountain', name: 'Bamboo fountain', ko: '물레방아', ja: 'ししおどし', blurb: 'Fills, tips and clacks.' },
  { id: 'swing', name: 'Swing', ko: '그네', ja: 'ぶらんこ', blurb: 'A rope swing from an old branch.' },
  { id: 'cat', name: 'Sleeping cat', ko: '고양이', ja: '猫', blurb: 'Naps in the warmest spot.' },
  { id: 'crane', name: 'Crane', ko: '학', ja: '鶴', blurb: 'Stands on one leg by the water.', needs: 'pond' },
  { id: 'deer', name: 'Deer', ko: '사슴', ja: '鹿', blurb: 'A shy visitor from the hills.' },
  { id: 'fireflies', name: 'Fireflies', ko: '반딧불이', ja: '蛍', blurb: 'Tiny lights drifting at night.' },
];

/** Full garden scene (viewBox 0 0 360 300). Stub until the art lands. */
export function gardenSvg(season: number, items: readonly string[]): string {
  const tint = ['#eef2e4', '#e3efe2', '#f3e6d8', '#eef1f4'][season % 4];
  const labels = items
    .map((id, i) => `<text x="${20 + (i % 4) * 85}" y="${40 + Math.floor(i / 4) * 30}" font-size="11" fill="#2a2724">${id}</text>`)
    .join('');
  return `<svg class="garden-art" viewBox="0 0 360 300" role="img" aria-label="Your garden"><rect width="360" height="300" fill="${tint}"/>${labels}</svg>`;
}

/** One item on its own (viewBox 0 0 120 120) for Market tiles. Stub. */
export function gardenItemSvg(id: string): string {
  return `<svg class="garden-item-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="40" fill="#d8cdb8"/><text x="60" y="64" font-size="11" text-anchor="middle" fill="#2a2724">${id}</text></svg>`;
}
