import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import uz from "../../messages/uz.json";

const keys = (o: object, p = ""): string[] =>
  Object.entries(o)
    .flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
    .sort();

describe("messages", () => {
  it("ru and en have exactly the uz keys", () => {
    expect(keys(ru)).toEqual(keys(uz));
    expect(keys(en)).toEqual(keys(uz));
  });
});
