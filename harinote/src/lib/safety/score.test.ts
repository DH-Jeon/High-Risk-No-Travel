/**
 * 안전 점수 엔진 테스트 — 쾌적층(TCI) − 안전층 모델.
 * SafetyScore = TCI(체감·강수·미먼·바람) − 안전(산불·산사태·의료) − 이동, 재난경보 override.
 */
import { describe, expect, it } from "vitest";
import { computeSafetyScore, OVERRIDE_CAP } from "@/lib/safety/score";
import { gradeForScore } from "@/lib/safety/weights";
import type {
  Profile,
  RiskBreakdown,
  RiskFactorKey,
  RiskInput,
} from "@/lib/safety/types";
import type { PlaceEnvType } from "@/lib/tour/types";

/** 이상적 봄날 기본 입력 (체감 21℃·무강수·청정·미풍·응급실 5km) */
const CLEAR: RiskInput = {
  tempC: 21,
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
  it("이상적 봄날은 90점 이상, grade low", () => {
    const b = run({});
    expect(b.score).toBeGreaterThanOrEqual(90);
    expect(b.grade).toBe("low");
  });

  it("체감온도/강수·바람/미세먼지/산불/응급의료 요인은 항상 포함", () => {
    const keys = run({}).factors.map((f) => f.key);
    for (const k of ["heat", "rain_wind", "pm", "forest_fire", "medical"]) {
      expect(keys).toContain(k);
    }
  });

  it("모든 요인 points는 0 이상의 정수", () => {
    const b = run(
      { tempC: 36, apparentTempC: 38, rainProbPct: 85, rainMm: 70, windMs: 15, pm25: 80, forestFireLevel: 3, emergencyRoomKm: 35, shelterKm: 8 },
      "outdoor_water",
      "with_kids",
    );
    for (const f of b.factors) {
      expect(Number.isInteger(f.points)).toBe(true);
      expect(f.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("체감온도(apparentTempC)가 있으면 그것으로 열쾌적 평가 (건구 tempC 대신)", () => {
    // 건구 30℃지만 체감 36℃ → 무더위로 큰 감점
    const dry = factor(run({ tempC: 30, apparentTempC: 30 }), "heat").points;
    const humid = factor(run({ tempC: 30, apparentTempC: 36 }), "heat").points;
    expect(humid).toBeGreaterThan(dry);
  });
});

describe("쾌적층(TCI) — 계절 패턴", () => {
  it("한여름 무더위(체감35)는 봄날보다 점수 크게 낮다", () => {
    const spring = run({ tempC: 21 }).score;
    const summer = run({ tempC: 35 }).score;
    expect(summer).toBeLessThan(spring - 20);
  });

  it("체감온도 오를수록 heat 감점 증가(26→31→35)", () => {
    const p26 = factor(run({ tempC: 26 }), "heat").points;
    const p31 = factor(run({ tempC: 31 }), "heat").points;
    const p35 = factor(run({ tempC: 35 }), "heat").points;
    expect(p31).toBeGreaterThan(p26);
    expect(p35).toBeGreaterThan(p31);
  });

  it("실내는 같은 무더위에 감점 작다(×0.3) → 점수 높다", () => {
    const outdoor = run({ tempC: 35 });
    const indoor = run({ tempC: 35 }, "indoor");
    expect(factor(indoor, "heat").points).toBeLessThan(factor(outdoor, "heat").points);
    expect(indoor.score).toBeGreaterThan(outdoor.score);
  });

  it("계곡(outdoor_water)은 비 올 때 강수·바람 감점 크다(강수 ×1.5)", () => {
    const general = factor(run({ rainMm: 20, rainProbPct: 80 }), "rain_wind").points;
    const water = factor(run({ rainMm: 20, rainProbPct: 80 }, "outdoor_water"), "rain_wind").points;
    expect(water).toBeGreaterThan(general);
  });

  it("미세먼지 매우나쁨은 pm 감점, 민감층(with_kids)은 더 크다", () => {
    const base = factor(run({ pm25: 120 }), "pm").points;
    const kids = factor(run({ pm25: 120 }, "outdoor_general", "with_kids"), "pm").points;
    expect(base).toBeGreaterThan(0);
    expect(kids).toBeGreaterThan(base);
  });

  it("비 오면 같은 조건보다 점수 하락", () => {
    const dry = run({ rainMm: 0 }).score;
    const wet = run({ rainMm: 20, rainProbPct: 80 }).score;
    expect(wet).toBeLessThan(dry);
  });
});

describe("안전층 — 산불·산사태·응급의료", () => {
  it("산불 1단계는 감점 0, 3단계는 감점 발생", () => {
    expect(factor(run({ forestFireLevel: 1 }), "forest_fire").points).toBe(0);
    expect(factor(run({ forestFireLevel: 3 }), "forest_fire").points).toBeGreaterThan(0);
  });

  it("산불 3단계 산악은 일반 야외보다 감점 크다(×1.3)", () => {
    const general = factor(run({ forestFireLevel: 3 }), "forest_fire").points;
    const mountain = factor(run({ forestFireLevel: 3 }, "outdoor_mountain"), "forest_fire").points;
    expect(mountain).toBeGreaterThan(general);
  });

  it("산사태: 비 안 오면 요인 없음, 공식 경보(2)는 요인 발생", () => {
    expect(run({ rainMm: 0 }, "outdoor_mountain").factors.some((f) => f.key === "landslide")).toBe(false);
    expect(run({ landslideLevel: 2 }, "outdoor_mountain").factors.some((f) => f.key === "landslide")).toBe(true);
  });

  it("응급의료 30km↑는 상한 10, with_seniors는 default보다 크다", () => {
    expect(factor(run({ emergencyRoomKm: 35 }), "medical").points).toBe(10);
    const base = factor(run({ emergencyRoomKm: 20 }), "medical").points;
    const seniors = factor(run({ emergencyRoomKm: 20 }, "outdoor_general", "with_seniors"), "medical").points;
    expect(seniors).toBeGreaterThan(base);
  });

  it("오지 응급의료(먼 병원)는 맑은 날에도 점수를 끌어내린다(취약성 상시)", () => {
    const near = run({ emergencyRoomKm: 5 }).score;
    const far = run({ emergencyRoomKm: 35 }).score;
    expect(far).toBeLessThan(near);
  });
});

describe("재난 경보 override — 총점 강제 하향", () => {
  it("산불 4단계(심각)는 다른 조건 무관하게 총점 ≤ OVERRIDE_CAP", () => {
    const b = run({ tempC: 21, forestFireLevel: 4 }, "outdoor_mountain");
    expect(b.score).toBeLessThanOrEqual(OVERRIDE_CAP);
    expect(b.grade).toBe("high");
  });

  it("산사태 경보(2)는 총점 ≤ OVERRIDE_CAP", () => {
    const b = run({ landslideLevel: 2 }, "outdoor_mountain");
    expect(b.score).toBeLessThanOrEqual(OVERRIDE_CAP);
  });

  it("호우로 산악 프록시 경보(2)면 override — 폭우 계곡은 방문 자제 수준", () => {
    const b = run({ rainMm: 90, rainProbPct: 90 }, "outdoor_mountain");
    expect(b.score).toBeLessThanOrEqual(OVERRIDE_CAP);
  });

  it("주의보급(산불 3·산사태 1)은 override 아님 — 감점만", () => {
    const b = run({ forestFireLevel: 3 });
    expect(b.score).toBeGreaterThan(OVERRIDE_CAP);
  });
});

describe("shelter / road — 선택 입력", () => {
  it("미제공 시 요인 없음", () => {
    const b = run({});
    expect(b.factors.some((f) => f.key === "shelter")).toBe(false);
    expect(b.factors.some((f) => f.key === "road")).toBe(false);
    expect(b.mobilityRisk).toBe(0);
  });

  it("roadRisk 0.8 + own_car는 default보다 큰 이동 감점", () => {
    const base = factor(run({ roadRisk: 0.8 }), "road").points;
    const car = factor(run({ roadRisk: 0.8 }, "outdoor_general", "own_car"), "road").points;
    expect(car).toBeGreaterThan(base);
  });
});

describe("점수 일관성 / 등급", () => {
  // override가 걸리지 않는 케이스들 (산불<4, 산사태<2)
  const cases: Array<[Partial<RiskInput>, PlaceEnvType, Profile]> = [
    [{}, "indoor", "default"],
    [{ tempC: 33, pm25: 50 }, "outdoor_general", "with_kids"],
    [{ rainMm: 20, rainProbPct: 85, windMs: 12 }, "outdoor_water", "default"],
    [{ forestFireLevel: 3, windMs: 10 }, "outdoor_mountain", "with_seniors"],
  ];

  it("override 없는 경우 score = 100 − 요인 감점 합, 소계 합 일치", () => {
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
      { tempC: 33, rainMm: 10, rainProbPct: 70, pm25: 50, forestFireLevel: 3, shelterKm: 4, roadRisk: 0.5 },
      "outdoor_mountain",
    );
    const sum = (keys: RiskFactorKey[]) =>
      b.factors.filter((f) => keys.includes(f.key)).reduce((s, f) => s + f.points, 0);
    expect(b.weatherRisk).toBe(sum(["heat", "rain_wind", "pm"]));
    expect(b.disasterRisk).toBe(sum(["forest_fire", "landslide", "shelter"]));
    expect(b.medicalRisk).toBe(sum(["medical"]));
    expect(b.mobilityRisk).toBe(sum(["road"]));
  });

  it("gradeForScore 경계: 70→low, 69→moderate, 40→moderate, 39→high", () => {
    expect(gradeForScore(70)).toBe("low");
    expect(gradeForScore(69)).toBe("moderate");
    expect(gradeForScore(40)).toBe("moderate");
    expect(gradeForScore(39)).toBe("high");
  });

  it("profile이 결과에 그대로 담긴다", () => {
    expect(run({}, "indoor", "with_kids").profile).toBe("with_kids");
    expect(run({}).profile).toBe("default");
  });
});
