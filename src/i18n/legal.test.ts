import { expect, it } from "vitest";
import en from "../../messages/legal/en.json";
import ru from "../../messages/legal/ru.json";
import uz from "../../messages/legal/uz.json";

const shape = (o: unknown, p = ""): string[] =>
  Array.isArray(o)
    ? [`${p}[${o.length}]`, ...o.flatMap((v, i) => shape(v, `${p}[${i}]`))]
    : o && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) => shape(v, `${p}.${k}`))
      : [p];

it("legal texts have the same structure in uz, ru and en", () => {
  expect(shape(ru)).toEqual(shape(uz));
  expect(shape(en)).toEqual(shape(uz));
});

it("no legal text is empty and every {placeholder} is known", () => {
  for (const d of [uz, ru, en]) {
    const all = JSON.stringify(d);
    expect(all).not.toMatch(/""/);
    for (const m of all.matchAll(/\{(\w+)\}/g)) expect(["app", "terms", "privacy"]).toContain(m[1]);
  }
});
