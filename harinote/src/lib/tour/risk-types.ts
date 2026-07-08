/**
 * 데이터 기반 위험 유형 (사계절 7유형) — analysis/ 클러스터링 산출물.
 * 근거: 위험 민감도 프로파일 k=7 (여름·산불·겨울 축, bootstrap ARI 0.897) — analysis/SUMMARY.md
 * 목록 재생성: analysis/12_winter_scenario.py → src/data/risk-types.json
 *
 * "general"(근교 전천후, 283곳)은 기본값이라 배지를 달지 않는다 — 배지는 주의/특성 신호만.
 */
import riskTypes from "@/data/risk-types.json";

export type RiskTypeKey =
  | "general"
  | "indoor"
  | "alpine_cold"
  | "coast"
  | "water"
  | "mountain"
  | "remote_medical";

const RISK_TYPES = riskTypes as Record<string, RiskTypeKey>;

export interface RiskTypeMeta {
  emoji: string;
  label: string;
  /** 한 줄 주의·특성 설명 (상세 페이지 배지 title/툴팁) */
  caution: string;
  /** SafetyScoreBadge와 같은 pill 톤 규칙: bg-*-50 text-*-700 ring-*-200 */
  pill: string;
}

/** general 제외 — 배지를 다는 유형만 정의 */
export const RISK_TYPE_META: Record<Exclude<RiskTypeKey, "general">, RiskTypeMeta> = {
  alpine_cold: {
    emoji: "🏔️",
    label: "고산 한파형",
    caution: "표고가 높아 겨울철 기온이 크게 낮아요",
    pill: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  remote_medical: {
    emoji: "🏥",
    label: "응급의료 원거리",
    caution: "가까운 응급의료기관이 멀어요 — 부모님 동반 시 주의",
    pill: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  mountain: {
    emoji: "⛰️",
    label: "산악형",
    caution: "산불·강풍 위험이 가중되는 곳이에요",
    pill: "bg-orange-50 text-orange-700 ring-orange-200",
  },
  coast: {
    emoji: "🌊",
    label: "해안형",
    caution: "강풍 위험이 가중되는 곳이에요",
    pill: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  },
  water: {
    emoji: "💧",
    label: "계곡·수변형",
    caution: "호우 시 급류·수위 상승 위험이 커져요",
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  indoor: {
    emoji: "🏛️",
    label: "실내 전천후",
    caution: "날씨 영향이 적어 악천후 대체지로 좋아요",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

export function getRiskType(contentId: number): RiskTypeKey | undefined {
  return RISK_TYPES[String(contentId)];
}

/** 배지 대상 수 — 테스트용 */
export const RISK_TYPE_COUNT = Object.keys(RISK_TYPES).length;
