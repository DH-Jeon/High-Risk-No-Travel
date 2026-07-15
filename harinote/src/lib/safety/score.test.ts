/**
 * 안전 점수 엔진 테스트 — 공식 임계값 경계 중심.
 * 산식: SafetyScore = 100 - (WeatherRisk + DisasterRisk + MedicalRisk + MobilityRisk)
 */
import { describe, expect, it } from "vitest";
import { computeSafetyScore } from "@/lib/safety/score";
import { gradeForScore } from "@/lib/safety/weights";
import type {
  Profile,
  RiskBreakdown,
  RiskFactorKey,
  RiskInput,
} from "@/lib/safety/types";
import type { PlaceEnvType } from "@/lib/tour/types";

/** 쾌청한 날 기본 입력 (응급실 5km → medical 1점 외 감점 없음) */
const CLEAR: RiskInput = {
  tempC: 26,
  rainProbPct: 10,
  windMs: 2,
  pm25: 10,
  forestFireLevel: 1,
  emergencyRoomKm: 5,
};

function run(
  input: Partial<RiskInput>,
  envType: PlaceEnvType = "outdoor_general",
  profile: Profile = "default",
): RiskBreakdown {
  return computeSafetyScore({ ...CLEAR, ...input }, { envType }, profile);
}

function factor(b: RiskBreakdown, key: RiskFactorKey) {
  const f = b.factors.find((f) => f.key === key);
  if (!f) throw new Error(`factor ${key} 없음`);
  return f;
}

describe("computeSafetyScore — 기본/구조", () => {
  it("쾌청한 날 실내 시설은 90점 이상, grade low", () => {
    const b = run({}, "indoor");
    expect(b.score).toBeGreaterThanOrEqual(90);
    expect(b.grade).toBe("low");
  });

  it("쾌청한 날 일반 야외도 90점 이상", () => {
    const b = run({});
    expect(b.score).toBeGreaterThanOrEqual(90);
  });

  it("감점 0이어도 heat/rain_wind/pm/forest_fire/medical 요인은 항상 포함", () => {
    const keys = run({}).factors.map((f) => f.key);
    for (const k of ["heat", "rain_wind", "pm", "forest_fire", "medical"]) {
      expect(keys).toContain(k);
    }
  });

  it("모든 요인 points는 0 이상의 정수이고 maxPoints 이하", () => {
    const b = run(
      { tempC: 36, rainProbPct: 85, rainMm: 70, windMs: 15, pm25: 80, forestFireLevel: 4, emergencyRoomKm: 35, shelterKm: 8 },
      "outdoor_water",
      "with_kids",
    );
    for (const f of b.factors) {
      expect(Number.isInteger(f.points)).toBe(true);
      expect(f.points).toBeGreaterThanOrEqual(0);
      expect(f.points).toBeLessThanOrEqual(f.maxPoints);
    }
  });
});

