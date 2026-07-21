import { describe, expect, it } from "vitest";
import { summarizeRegions } from "@/lib/risk/region-summary";
import type { PlaceWithSafety } from "@/lib/datasource";
import type { PlaceEnvType } from "@/lib/tour/types";
import type { RiskFactor } from "@/lib/safety/types";

/** 요인 mock */
function f(key: string, points: number, value = 0, description = ""): RiskFactor {
  return {
    key: key as RiskFactor["key"],
    label: key,
    value,
    unit: "",
    threshold: 0,
    points,
    maxPoints: 40,
    level: "low",
    description,
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
  it("18개 시군을 항상 반환한다 (빈 시군은 null)", () => {
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
      mockPlace(1, 80),
      mockPlace(2, 35),
      mockPlace(undefined, 10),
    ]);
    expect(result.find((r) => r.sigunguCode === 1)!.placeCount).toBe(1);
    expect(result.find((r) => r.sigunguCode === 2)!.placeCount).toBe(1);
    expect(result.reduce((s, r) => s + r.placeCount, 0)).toBe(2);
  });

  it("시군 점수·분해 = 대표 야외 관광지 (점수와 분해가 같은 장소에서 옴)", () => {
    const result = summarizeRegions([
      mockPlace(1, 76, { factors: [f("heat", 12), f("rain_wind", 8), f("pm", 4)] }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.medianScore).toBe(76); // 대표 장소 점수 그대로
    expect(g.grade).toBe("low");
    expect(g.factors.map((x) => x.key)).toEqual(["heat", "rain_wind", "pm"]);
  });

  it("실내 제외 야외장소를 대표로 (실내로 강수 축소 방지)", () => {
    const result = summarizeRegions([
      mockPlace(1, 95, { factors: [f("rain_wind", 3)], envType: "indoor" }),
      mockPlace(1, 60, { factors: [f("rain_wind", 27)], envType: "outdoor_general" }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.medianScore).toBe(60); // 야외장소 점수 (실내 95 아님)
    expect(g.factors.find((x) => x.key === "rain_wind")!.points).toBe(27);
  });

  it("응급의료 설명에 시군 커버리지(골든타임 이내 %) 추가", () => {
    const result = summarizeRegions([
      mockPlace(1, 90, { factors: [f("medical", 1, 5, "응급실 5km")] }), // ≤10km
      mockPlace(1, 70, { factors: [f("medical", 3, 25, "응급실 25km")] }), // >10km
    ]);
    const med = result
      .find((r) => r.sigunguCode === 1)!
      .factors.find((x) => x.key === "medical")!;
    expect(med.description).toContain("50%"); // 2곳 중 1곳만 골든타임 이내
  });
});
