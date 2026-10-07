/**
 * The endless road's Web Worker (EXPANSION_PLAN §C5): runs the generate-and-test
 * search for one level past 600 off the main thread, inside the job's time budget.
 * The main thread (endless.ts) sends plain data (the tailored identity, target,
 * bias, recent features) and gets the chosen spec back.
 *
 *   in:  { id, job: EndlessJob }
 *   out: { id, result: EndlessResult | null } | { id, error: string }
 */
import { type EndlessJob, runEndlessJob } from './endless-core';

interface Req {
  id: number;
  job: EndlessJob;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Req>) => void) | null;
  postMessage(msg: unknown): void;
};

ctx.onmessage = (e) => {
  const { id, job } = e.data;
  try {
    const result = runEndlessJob(job, () => performance.now());
    ctx.postMessage({ id, result });
  } catch (err) {
    ctx.postMessage({ id, error: String((err as Error)?.message ?? err) });
  }
};