describe("heat — 기상청 폭염주의보 33℃ / 폭염경보 35℃", () => {
  it("32.9℃(주의보 미만)는 저감점, 33.0℃보다 확실히 낮다", () => {
    const below = factor(run({ tempC: 32.9 }), "heat");
    const at = factor(run({ tempC: 33.0 }), "heat");
    expect(below.points).toBeLessThan(at.points);
    expect(below.level).toBe("low");
  });

  it("33.0℃ 정확 경계 — 주의보 구간 진입(중간 감점)", () => {
    const f = factor(run({ tempC: 33.0 }), "heat");
    expect(f.points).toBeGreaterThanOrEqual(10);
    expect(f.level).toBe("moderate");
  });

  it("35.0℃ 정확 경계 — 경보 구간, 상한(25)에 근접", () => {
    const f = factor(run({ tempC: 35.0 }), "heat");
    expect(f.points).toBeGreaterThanOrEqual(22);
    expect(f.level).toBe("high");
  });

  it("36℃는 35℃보다 감점이 크고 상한 이하", () => {
    const p35 = factor(run({ tempC: 35 }), "heat").points;
    const p36 = factor(run({ tempC: 36 }), "heat").points;
    expect(p36).toBeGreaterThan(p35);
    expect(p36).toBeLessThanOrEqual(25);
  });

  it("39℃ 극단값은 상한 25에서 clamp", () => {
    expect(factor(run({ tempC: 39 }), "heat").points).toBe(25);
  });

  it("같은 폭염 35℃라도 실내(indoor)는 감점이 대폭 감소(×0.3)", () => {
    const outdoor = factor(run({ tempC: 35 }), "heat").points;
    const indoor = factor(run({ tempC: 35 }, "indoor"), "heat").points;
    expect(indoor).toBeLessThan(outdoor * 0.5);
    expect(indoor).toBeGreaterThan(0);
  });

  it("with_kids/with_seniors는 폭염 임계값 2℃ 하향 — 31℃부터 주의보 구간 진입", () => {
    // 기상청 폭염 영향예보: 취약계층은 31℃(일반 주의보 33℃보다 낮음)부터 위험 단계
    const base = factor(run({ tempC: 31 }), "heat").points; // (31-28)/5×8 = 4.8 → 5
    const kids = factor(run({ tempC: 31 }, "outdoor_general", "with_kids"), "heat").points; // 33℃ 지점 평가 = 12
    const seniors = factor(run({ tempC: 31 }, "outdoor_general", "with_seniors"), "heat").points;
    expect(base).toBe(5);
    expect(kids).toBe(12);
    expect(seniors).toBe(12);
  });

  it("민감층은 온화한 날(27℃)에도 소량 감점 — 프로필 간 차이가 항상 보인다", () => {
    const base = factor(run({ tempC: 27 }), "heat").points;
    const kids = factor(run({ tempC: 27 }, "outdoor_general", "with_kids"), "heat").points;
    expect(base).toBe(0);
    expect(kids).toBeGreaterThan(0);
  });

  it("아이·부모님 동시(with_kids_seniors): 폭염 하향 + 미먼 민감 + 의료 ×1.5 모두 적용", () => {
    const b = run(
      { tempC: 31, pm25: 40, emergencyRoomKm: 30 },
      "outdoor_general",
      "with_kids_seniors",
    );
    // 폭염: 31℃가 하향으로 주의보 구간(12점) — 아이·부모님 단독과 동일
    expect(factor(b, "heat").points).toBe(12);
    // 미세먼지: 민감군 곡선(나쁨 40 → 12점, 아이 효과)
    expect(factor(b, "pm").points).toBe(12);
    // 응급의료: ×1.5 (부모님 효과) — 30km는 상한 10
    expect(factor(b, "medical").points).toBe(10);
  });

  it("민감층 폭염도 상한 25에서 clamp", () => {
    expect(factor(run({ tempC: 38 }, "outdoor_general", "with_kids"), "heat").points).toBe(25);
  });

  it("heat description은 값과 공식 기준을 함께 표기", () => {
    const f = factor(run({ tempC: 34.2 }), "heat");
    expect(f.description).toContain("34.2℃");
    expect(f.description).toContain("폭염주의보 기준(33℃)");
  });
});

describe("rain_wind — 강수확률 30/60/80% 구간 + 강풍주의보 14m/s", () => {
  it("강수확률 29% vs 30% 경계", () => {
    const p29 = factor(run({ rainProbPct: 29 }), "rain_wind").points;
    const p30 = factor(run({ rainProbPct: 30 }), "rain_wind").points;
    expect(p29).toBe(0);
    expect(p30).toBeGreaterThan(0);
  });

  it("강수확률 59% vs 60% 경계", () => {
    const p59 = factor(run({ rainProbPct: 59 }), "rain_wind").points;
    const p60 = factor(run({ rainProbPct: 60 }), "rain_wind").points;
    expect(p60).toBeGreaterThan(p59);
  });

  it("풍속 13.9 vs 14.0m/s(강풍주의보) 경계", () => {
    const below = factor(run({ windMs: 13.9 }), "rain_wind").points;
    const at = factor(run({ windMs: 14.0 }), "rain_wind").points;
    expect(at).toBeGreaterThan(below);
  });

  it("강수확률 80% — 계곡(outdoor_water)이 일반 야외보다 감점 크고 점수 낮다(강수 ×1.5)", () => {
    const general = run({ rainProbPct: 80 });
    const water = run({ rainProbPct: 80 }, "outdoor_water");
    expect(factor(water, "rain_wind").points).toBeGreaterThan(
      factor(general, "rain_wind").points,
    );
    expect(water.score).toBeLessThan(general.score);
  });

  it("해안(outdoor_coast)은 강풍 감점 ×1.5", () => {
    const general = factor(run({ windMs: 14 }), "rain_wind").points;
    const coast = factor(run({ windMs: 14 }, "outdoor_coast"), "rain_wind").points;
    expect(coast).toBe(Math.round(general * 1.5));
  });

  it("가중 적용 후에도 상한 20에서 clamp", () => {
    const f = factor(
      run({ rainProbPct: 90, rainMm: 70, windMs: 15 }, "outdoor_water"),
      "rain_wind",
    );
    expect(f.points).toBe(20);
    expect(f.maxPoints).toBe(20);
  });
});

