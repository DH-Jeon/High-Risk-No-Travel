import { describe, expect, it } from "vitest";
import { parseSigungu } from "@/components/search-params";

describe("parseSigungu", () => {
  it("SIGUNGU_SEATS에 있는 코드(1~18)는 숫자로 반환", () => {
    expect(parseSigungu("1")).toBe(1);
    expect(parseSigungu("13")).toBe(13);
    expect(parseSigungu("18")).toBe(18);
  });

  it("범위 밖 코드는 undefined", () => {
    expect(parseSigungu("0")).toBeUndefined();
    expect(parseSigungu("19")).toBeUndefined();
    expect(parseSigungu("-1")).toBeUndefined();
  });

  it("숫자가 아니거나 비어 있으면 undefined", () => {
    expect(parseSigungu("abc")).toBeUndefined();
    expect(parseSigungu("")).toBeUndefined();
    expect(parseSigungu(undefined)).toBeUndefined();
  });

  it("배열이면 첫 값 기준", () => {
    expect(parseSigungu(["5", "13"])).toBe(5);
  });
});
