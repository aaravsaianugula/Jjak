/**
 * docs/level-audit.md is re-rendered by every `npm run bank` and `npm run bank:audit`;
 * a hand-written part (a session's measured before/after) sits below a marker and must
 * survive each re-render unchanged.
 */
import { describe, expect, it } from 'vitest';
import { KEPT_MARKER, withKept } from '../scripts/lib/audit';

describe('the hand-written part of the level audit', () => {
  const kept = `${KEPT_MARKER}\n\n## Before and after\n\n| a | b |\n|---|---|\n| 1 | 2 |\n`;

  it('is kept below a fresh render, whatever the old render said', () => {
    const old = `# Level audit\n\nold numbers 0.31\n\n${kept}`;
    const out = withKept('# Level audit\n\nnew numbers 0.42\n', old);
    expect(out).toContain('new numbers 0.42');
    expect(out).not.toContain('old numbers');
    expect(out.endsWith(kept)).toBe(true);
  });

  it('survives any number of re-renders unchanged', () => {
    let doc = withKept('# A\n', `# old\n${kept}`);
    for (let i = 0; i < 3; i++) doc = withKept(`# render ${i}\n`, doc);
    expect(doc).toBe(`# render 2\n\n${kept}`);
  });

  it('a file without the marker (or no file yet) is just the render', () => {
    expect(withKept('# A\n', null)).toBe('# A\n');
    expect(withKept('# A\n', '# hand edits above no marker\n')).toBe('# A\n');
  });
});