describe("pm — 환경부 PM2.5 등급(좋음 ≤15 / 보통 ≤35 / 나쁨 ≤75 / 매우나쁨 76+)", () => {
  it("15 이하 '좋음'은 감점 0", () => {
    expect(factor(run({ pm25: 15 }), "pm").points).toBe(0);
  });

  it("75('나쁨') vs 76('매우나쁨') 경계 — 76은 상한 15", () => {
    const p75 = factor(run({ pm25: 75 }), "pm").points;
    const p76 = factor(run({ pm25: 76 }), "pm").points;
    expect(p76).toBeGreaterThan(p75);
    expect(p76).toBe(15);
  });

  it("with_kids는 민감군 곡선(AQI USG 구조) — 보통·나쁨 구간에서 이른 감점", () => {
    // 보통(30㎍/㎥): 일반 3 → 민감군 5 / 나쁨(40): 일반 8 → 민감군 12
    expect(factor(run({ pm25: 30 }), "pm").points).toBe(3);
    expect(factor(run({ pm25: 30 }, "outdoor_general", "with_kids"), "pm").points).toBe(5);
    expect(factor(run({ pm25: 40 }), "pm").points).toBe(8);
    expect(factor(run({ pm25: 40 }, "outdoor_general", "with_kids"), "pm").points).toBe(12);
    // 좋음(≤15)은 민감군도 0 — 불필요한 불안 조성 금지
    expect(factor(run({ pm25: 15 }, "outdoor_general", "with_kids"), "pm").points).toBe(0);
  });

  it("매우나쁨 + with_kids여도 상한 15에서 clamp", () => {
    const f = factor(run({ pm25: 76 }, "outdoor_general", "with_kids"), "pm");
    expect(f.points).toBe(15);
  });

  it("실내는 pm 감점 ×0.3", () => {
    const outdoor = factor(run({ pm25: 76 }), "pm").points;
    const indoor = factor(run({ pm25: 76 }, "indoor"), "pm").points;
    expect(indoor).toBe(Math.round(outdoor * 0.3));
  });

  it("pm 76 description은 '매우나쁨' 등급을 언급", () => {
    expect(factor(run({ pm25: 76 }), "pm").description).toContain("매우나쁨");
  });
});

describe("forest_fire — 산림청 산불위험 4단계", () => {
  it("1단계(낮음)는 감점 0", () => {
    expect(factor(run({ forestFireLevel: 1 }), "forest_fire").points).toBe(0);
  });

  it("4단계(심각) 산악은 큰 감점 — 상한 20에서 clamp(×1.3)", () => {
    const f = factor(
      run({ forestFireLevel: 4 }, "outdoor_mountain"),
      "forest_fire",
    );
    expect(f.points).toBe(20);
    expect(f.level).toBe("high");
  });

  it("3단계 산악은 일반 야외보다 감점 크다(×1.3)", () => {
    const general = factor(run({ forestFireLevel: 3 }), "forest_fire").points;
    const mountain = factor(
      run({ forestFireLevel: 3 }, "outdoor_mountain"),
      "forest_fire",
    ).points;
    expect(mountain).toBe(Math.round(general * 1.3));
  });
});

describe("medical — 응급의료 골든타임 거리(10/20/30km)", () => {
  it("30km 이상은 상한 10", () => {
    expect(factor(run({ emergencyRoomKm: 35 }), "medical").points).toBe(10);
  });

  it("응급실 35km + with_seniors — ×1.5여도 상한 10에서 clamp", () => {
    const f = factor(
      run({ emergencyRoomKm: 35 }, "outdoor_general", "with_seniors"),
      "medical",
    );
    expect(f.points).toBe(10);
  });

  it("20km + with_seniors는 default보다 감점 크다(×1.5)", () => {
    const base = factor(run({ emergencyRoomKm: 20 }), "medical").points;
    const seniors = factor(
      run({ emergencyRoomKm: 20 }, "outdoor_general", "with_seniors"),
      "medical",
    ).points;
    expect(seniors).toBeGreaterThan(base);
  });

  it("10km 이내는 소량 감점(2점 이하)", () => {
    expect(factor(run({ emergencyRoomKm: 9 }), "medical").points).toBeLessThanOrEqual(2);
  });
});

