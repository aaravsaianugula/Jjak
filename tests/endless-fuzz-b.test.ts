/** Endless fuzz, part 2 of 4 (levels 851–1100); see tests/endless-fuzz.ts. */
import { describe } from 'vitest';
import { fuzz } from './endless-fuzz';

describe('endless fuzz', () => fuzz(851, 250));
