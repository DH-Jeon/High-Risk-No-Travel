/**
 * 안전 점수 엔진 — 공공기관 공식 임계값 기반 감점 합산.
 *
 * SafetyScore = 100 - (WeatherRisk + DisasterRisk + MedicalRisk + MobilityRisk)
 * - 기본 감점(weights.ts) × 환경유형 가중 × 프로필 가중 → 요인별 상한 clamp → 반올림
 * - 임계값 출처: 기상청(폭염·호우·강풍특보), 환경부(PM2.5 등급), 산림청(산불위험 4단계),
 *   보건복지부(응급의료 취약지), 행정안전부(대피시설 접근성) — 상세는 weights.ts 주석 참조
 */
import type { Place } from "@/lib/tour/types";
import type {
  Profile,
  RiskBreakdown,
  RiskFactor,
  RiskInput,
} from "@/lib/safety/types";
import {
  ENV_WEIGHT,
  FOREST_FIRE,
  HEAT,
  MEDICAL,
  PM25,
  PROFILE_WEIGHT,
  RAIN_WIND,
  ROAD,
  SHELTER,
  forestFirePoints,
  gradeForScore,
  heatPoints,
  levelForPoints,
  medicalPoints,
  pmGradeLabel,
  pmPoints,
  rainPoints,
  roadPoints,
  shelterPoints,
  windPoints,
} from "@/lib/safety/weights";

/** 가중 적용 후 상한 clamp + 정수 반올림 */
function finalize(basePoints: number, weight: number, maxPoints: number): number {
  return Math.round(Math.min(maxPoints, Math.max(0, basePoints * weight)));
}

/** 임계값 대비 상태 문구: 초과/도달/미만 */
function vsThreshold(value: number, threshold: number): string {
  if (value > threshold) return "초과";
  if (value === threshold) return "도달";
  return "미만";
}

