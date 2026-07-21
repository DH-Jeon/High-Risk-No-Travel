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
      mockPlace(1, 76, { factors: [f("heat", 12), f("rain", 8), f("pm", 4)] }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.medianScore).toBe(76); // 대표 장소 점수 그대로
    expect(g.grade).toBe("low");
    expect(g.factors.map((x) => x.key)).toEqual(["heat", "rain", "pm"]);
  });

  it("실내 제외 야외장소를 대표로 (실내로 강수 축소 방지)", () => {
    const result = summarizeRegions([
      mockPlace(1, 95, { factors: [f("rain", 3)], envType: "indoor" }),
      mockPlace(1, 60, { factors: [f("rain", 27)], envType: "outdoor_general" }),
    ]);
    const g = result.find((r) => r.sigunguCode === 1)!;
    expect(g.medianScore).toBe(60); // 야외장소 점수 (실내 95 아님)
    expect(g.factors.find((x) => x.key === "rain")!.points).toBe(27);
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

  it("응급의료 감점은 시군 중앙값 — 대표가 병원 근처여도 시군 편차 반영(편향 방지)", () => {
    // 대표(병원 5km, 감점1)만 보면 안전해 보이나 시군엔 먼 곳(40km, 감점9)이 섞여 있다.
    const g = summarizeRegions([
      mockPlace(1, 90, { factors: [f("medical", 1, 5)], envType: "outdoor_general" }),
      mockPlace(1, 82, { factors: [f("medical", 9, 40)], envType: "outdoor_general" }),
    ]).find((r) => r.sigunguCode === 1)!;
    const med = g.factors.find((x) => x.key === "medical")!;
    expect(med.points).toBe(5); // 대표 1이 아니라 시군 중앙값 median([1,9])=5
    expect(g.medianScore).toBe(86); // 대표 90 − (5−1) 집계 차이
  });

  it("산사태는 시군 최악 노출지(프록시 최댓값) — 대표(일반)엔 없어도 산악지 위험 포함", () => {
    const g = summarizeRegions([
      mockPlace(1, 88, { factors: [f("heat", 12)], envType: "outdoor_general" }),
      mockPlace(1, 40, { factors: [f("landslide", 45)], envType: "outdoor_mountain" }),
    ]).find((r) => r.sigunguCode === 1)!;
    const ls = g.factors.find((x) => x.key === "landslide");
    expect(ls?.points).toBe(45); // 대표(일반, 산사태 없음) 아니라 시군 산악지 45
    expect(ls?.description).toContain("산사태 위험지역 포함");
    expect(g.medianScore).toBe(43); // 대표 88 − 시군 산사태 45
  });
});
