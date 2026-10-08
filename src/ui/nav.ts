import type { LevelSpec } from '../engine/levels';

/** Navigation entry points, wired up in main.ts (avoids import cycles between screens). */
export const nav = {
  home: (): void => {},
  game: (_spec: LevelSpec): void => {},
  /** play Journey level n: the Level Director picks (or generates) this player's board */
  journey: (_n: number): void => {},
  album: (): void => {},
  settings: (): void => {},
  /** first launch: the title screen with Begin */
  intro: (): void => {},
  /** the first-minute demo (after the intro's Begin) */
  welcome: (): void => {},
  map: (): void => {},
  seals: (): void => {},
  market: (_tab?: string): void => {},
  garden: (): void => {},
  path: (): void => {},
};
