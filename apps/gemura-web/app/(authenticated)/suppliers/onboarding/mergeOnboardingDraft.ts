import type { CollectorFormState, FarmerFormState } from './model';
import { initialCollectorState, initialFarmerState } from './model';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Deep-merge plain object leaves; arrays and scalars replace. Max depth guards runaway JSON. */
function deepAssign(target: Record<string, unknown>, source: Record<string, unknown>, depth = 0): void {
  if (depth > 8) return;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    if (sv === undefined || sv === null) continue;
    const tv = target[key];
    if (isPlainObject(sv) && isPlainObject(tv)) {
      deepAssign(tv, sv, depth + 1);
    } else {
      target[key] = sv;
    }
  }
}

export function mergeFarmerDraft(patch: unknown): FarmerFormState {
  const base = structuredClone(initialFarmerState()) as unknown as Record<string, unknown>;
  if (isPlainObject(patch)) {
    deepAssign(base, patch as Record<string, unknown>);
  }
  return base as unknown as FarmerFormState;
}

export function mergeCollectorDraft(patch: unknown): CollectorFormState {
  const base = structuredClone(initialCollectorState()) as unknown as Record<string, unknown>;
  if (isPlainObject(patch)) {
    deepAssign(base, patch as Record<string, unknown>);
  }
  return base as unknown as CollectorFormState;
}
