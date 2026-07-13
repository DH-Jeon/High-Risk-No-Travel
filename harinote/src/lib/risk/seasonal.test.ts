import { describe, expect, it } from "vitest";
import { coldPoints, seasonalRange } from "@/lib/risk/seasonal";
import { getPlaces } from "@/lib/datasource";

describe("coldPoints (16b cold_points 동일 산식)", () => {
  it("경계값: −5℃까지 0, −12℃에서 12, −15℃에서 22, 상한 25", () => {
    expect(coldPoints(0)).toBe(0);
    expect(coldPoints(-5)).toBe(0);
    expect(coldPoints(-8.5)).toBeCloseTo(4, 1);
    expect(coldPoints(-12)).toBe(12);
    expect(coldPoints(-15)).toBe(22);
    expect(coldPoints(-17)).toBe(25);
    expect(coldPoints(-30)).toBe(25);
  });
});

describe("seasonalRange", () => {
  const gangneungPlace = {
    contentId: 999_999_999, // 표고 데이터 없음 → dz=0
    envType: "outdoor_general" as const,
    sigunguCode: 1, // 강릉
    lat: 37.7519,
    lng: 128.8761,
  };

  it("궂은날 점수 ≤ 통상일 점수, 둘 다 0~100", () => {
    for (const month of [1, 4, 7, 10]) {
      const r = seasonalRange(gangneungPlace, month);
      expect(r).not.toBeNull();
      expect(r!.bad.score).toBeLessThanOrEqual(r!.typical.score);
      expect(r!.typical.score).toBeGreaterThanOrEqual(0);
      expect(r!.typical.score).toBeLessThanOrEqual(100);
    }
  });

  it("강릉 1월 궂은날(최저 −9.7℃)엔 한파 요인이 붙는다", () => {
    const r = seasonalRange(gangneungPlace, 1)!;
    const cold = r.bad.factors.find((f) => f.key === "cold");
    expect(cold).toBeDefined();
    // coldPoints(-9.7) = (−5−(−9.7))/7×8 ≈ 5.37 → 5점
    expect(cold!.points).toBe(5);
    // 7월엔 한파 요인 없음
    expect(r.month).toBe(1);
    const july = seasonalRange(gangneungPlace, 7)!;
    expect(july.bad.factors.some((f) => f.key === "cold")).toBe(false);
  });

  it("봄(3월)엔 산불달력 3단계가 반영된다", () => {
    const r = seasonalRange(gangneungPlace, 3)!;
    const fire = r.typical.factors.find((f) => f.key === "forest_fire");
    expect(fire!.value).toBe(3);
  });

  it("시나리오 없는 시군코드는 null", () => {
    expect(seasonalRange({ ...gangneungPlace, sigunguCode: 99 }, 7)).toBeNull();
  });

  it("16b 데모 대조: 미산계곡(인제) 7월 — 통상 81 · 궂은날 66 (±3, er 산출 차 허용)", async () => {
    const places = await getPlaces({ q: "미산계곡" });
    expect(places.length).toBeGreaterThan(0);
    const misan = places[0];
    const r = seasonalRange(misan, 7)!;
    expect(r.typical.score).toBeGreaterThanOrEqual(78);
    expect(r.typical.score).toBeLessThanOrEqual(84);
    expect(r.bad.score).toBeGreaterThanOrEqual(63);
    expect(r.bad.score).toBeLessThanOrEqual(69);
  });
});
