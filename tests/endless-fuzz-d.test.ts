/** Endless fuzz, part 4 of 4 (levels 1351–1600); see tests/endless-fuzz.ts. */
import { describe } from 'vitest';
import { fuzz } from './endless-fuzz';

describe('endless fuzz', () => fuzz(1351, 250));
