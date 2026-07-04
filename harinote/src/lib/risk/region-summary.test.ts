import { describe, expect, it } from "vitest";
import { summarizeRegions } from "@/lib/risk/region-summary";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import type { PlaceWithSafety } from "@/lib/datasource";

/** 집계에 필요한 최소 필드만 가진 mock */
function mockPlace(sigunguCode: number | undefined, score: number): PlaceWithSafety {
  return { sigunguCode, safety: { score } } as unknown as PlaceWithSafety;
}

describe("summarizeRegions", () => {
  it("18개 시군을 항상 코드 오름차순으로 반환한다 (빈 시군 포함)", () => {
    const result = summarizeRegions([]);
    expect(result).toHaveLength(18);
    expect(result.map((r) => r.sigunguCode)).toEqual(
      Object.keys(SIGUNGU_SEATS).map(Number).sort((a, b) => a - b),
    );
    for (const region of result) {
      expect(region.placeCount).toBe(0);
      expect(region.medianScore).toBeNull();
      expect(region.grade).toBeNull();
      expect(region.name).toBe(SIGUNGU_SEATS[region.sigunguCode].name);
    }
  });

  it("홀수 개면 가운데 값이 중앙값", () => {
    const result = summarizeRegions([
      mockPlace(1, 90),
      mockPlace(1, 50),
      mockPlace(1, 72),
    ]);
    const gangneung = result.find((r) => r.sigunguCode === 1)!;
    expect(gangneung.placeCount).toBe(3);
    expect(gangneung.medianScore).toBe(72);
    expect(gangneung.grade).toBe("low"); // gradeForScore: 70 이상 low
  });

  it("짝수 개면 가운데 두 값 평균을 반올림", () => {
    const result = summarizeRegions([
      mockPlace(13, 60),
      mockPlace(13, 71),
      mockPlace(13, 30),
      mockPlace(13, 95),
    ]);
    const chuncheon = result.find((r) => r.sigunguCode === 13)!;
    expect(chuncheon.placeCount).toBe(4);
    expect(chuncheon.medianScore).toBe(66); // (60+71)/2 = 65.5 → 66
    expect(chuncheon.grade).toBe("moderate"); // 40~69 moderate
  });

  it("시군별로 따로 그룹핑한다", () => {
    const result = summarizeRegions([
      mockPlace(1, 80),
      mockPlace(2, 35),
      mockPlace(1, 90),
    ]);
    const gangneung = result.find((r) => r.sigunguCode === 1)!;
    const goseong = result.find((r) => r.sigunguCode === 2)!;
    expect(gangneung.medianScore).toBe(85);
    expect(goseong.medianScore).toBe(35);
    expect(goseong.grade).toBe("high"); // 40 미만 high
  });

  it("sigunguCode가 없는 관광지는 집계에서 제외한다", () => {
    const result = summarizeRegions([
      mockPlace(undefined, 10),
      mockPlace(1, 80),
    ]);
    const gangneung = result.find((r) => r.sigunguCode === 1)!;
    expect(gangneung.placeCount).toBe(1);
    expect(gangneung.medianScore).toBe(80);
    const totalCount = result.reduce((sum, r) => sum + r.placeCount, 0);
    expect(totalCount).toBe(1);
  });
});
