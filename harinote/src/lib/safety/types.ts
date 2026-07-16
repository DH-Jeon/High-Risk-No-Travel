/**
 * [계약 파일] 안전 점수 모델 타입 정의
 * SafetyScore = 100 - (Weather + Disaster + Medical + Mobility)
 * 변경 시 데이터/점수엔진/UI 전 영역에 영향 — 수정은 메인 세션 승인 후에만.
 */

/** 동행/이동 프로필 — 위험 가중치 차등 적용 (제안서: 부모님→의료×1.5, 아이→폭염·미세먼지×1.3, 자차→도로×1.5) */
export type Profile = "default" | "with_kids" | "with_seniors" | "own_car";

export const PROFILE_LABEL: Record<Profile, string> = {
  default: "기본",
  with_kids: "아이 동반",
  with_seniors: "부모님 동반",
  own_car: "자차 이동",
};

/** 관광지 1곳의 위험 계산 입력값 — 공공데이터에서 채워짐 (1주차: fixture) */
export interface RiskInput {
  /** 최고기온 ℃ (기상청 단기예보) */
  tempC: number;
  /** 일 최대 체감온도 ℃ (기상청 여름철 산식) — 없으면 tempC로 폭염 평가 (계절 모드·mock 경로) */
  apparentTempC?: number;
  /** 강수확률 % */
  rainProbPct: number;
  /** 예상 강수량 mm (선택) */
  rainMm?: number;
  /** 풍속 m/s */
  windMs: number;
  /** 초미세먼지 PM2.5 ㎍/㎥ (AirKorea) */
  pm25: number;
  /** 산불위험 단계 1~4 (산림청: 1 낮음 ~ 4 심각) */
  forestFireLevel: 1 | 2 | 3 | 4;
  /** 최근접 응급의료기관까지 거리 km (보건복지부) */
  emergencyRoomKm: number;
  /** 최근접 대피소까지 거리 km (행정안전부, 선택) */
  shelterKm?: number;
  /** 이동 경로 위험 0~1 (도로교통공단, 2주차 이후) */
  roadRisk?: number;
}

export type RiskFactorKey =
  | "heat" // 폭염
  | "cold" // 한파 (계절 모드 전용 — 30년 기후 시나리오에서만 계산)
  | "rain_wind" // 강수·강풍
  | "pm" // 미세먼지
  | "forest_fire" // 산불·산사태
  | "medical" // 응급의료 접근성
  | "shelter" // 대피소 접근성
  | "road"; // 이동 위험

export type RiskLevel = "low" | "moderate" | "high";

/** 위험 요인 1건 — RiskBreakdownBar가 그대로 렌더링하는 단위 */
export interface RiskFactor {
  key: RiskFactorKey;
  /** 표시명: "폭염", "강수·강풍" 등 */
  label: string;
  /** 관측/예보값 (예: 34.2) */
  value: number;
  /** 값 단위 표시 (예: "℃", "%", "㎍/㎥", "단계", "km") */
  unit: string;
  /** 공식 임계값 (예: 폭염주의보 33) */
  threshold: number;
  /** 감점 (프로필 가중 적용 후, 반올림) */
  points: number;
  /** 이 요인의 감점 상한 */
  maxPoints: number;
  level: RiskLevel;
  /** 사용자용 설명: "최고기온 34.2℃ — 폭염주의보 기준(33℃) 초과" */
  description: string;
}

/** 안전 점수 계산 결과 — UI·DB(safety_snapshots.factors) 공용 계약 */
export interface RiskBreakdown {
  /** 0~100. 높을수록 주의 요인 낮음 */
  score: number;
  /**
   * 등급 표현 주의: "안전합니다" 금지.
   * low = "방문 주의 요인 낮음", moderate = "주의 요인 있음", high = "주의 요인 높음"
   */
  grade: RiskLevel;
  profile: Profile;
  factors: RiskFactor[];
  /**
   * 제안서 산식의 카테고리 소계 (감점 원값 합).
   * 총 감점이 100을 넘는 극단 입력에서는 score가 0으로 고정되어
   * 소계 합이 (100 - score)를 초과할 수 있다.
   */
  weatherRisk: number;
  disasterRisk: number;
  medicalRisk: number;
  mobilityRisk: number;
}

/** 카테고리 소계 표시용 공용 정의 — 상세·리포트 화면이 같은 키·라벨·아이콘을 공유한다 */
export const RISK_CATEGORY_LABELS = [
  { key: "weatherRisk", icon: "🌤️", label: "기상" },
  { key: "disasterRisk", icon: "⚠️", label: "재난" },
  { key: "medicalRisk", icon: "🏥", label: "의료" },
  { key: "mobilityRisk", icon: "🚗", label: "이동" },
] as const;

export const GRADE_LABEL: Record<RiskLevel, string> = {
  low: "방문 주의 요인 낮음",
  moderate: "주의 요인 있음",
  high: "주의 요인 높음",
};

/** 1주차 mock 시나리오 키 — fixtures/safety/risk-inputs.ts가 구현 */
export type ScenarioKey = "clear" | "heatwave" | "rainy" | "bad_air";
