import { describe, expect, it } from "vitest";
import { summarizeRegions } from "@/lib/risk/region-summary";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import type { PlaceWithSafety } from "@/lib/datasource";
import type { PlaceEnvType } from "@/lib/tour/types";
import type { RiskFactor } from "@/lib/safety/types";

/** 요인 mock — 표시 점수는 이 감점 합으로 산출된다 */
function f(key: string, points: number, value = 0): RiskFactor {
  return {
    key: key as RiskFactor["key"],
    label: key,
    value,
    unit: "",
    threshold: 0,
    points,
    maxPoints: 40,
    level: "low",
    description: "",
  };
}

function mockPlace(
  sigunguCode: number | undefined,
  score: number,
  opts: { factors?: RiskFactor[]; envType?: PlaceEnvType; title?: string } = {},
): PlaceWithSafety {
  const { factors = [], envType = "outdoor_general", title = "곳" } = opts;
  return {
    sigunguCode,
    title,
    envType,
    safety: { score, factors },
  } as unknown as PlaceWithSafety;
}

describe("summarizeRegions", () => {
  it("18개 시군을 항상 코드 오름차순으로 반환한다 (빈 시군 포함)", () => {
    const result = summarizeRegions([]);
    expect(result).toHaveLength(18);
    for (const region of result) {
      expect(region.placeCount).toBe(0);
      expect(region.medianScore).toBeNull();
      expect(region.grade).toBeNull();
    }
  });

  it("시군별로 그룹핑하고 sigunguCode 없는 관광지는 제외", () => {
    const result = summarizeRegions([
      mockPlace(1, 80, { factors: [f("heat", 10)] }),
      mockPlace(2, 35, { factors: [f("heat", 40)] }),
      mockPlace(undefined, 10),
    ]);
    expect(result.find((r) => r.sigunguCode === 1)!.placeCount).toBe(1);
    expect(result.find((r) => r.sigunguCode === 2)!.placeCount).toBe(1);
    expect(result.reduce((s, r) => s + r.placeCount, 0)).toBe(2);
  });

  it("시군 표시 점수 = 요인 감점 합 (100 − 합), 분해와 항상 일치", () => {
    const result = summarizeRegions([
      mockPlace(1, 70, { factors: [f("heat", 12), f("rain_wind", 8), f("pm", 4)] }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.medianScore).toBe(76); // 100 − (12+8+4)
    const sum = g.factors.reduce((s, x) => s + x.points, 0);
    expect(g.medianScore).toBe(100 - sum);
    expect(g.grade).toBe("low");
  });

  it("날씨 기준은 실내 제외 야외장소 (실내 할인으로 강수 축소되는 왜곡 방지)", () => {
    // 실내(강수 감점 작음) + 야외(강수 감점 큼) → 야외 기준으로 잡혀 점수 낮아야
    const result = summarizeRegions([
      mockPlace(1, 95, { factors: [f("rain_wind", 3)], envType: "indoor" }),
      mockPlace(1, 60, { factors: [f("rain_wind", 27)], envType: "outdoor_general" }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.factors.find((x) => x.key === "rain_wind")!.points).toBe(27);
  });

  it("응급의료 = 시군 커버리지 (거리 중앙값 + 골든타임 비율)", () => {
    const result = summarizeRegions([
      mockPlace(1, 90, { factors: [f("medical", 0, 5)] }),
      mockPlace(1, 80, { factors: [f("medical", 5, 25)] }),
      mockPlace(1, 70, { factors: [f("medical", 2, 12)] }),
    ]);
    const med = result
      .find((r) => r.sigunguCode === 1)!
      .factors.find((x) => x.key === "medical")!;
    expect(med.value).toBe(12); // 거리 중앙값(5·12·25 → 12)
    expect(med.description).toContain("33%"); // 10km 이내는 5km 하나 → 1/3
  });

  it("산사태 = 시군 내 최고 위험 지형(worst-spot)", () => {
    const result = summarizeRegions([
      mockPlace(1, 60, { factors: [f("heat", 5)] }),
      mockPlace(1, 40, { factors: [f("landslide", 8, 2)], envType: "outdoor_mountain" }),
    ]);
    const ls = result
      .find((r) => r.sigunguCode === 1)!
      .factors.find((x) => x.key === "landslide")!;
    expect(ls.value).toBe(2); // 두 장소 중 최고 레벨
  });
});
