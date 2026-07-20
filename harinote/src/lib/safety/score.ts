/**
 * 안전 점수 엔진 — 쾌적층(관광기후지수 TCI) − 안전층(재난·의료 취약성).
 *
 * SafetyScore = TCI(쾌적) − 안전 감점(산불·산사태·응급의료) − 이동
 * - 쾌적층: 관광기후지수(K-TCI/KTCI) — 체감온도·강수·미세먼지·바람. envType(실내 할인·
 *   계곡 강수 가중)·프로필(민감층)로 변조. 근거=tci.ts, analysis/23.
 * - 안전층: 산불·산사태(산림청 단계) + 응급의료 접근성(취약성). FEMA/지역안전지수 구조.
 * - override: 재난 경보급(산불 4단계·산사태 경보) → 총점을 OVERRIDE_CAP 이하로 강제.
 *   근거=기상청 관광기후지수 '특보발령주의' 등급 + 특보 2단계(경보=이동 자제).
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
  LANDSLIDE,
  MEDICAL,
  PROFILE_WEIGHT,
  ROAD,
  SHELTER,
  forestFirePoints,
  gradeForScore,
  landslidePoints,
  landslideProxyLevel,
  normalizeForestFireLevel,
  levelForPoints,
  medicalPoints,
  pmGradeLabel,
  roadPoints,
  shelterPoints,
} from "@/lib/safety/weights";
import { computeTciBreakdown } from "@/lib/safety/tci";

/** 재난 경보급이면 총점을 이 값 이하로 강제 (기상청 '특보발령주의' 밴드) */
export const OVERRIDE_CAP = 20;

/** 쾌적층 요인 표시용 명목 상한 (레벨 색상 계산용, TCI 가중 기반) */
const WEATHER_MAX = { thermal: 40, rain: 27, pm: 24, wind: 10, sun: 9 } as const;