export function computeSafetyScore(
  input: RiskInput,
  place: Pick<Place, "envType">,
  profile: Profile = "default",
): RiskBreakdown {
  const env = ENV_WEIGHT[place.envType];
  const prof = PROFILE_WEIGHT[profile];
  const factors: RiskFactor[] = [];

  // ── 폭염 (Weather) ──
  const heat = finalize(heatPoints(input.tempC), env.heat * prof.heat, HEAT.MAX_POINTS);
  factors.push({
    key: "heat",
    label: "폭염",
    value: input.tempC,
    unit: "℃",
    threshold: HEAT.ADVISORY_C,
    points: heat,
    maxPoints: HEAT.MAX_POINTS,
    level: levelForPoints(heat, HEAT.MAX_POINTS),
    description:
      input.tempC >= HEAT.WARNING_C
        ? `최고기온 ${input.tempC}℃ — 폭염경보 기준(${HEAT.WARNING_C}℃) ${vsThreshold(input.tempC, HEAT.WARNING_C)}`
        : input.tempC >= HEAT.ADVISORY_C
          ? `최고기온 ${input.tempC}℃ — 폭염주의보 기준(${HEAT.ADVISORY_C}℃) ${vsThreshold(input.tempC, HEAT.ADVISORY_C)}`
          : `최고기온 ${input.tempC}℃ — 폭염주의보 기준(${HEAT.ADVISORY_C}℃) 미만`,
  });

  // ── 강수·강풍 (Weather) — 강수/강풍에 서로 다른 환경 가중 적용 후 합산 clamp ──
  const rainWindRaw =
    rainPoints(input.rainProbPct, input.rainMm) * env.rain +
    windPoints(input.windMs) * env.wind;
  const rainWind = finalize(rainWindRaw, 1, RAIN_WIND.MAX_POINTS);
  const windDesc =
    input.windMs >= RAIN_WIND.WIND_ADVISORY_MS
      ? `풍속 ${input.windMs}m/s — 강풍주의보 기준(${RAIN_WIND.WIND_ADVISORY_MS}m/s) 이상`
      : `풍속 ${input.windMs}m/s`;
  factors.push({
    key: "rain_wind",
    label: "강수·강풍",
    value: input.rainProbPct,
    unit: "%",
    threshold: RAIN_WIND.PROB_MID_PCT,
    points: rainWind,
    maxPoints: RAIN_WIND.MAX_POINTS,
    level: levelForPoints(rainWind, RAIN_WIND.MAX_POINTS),
    description: `강수확률 ${input.rainProbPct}%${
      input.rainMm !== undefined && input.rainMm >= RAIN_WIND.MODERATE_RAIN_MM
        ? ` · 예상 강수량 ${input.rainMm}mm`
        : ""
    } · ${windDesc}`,
  });

  // ── 미세먼지 (Weather) ──
  const pm = finalize(pmPoints(input.pm25), env.pm * prof.pm, PM25.MAX_POINTS);
  factors.push({
    key: "pm",
    label: "미세먼지",
    value: input.pm25,
    unit: "㎍/㎥",
    threshold: PM25.MODERATE_MAX,
    points: pm,
    maxPoints: PM25.MAX_POINTS,
    level: levelForPoints(pm, PM25.MAX_POINTS),
    description: `PM2.5 ${input.pm25}㎍/㎥ — 환경부 '${pmGradeLabel(input.pm25)}' 등급`,
  });

  // ── 산불·산사태 (Disaster) ──
  const fire = finalize(
    forestFirePoints(input.forestFireLevel),
    env.fire,
    FOREST_FIRE.MAX_POINTS,
  );
  factors.push({
    key: "forest_fire",
    label: "산불·산사태",
    value: input.forestFireLevel,
    unit: "단계",
    threshold: 3,
    points: fire,
    maxPoints: FOREST_FIRE.MAX_POINTS,
    level: levelForPoints(fire, FOREST_FIRE.MAX_POINTS),
    description: `산불위험 ${input.forestFireLevel}단계 — 산림청 '${FOREST_FIRE.LEVEL_LABEL[input.forestFireLevel]}'`,
  });

  // ── 응급의료 접근성 (Medical) ──
  const medical = finalize(
    medicalPoints(input.emergencyRoomKm),
    prof.medical,
    MEDICAL.MAX_POINTS,
  );
  factors.push({
    key: "medical",
    label: "응급의료",
    value: input.emergencyRoomKm,
    unit: "km",
    threshold: MEDICAL.NEAR_KM,
    points: medical,
    maxPoints: MEDICAL.MAX_POINTS,
    level: levelForPoints(medical, MEDICAL.MAX_POINTS),
    description: `최근접 응급의료기관 ${input.emergencyRoomKm}km — 골든타임 권장(${MEDICAL.NEAR_KM}km) ${
      input.emergencyRoomKm > MEDICAL.NEAR_KM ? "초과" : "이내"
    }`,
  });

  // ── 대피소 접근성 (Disaster) — 입력 없으면 요인 제외(불이익 금지) ──
  let shelter = 0;
  if (input.shelterKm !== undefined) {
    shelter = finalize(shelterPoints(input.shelterKm), 1, SHELTER.MAX_POINTS);
    factors.push({
      key: "shelter",
      label: "대피소",
      value: input.shelterKm,
      unit: "km",
      threshold: SHELTER.WALKABLE_KM,
      points: shelter,
      maxPoints: SHELTER.MAX_POINTS,
      level: levelForPoints(shelter, SHELTER.MAX_POINTS),
      description: `최근접 대피소 ${input.shelterKm}km — 도보 접근권(${SHELTER.WALKABLE_KM}km) ${
        input.shelterKm > SHELTER.WALKABLE_KM ? "초과" : "이내"
      }`,
    });
  }

  // ── 이동 위험 (Mobility, 2주차) — 입력 없으면 0점 ──
  let road = 0;
  if (input.roadRisk !== undefined) {
    road = finalize(roadPoints(input.roadRisk), prof.road, ROAD.MAX_POINTS);
    factors.push({
      key: "road",
      label: "이동 위험",
      value: input.roadRisk,
      unit: "지수",
      threshold: 0.5,
      points: road,
      maxPoints: ROAD.MAX_POINTS,
      level: levelForPoints(road, ROAD.MAX_POINTS),
      description: `경로 위험 지수 ${input.roadRisk} (도로교통공단, 0~1)`,
    });
  }

  // ── 합산: 소계·점수 일관성 보장 (score = 100 - 감점 합, 0~100 clamp) ──
  const weatherRisk = heat + rainWind + pm;
  const disasterRisk = fire + shelter;
  const medicalRisk = medical;
  const mobilityRisk = road;
  const total = weatherRisk + disasterRisk + medicalRisk + mobilityRisk;
  const score = Math.max(0, Math.min(100, 100 - total));

  return {
    score,
    grade: gradeForScore(score),
    profile,
    factors,
    weatherRisk,
    disasterRisk,
    medicalRisk,
    mobilityRisk,
  };
}
