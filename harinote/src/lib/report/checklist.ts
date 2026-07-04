/**
 * 출발 전 체크 리포트 — 준비물 체크리스트 규칙 (제안서 기능 ⑤).
 *
 * 위험 입력값(RiskInput)·환경 유형·동행 프로필로 준비물 문구를 생성한다.
 * 임계값은 안전 점수 엔진과 동일한 공식 기준(src/lib/safety/weights.ts)을 재사용해
 * "감점된 요인 ↔ 준비물"이 항상 일치하도록 한다.
 */
import type { Profile, RiskInput } from "@/lib/safety/types";
import type { Place } from "@/lib/tour/types";
import { HEAT, MEDICAL, PM25, RAIN_WIND } from "@/lib/safety/weights";

/** 산불 준비 문구를 띄우는 최소 단계 (산림청 3단계 '높음'부터) */
const FIRE_CHECKLIST_LEVEL = 3;

export function buildChecklist(
  input: RiskInput,
  place: Pick<Place, "envType">,
  profile: Profile,
): string[] {
  const items: string[] = [];

  // 폭염 — 폭염주의보 기준(33℃) 이상
  if (input.tempC >= HEAT.ADVISORY_C) {
    items.push("생수·모자·자외선 차단제 챙기기");
    if (profile === "with_kids") {
      items.push("아이 컨디션(더위 먹음 신호) 자주 확인하기");
    }
  }

  // 강수 — 강수확률 60% 이상
  if (input.rainProbPct >= RAIN_WIND.PROB_MID_PCT) {
    items.push("우산·우비 준비하기");
    if (place.envType === "outdoor_water") {
      items.push("계곡 수위 변화 주의 — 상류 호우 시 즉시 대피");
    }
  }

  // 강풍 — 주의 풍속(9m/s) 이상 + 산악/해안
  if (
    input.windMs >= RAIN_WIND.WIND_CAUTION_MS &&
    (place.envType === "outdoor_mountain" || place.envType === "outdoor_coast")
  ) {
    items.push("바람막이 준비, 전망대·능선 구간 주의하기");
  }

  // 미세먼지 — PM2.5 '나쁨'(36㎍/㎥) 이상
  if (input.pm25 > PM25.MODERATE_MAX) {
    items.push("보건용 마스크(KF80 이상) 챙기기");
    if (profile === "with_kids") {
      items.push("아이 야외 활동 시간 줄이고 마스크 착용 챙기기");
    }
  }

  // 응급의료 — 최근접 응급의료기관 20km 이상
  if (input.emergencyRoomKm >= MEDICAL.MID_KM) {
    items.push("상비약 지참, 이동 경로의 병원 위치 확인하기");
    if (profile === "with_seniors") {
      items.push("부모님 평소 복용약 챙기기");
    }
  }

  // 산불위험 — 산림청 3단계(높음) 이상
  if (input.forestFireLevel >= FIRE_CHECKLIST_LEVEL) {
    items.push("산림 인접지 화기 사용 금지, 입산 통제 구간 확인하기");
  }

  // 항상 포함
  items.push("출발 전 기상특보 확인하기(기상청)");
  items.push("여행 일정 가족·지인과 공유하기");

  return items;
}
