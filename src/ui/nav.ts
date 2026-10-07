import type { LevelSpec } from '../engine/levels';

/** Navigation entry points, wired up in main.ts (avoids import cycles between screens). */
export const nav = {
  home: (): void => {},
  game: (_spec: LevelSpec): void => {},
  album: (): void => {},
  settings: (): void => {},
  welcome: (): void => {},
  map: (): void => {},
  seals: (): void => {},
  market: (_tab?: string): void => {},
  garden: (): void => {},
  path: (): void => {},
};