describe("shelter / road — 선택 입력", () => {
  it("shelterKm 미제공 시 shelter 요인 없음(불이익 금지)", () => {
    const b = run({});
    expect(b.factors.some((f) => f.key === "shelter")).toBe(false);
  });

  it("shelterKm 8km(원거리)는 상한 10 감점", () => {
    expect(factor(run({ shelterKm: 8 }), "shelter").points).toBe(10);
  });

  it("shelterKm 0.5km(인접)는 감점 0", () => {
    expect(factor(run({ shelterKm: 0.5 }), "shelter").points).toBe(0);
  });

  it("roadRisk 미제공 시 mobilityRisk 0, road 요인 없음", () => {
    const b = run({});
    expect(b.mobilityRisk).toBe(0);
    expect(b.factors.some((f) => f.key === "road")).toBe(false);
  });

  it("roadRisk 0.8 + own_car는 ×1.5, 상한 10에서 clamp", () => {
    const base = factor(run({ roadRisk: 0.8 }), "road").points;
    const car = factor(run({ roadRisk: 0.8 }, "outdoor_general", "own_car"), "road").points;
    expect(base).toBe(8);
    expect(car).toBe(10);
  });
});

describe("점수 일관성 / 등급", () => {
  const cases: Array<[Partial<RiskInput>, PlaceEnvType, Profile]> = [
    [{}, "indoor", "default"],
    [{ tempC: 35, pm25: 50 }, "outdoor_general", "with_kids"],
    [{ rainProbPct: 85, rainMm: 60, windMs: 12 }, "outdoor_water", "default"],
    [{ forestFireLevel: 4, windMs: 10 }, "outdoor_mountain", "with_seniors"],
    [{ tempC: 39, rainProbPct: 95, rainMm: 80, windMs: 16, pm25: 90, forestFireLevel: 4, emergencyRoomKm: 40, shelterKm: 8, roadRisk: 1 }, "outdoor_water", "own_car"],
  ];

  it("score = 100 - (요인 감점 합), 0~100 clamp, 소계 합 일치", () => {
    for (const [input, env, profile] of cases) {
      const b = run(input, env, profile);
      const total = b.factors.reduce((s, f) => s + f.points, 0);
      expect(b.score).toBe(Math.max(0, Math.min(100, 100 - total)));
      expect(
        b.weatherRisk + b.disasterRisk + b.medicalRisk + b.mobilityRisk,
      ).toBe(total);
      expect(b.score).toBeGreaterThanOrEqual(0);
      expect(b.score).toBeLessThanOrEqual(100);
    }
  });

  it("카테고리 소계 = 해당 요인 points 합", () => {
    const b = run(
      { tempC: 35, rainProbPct: 70, pm25: 50, forestFireLevel: 3, shelterKm: 4, roadRisk: 0.5 },
      "outdoor_mountain",
    );
    const sum = (keys: RiskFactorKey[]) =>
      b.factors.filter((f) => keys.includes(f.key)).reduce((s, f) => s + f.points, 0);
    expect(b.weatherRisk).toBe(sum(["heat", "rain_wind", "pm"]));
    expect(b.disasterRisk).toBe(sum(["forest_fire", "shelter"]));
    expect(b.medicalRisk).toBe(sum(["medical"]));
    expect(b.mobilityRisk).toBe(sum(["road"]));
  });

  it("모든 값 최악이면 score 0 근처, grade high", () => {
    const b = run(
      { tempC: 39, rainProbPct: 95, rainMm: 80, windMs: 16, pm25: 90, forestFireLevel: 4, emergencyRoomKm: 40, shelterKm: 8 },
      "outdoor_general",
    );
    expect(b.score).toBeLessThanOrEqual(5);
    expect(b.grade).toBe("high");
  });

  it("gradeForScore 경계: 70→low, 69→moderate, 40→moderate, 39→high", () => {
    expect(gradeForScore(100)).toBe("low");
    expect(gradeForScore(70)).toBe("low");
    expect(gradeForScore(69)).toBe("moderate");
    expect(gradeForScore(40)).toBe("moderate");
    expect(gradeForScore(39)).toBe("high");
    expect(gradeForScore(0)).toBe("high");
  });

  it("profile이 결과에 그대로 담긴다", () => {
    expect(run({}, "indoor", "with_kids").profile).toBe("with_kids");
    expect(run({}).profile).toBe("default");
  });
});
