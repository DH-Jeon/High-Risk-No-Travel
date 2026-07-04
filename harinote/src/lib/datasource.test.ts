import { describe, expect, it } from "vitest";
import { getPlaces } from "@/lib/datasource";

describe("getPlaces — sigunguCode 필터", () => {
  it("시군구 코드로 필터하면 전건이 해당 코드다 (춘천=13)", async () => {
    const places = await getPlaces({ sigunguCode: 13 });
    expect(places.length).toBeGreaterThan(0);
    expect(places.every((p) => p.sigunguCode === 13)).toBe(true);
  });

  it("검색어와 시군구 필터를 함께 적용할 수 있다", async () => {
    const all = await getPlaces({ q: "해수욕장" });
    const sokcho = await getPlaces({ q: "해수욕장", sigunguCode: 5 });
    expect(sokcho.length).toBeGreaterThan(0);
    expect(sokcho.length).toBeLessThan(all.length);
    expect(sokcho.every((p) => p.sigunguCode === 5)).toBe(true);
  });

  it("sigunguCode 미지정이면 필터하지 않는다", async () => {
    const all = await getPlaces();
    const unfiltered = await getPlaces({ sigunguCode: undefined });
    expect(unfiltered.length).toBe(all.length);
  });
});
