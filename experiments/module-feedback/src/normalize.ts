/** Coerce a model's parsed JSON into our strict Suggestion/Measurement shapes. */
import type { Measurement, Severity, Suggestion } from './types.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const asStr = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const asNum = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const asSeverity = (v: unknown): Severity | undefined =>
  v === 'low' || v === 'medium' || v === 'high' ? v : undefined;

export function normalizeSuggestions(parsed: unknown): Suggestion[] {
  const raw = pickArray(parsed, 'suggestions');
  return raw
    .filter(isObj)
    .map((s): Suggestion => {
      const observation = asStr(s.observation ?? s.issue ?? s.problem);
      const suggestedModification = asStr(
        s.suggestedModification ?? s.suggestion ?? s.modification ?? s.fix,
      );
      return {
        observation,
        suggestedModification,
        severity: asSeverity(s.severity),
        confidence: asNum(s.confidence),
      };
    })
    .filter((s) => s.observation || s.suggestedModification);
}

export function normalizeMeasurements(parsed: unknown): Measurement[] {
  const raw = pickArray(parsed, 'measurements');
  return raw
    .filter(isObj)
    .map((m): Measurement => {
      const valueNum = asNum(m.value);
      return {
        label: asStr(m.label ?? m.name),
        value: valueNum ?? asStr(m.value),
        unit: m.unit ? asStr(m.unit) : undefined,
        detail: m.detail ? asStr(m.detail) : undefined,
        confidence: asNum(m.confidence),
      };
    })
    .filter((m) => m.label);
}

export function normalizeSummary(parsed: unknown): string | undefined {
  if (isObj(parsed) && parsed.summary) return asStr(parsed.summary);
  return undefined;
}

function pickArray(parsed: unknown, key: string): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (isObj(parsed) && Array.isArray(parsed[key])) return parsed[key] as unknown[];
  return [];
}
