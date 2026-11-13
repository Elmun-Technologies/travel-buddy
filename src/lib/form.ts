import type { z } from "zod";

/** Server action state: field → error code (translated via messages "errors.<code>"). */
export type FormState = {
  ok: false;
  errors: Record<string, string>;
  values?: Record<string, unknown>;
} | null;

const CODES = new Set([
  "under_18",
  "past",
  "before_start",
  "too_long",
  "min_gt_max",
  "too_short",
  "too_small",
  "too_big",
  "required",
]);

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const key = String(i.path[0] ?? "_form");
    if (out[key]) continue;
    if (CODES.has(i.message))
      out[key] = i.message === "too_long" && key === "endDate" ? "too_long_trip" : i.message;
    else if (i.code === "too_small")
      out[key] = "origin" in i && i.origin === "string" ? "too_short" : "too_small";
    else if (i.code === "too_big") out[key] = "origin" in i && i.origin === "string" ? "too_long" : "too_big";
    else out[key] = "invalid";
  }
  return out;
}

export const formError = (code: string): FormState => ({ ok: false, errors: { _form: code } });
