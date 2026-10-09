/** Endless fuzz, part 1 of 4 (levels 601–850); see tests/endless-fuzz.ts. */
import { describe } from 'vitest';
import { fuzz } from './endless-fuzz';

describe('endless fuzz', () => fuzz(601, 250));
