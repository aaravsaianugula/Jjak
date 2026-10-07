/**
 * Card cosmetics: deck styles (how every card face is painted), card backs
 * (snow cards, dealing) and the gold-leaf foil edition overlay.
 *
 * CONTRACT (used by the Market and the Album; the art is drawn here):
 *   DECK_STYLES / CARD_BACKS  — catalog data (ids are stable save keys)
 *   applyDeckStyle(id)        — repaint the sprite / root styling for that deck
 *   applyCardBack(id)         — repaint the #card-back and #card-snow symbols
 *   foilOverlay()             — SVG markup layered over a card in a 100×140 box
 */

export interface CosmeticDef {
  id: string;
  name: string;
  ko: string;
  ja: string;
  /** one line for the Market */
  blurb: string;
}

export const DECK_STYLES: CosmeticDef[] = [
  { id: 'classic', name: 'Classic', ko: '기본', ja: '基本', blurb: 'The everyday deck: soft paper, clean ink.' },
  { id: 'sumi', name: 'Ink wash', ko: '수묵', ja: '水墨', blurb: 'Painted in shades of ink, with one touch of red.' },
  { id: 'moonlit', name: 'Moonlit', ko: '달밤', ja: '月夜', blurb: 'Indigo night paper with silver lines.' },
  { id: 'celadon', name: 'Celadon', ko: '청자', ja: '青磁', blurb: 'The jade-green glaze of Goryeo celadon.' },
  { id: 'woodblock', name: 'Woodblock', ko: '목판', ja: '木版', blurb: 'Bold printed blocks of colour, like an old print.' },
  { id: 'gilded', name: 'Gold leaf', ko: '금박', ja: '金箔', blurb: 'Every card edged and flecked with gold.' },
];

export const CARD_BACKS: CosmeticDef[] = [
  { id: 'classic', name: 'Night sky', ko: '밤하늘', ja: '夜空', blurb: 'The original indigo back.' },
  { id: 'seigaiha', name: 'Blue waves', ko: '청해파', ja: '青海波', blurb: 'Overlapping waves, a pattern for calm seas.' },
  { id: 'dancheong', name: 'Dancheong', ko: '단청', ja: '丹青', blurb: 'Painted like the eaves of a Korean temple.' },
  { id: 'asanoha', name: 'Hemp leaf', ko: '삼잎', ja: '麻の葉', blurb: 'A six-point star pattern for growing strong.' },
  { id: 'clouds', name: 'Lucky clouds', ko: '구름', ja: '瑞雲', blurb: 'Curling clouds that bring good fortune.' },
  { id: 'moon', name: 'Harvest moon', ko: '보름달', ja: '満月', blurb: 'A full moon over silver grass.' },
];

/** Repaint card faces for a deck style. Stub until the art lands. */
export function applyDeckStyle(id: string): void {
  document.documentElement.dataset.deck = id;
}

/** Repaint the card back / snow symbols. Stub until the art lands. */
export function applyCardBack(id: string): void {
  document.documentElement.dataset.back = id;
}

/** Gold-leaf overlay for foil editions (100×140 box). Stub: a thin gold frame. */
export function foilOverlay(): string {
  return '<rect x="3" y="3" width="94" height="134" rx="6" fill="none" stroke="#c9a24a" stroke-width="2.4" class="foil-edge"/>';
}

/**
 * Standalone preview of one card painted in any deck style (for the Market),
 * independent of the sprite currently installed. Stub: the active sprite.
 */
export function cardPreviewSvg(id: number, styleId: string): string {
  void styleId;
  return `<svg class="card-art" viewBox="0 0 100 140" aria-hidden="true"><use href="#card-${id}"/></svg>`;
}

/** Standalone preview of a card back (for the Market). Stub: the active back. */
export function cardBackPreviewSvg(backId: string): string {
  void backId;
  return '<svg class="card-art" viewBox="0 0 100 140" aria-hidden="true"><use href="#card-back"/></svg>';
}
