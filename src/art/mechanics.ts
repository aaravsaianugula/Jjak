/**
 * Art for the board mechanics that aren't cards: gates (門) and bamboo fences.
 * Shared by the game board, the mini demo boards and the map legend.
 * Drawn in card units (100 × 140) so a gate sits in a card's slot.
 */
import { MONTH_TINTS } from './cards';

/** A closed wooden gate stamped with its flower's month number. */
export function gateSvg(month: number): string {
  const tint = MONTH_TINTS[month] ?? '#b8893b';
  return `<svg class="gate__art" viewBox="0 0 100 140" aria-hidden="true">
    <rect x="8" y="14" width="84" height="118" rx="6" fill="#6d4a2f" stroke="#3b2717" stroke-width="3"/>
    <path d="M4 18H96M10 10H90" stroke="#3b2717" stroke-width="5" stroke-linecap="round"/>
    <path d="M50 20V130M14 52H86M14 96H86" stroke="#3b2717" stroke-width="2.4" opacity=".55"/>
    <circle cx="50" cy="74" r="21" fill="${tint}" stroke="#3b2717" stroke-width="2.4"/>
    <text x="50" y="82" text-anchor="middle" font-size="22" font-family="Gowun Batang, serif" fill="#2a2724">${month + 1}</text>
  </svg>`;
}

/** One bamboo fence segment, drawn along the x axis (0..100) and centred on y = 0. */
export const FENCE_PATH = 'M2 0H98';