export function computeSafetyScore(
  input: RiskInput,
  place: Pick<Place, "envType">,
  profile: Profile = "default",
): RiskBreakdown {
  const env = ENV_WEIGHT[place.envType];
  const prof = PROFILE_WEIGHT[profile];
  const factors: RiskFactor[] = [];

  // ── 쾌적층: 관광기후지수(TCI) ──
  // 폭염특보 기준이 "일 최고 체감온도"이므로 체감온도(apparentTempC) 우선, 없으면 건구온도.
  // 민감층은 체감온도를 상향 반영(같은 더위도 더 위험) → thermal 입력 보정.
  const feelsBase = input.apparentTempC ?? input.tempC;
  const feelsEff = feelsBase + prof.heatShiftC;
  const tb = computeTciBreakdown({
    feelsC: feelsEff,
    rainMmDaily: input.rainMm,
    rainProbPct: input.rainProbPct,
    windMs: input.windMs,
    pm25: input.pm25,
    sunHours: input.sunHours, // 하늘상태(SKY) 환산 — 없으면 TCI가 4축 재정규화
  });

  // envType·프로필로 변조 (실내 할인·계곡 강수 가중·미먼 민감군)
  const thermalPts = Math.round(tb.deductions.thermal * env.heat);
  // 호우 severity — 쾌적(TCI)은 5mm에서 포화하지만, 호우주의보(60mm)·경보(90mm)는
  // 침수·급류 위험이라 추가 감점(기상청 호우 특보 기준). 지형(env.rain)에 비례.
  const heavyRain =
    input.rainMm === undefined
      ? 0
      : input.rainMm >= 90
        ? 16
        : input.rainMm >= 60
          ? 11
          : input.rainMm >= 30
            ? 6
            : 0;
  const rainPts = Math.round((tb.deductions.rain + heavyRain) * env.rain);
  const windPts = Math.round(tb.deductions.wind * env.wind);
  const pmPts = Math.round(tb.deductions.pm * env.pm * (prof.pmSensitive ? 1.4 : 1));
  // 강수·바람 합 상한 (원래 엔진의 강수·강풍 상한 복원) — 날씨 하나가 점수를 통째로
  // 무너뜨리지 않게 바운드. 진짜 "가지마"는 재난경보(산사태·산불) override가 담당.
  const RAIN_WIND_MAX = 40;
  const rainWindPts = Math.min(RAIN_WIND_MAX, rainPts + windPts);
  // 일조(하늘상태 SKY 환산) — 데이터 있을 때만 요인 추가. 야외 심미(실내 할인 env.heat).
  const sunPts = Math.round(tb.deductions.sun * env.heat);

  const thermalNote =
    feelsBase >= 33 ? "무더위" : feelsBase <= 4 ? "추위" : feelsBase >= 28 ? "더움" : "쾌적";
  const thermalLabel =
    input.apparentTempC !== undefined
      ? `체감 ${input.apparentTempC}℃(기온 ${input.tempC}℃)`
      : `체감온도 ${input.tempC}℃`;
  factors.push({
    key: "heat",
    label: "체감온도",
    value: feelsBase,
    unit: "℃",
    threshold: 33,
    points: thermalPts,
    maxPoints: WEATHER_MAX.thermal,
    level: levelForPoints(thermalPts, WEATHER_MAX.thermal),
    description: `${thermalLabel} — ${thermalNote}${prof.heatShiftC > 0 ? " · 동반 민감 기준" : ""} (관광기후지수 열쾌적)`,
  });
  factors.push({
    key: "rain_wind",
    label: "강수·바람",
    value: input.rainProbPct,
    unit: "%",
    threshold: 60,
    points: rainWindPts,
    maxPoints: RAIN_WIND_MAX,
    level: levelForPoints(rainWindPts, RAIN_WIND_MAX),
    description: `강수확률 ${input.rainProbPct}%${
      input.rainMm !== undefined && input.rainMm >= 3 ? ` · ${input.rainMm}mm` : ""
    } · 풍속 ${input.windMs}m/s (관광기후지수)`,
  });
  factors.push({
    key: "pm",
    label: "미세먼지",
    value: input.pm25,
    unit: "㎍/㎥",
    threshold: 35,
    points: pmPts,
    maxPoints: WEATHER_MAX.pm,
    level: levelForPoints(pmPts, WEATHER_MAX.pm),
    description: `PM2.5 ${input.pm25}㎍/㎥ — 환경부 '${pmGradeLabel(input.pm25)}' 등급${prof.pmSensitive ? " · 민감군 기준" : ""}`,
  });

  // 일조 요인 — SKY 데이터 있을 때만 표시(없으면 TCI 4축 재정규화라 감점 0)
  if (input.sunHours !== undefined) {
    factors.push({
      key: "sun",
      label: "일조",
      value: input.sunHours,
      unit: "h",
      threshold: 5,
      points: sunPts,
      maxPoints: WEATHER_MAX.sun,
      level: levelForPoints(sunPts, WEATHER_MAX.sun),
      description: `낮 하늘상태 환산 일조 ${input.sunHours}시간 — ${
        input.sunHours >= 8 ? "맑음" : input.sunHours >= 4 ? "구름많음" : "흐림"
      } (관광기후지수)`,
    });
  }

  const weatherRisk = thermalPts + rainWindPts + pmPts + sunPts;

  // ── 안전층: 산불 (산림청 단계) ──
  const fireLevel = normalizeForestFireLevel(input.forestFireLevel);
  const fire = Math.round(
    Math.min(FOREST_FIRE.MAX_POINTS, forestFirePoints(fireLevel) * env.fire),
  );
  factors.push({
    key: "forest_fire",
    label: "산불",
    value: fireLevel,
    unit: "단계",
    threshold: 3,
    points: fire,
    maxPoints: FOREST_FIRE.MAX_POINTS,
    level: levelForPoints(fire, FOREST_FIRE.MAX_POINTS),
    description: `산불위험 ${fireLevel}단계 — 산림청 '${FOREST_FIRE.LEVEL_LABEL[fireLevel]}'`,
  });

  // ── 안전층: 산사태 (강우×지형 프록시, 공식 발령 상향 override) ──
  const proxyLevel = landslideProxyLevel(input.rainMm, place.envType);
  const landslideLevel = Math.max(proxyLevel, input.landslideLevel ?? 0) as 0 | 1 | 2;
  let landslide = 0;
  if (landslideLevel > 0) {
    landslide = Math.round(Math.min(LANDSLIDE.MAX_POINTS, landslidePoints(landslideLevel)));
    const official = (input.landslideLevel ?? 0) >= landslideLevel;
    factors.push({
      key: "landslide",
      label: "산사태",
      value: landslideLevel,
      unit: "단계",
      threshold: 1,
      points: landslide,
      maxPoints: LANDSLIDE.MAX_POINTS,
      level: levelForPoints(landslide, LANDSLIDE.MAX_POINTS),
      description: official
        ? `산사태 ${LANDSLIDE.LEVEL_LABEL[landslideLevel]} — 산림청 예보발령`
        : `산사태 위험 ${LANDSLIDE.LEVEL_LABEL[landslideLevel]} — 예보 강수량·지형 기반 추정`,
    });
  }

  // ── 안전층: 응급의료 접근성 (취약성) ──
  const medical = Math.round(
    Math.min(MEDICAL.MAX_POINTS, medicalPoints(input.emergencyRoomKm) * prof.medical),
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

  // ── 대피소 (선택 입력) ──
  let shelter = 0;
  if (input.shelterKm !== undefined) {
    shelter = Math.round(Math.min(SHELTER.MAX_POINTS, shelterPoints(input.shelterKm)));
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

  // ── 이동 위험 (선택 입력) ──
  let road = 0;
  if (input.roadRisk !== undefined) {
    road = Math.round(Math.min(ROAD.MAX_POINTS, roadPoints(input.roadRisk) * prof.road));
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

  // ── 합산: score = 100 − (쾌적 + 안전 + 이동) ──
  const disasterRisk = fire + landslide + shelter;
  const medicalRisk = medical;
  const mobilityRisk = road;
  const total = weatherRisk + disasterRisk + medicalRisk + mobilityRisk;
  let score = Math.max(0, Math.min(100, 100 - total));

  // ── override: 재난 경보급(산불 4단계·산사태 경보 2)이면 총점 강제 하향 ──
  const alert = fireLevel >= 4 || landslideLevel >= 2;
  if (alert) score = Math.min(score, OVERRIDE_CAP);

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
