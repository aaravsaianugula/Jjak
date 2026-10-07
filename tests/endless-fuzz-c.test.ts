/** Endless fuzz, part 3 of 4 (levels 1101–1350); see tests/endless-fuzz.ts. */
import { describe } from 'vitest';
import { fuzz } from './endless-fuzz';

describe('endless fuzz', () => fuzz(1101, 250));
