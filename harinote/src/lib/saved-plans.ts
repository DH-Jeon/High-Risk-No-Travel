/**
 * 저장된 여행 계획 목록 — 순수 로직 (localStorage와 분리해 테스트 가능).
 * 훅(useSavedPlans)이 이 함수들로 상태를 조작한다.
 */
import { isValidPlan, type TravelPlan } from "@/lib/travel-plan";

export interface SavedPlan {
  id: string;
  name: string;
  /** 저장 시각 (ISO) */
  savedAt: string;
  /** 저장 당시 활성 계획 스냅샷 */
  plan: TravelPlan;
}

/** localStorage 용량 방어 상한 — 초과 시 오래된 것부터 밀려난다 */
export const MAX_SAVED_PLANS = 20;

/** 같은 id는 교체, 신규는 맨 앞에 — MAX 초과분은 뒤(오래된 쪽)를 잘라낸다 */
export function upsertSavedPlan(
  list: SavedPlan[],
  entry: SavedPlan,
): SavedPlan[] {
  const rest = list.filter((p) => p.id !== entry.id);
  return [entry, ...rest].slice(0, MAX_SAVED_PLANS);
}

export function removeSavedPlan(list: SavedPlan[], id: string): SavedPlan[] {
  return list.filter((p) => p.id !== id);
}

/** 저장/복원 시 형태 검증 — 손상된 localStorage 값 방어 */
export function isValidSavedPlanList(v: unknown): v is SavedPlan[] {
  if (!Array.isArray(v)) return false;
  return v.every(
    (p) =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as SavedPlan).id === "string" &&
      typeof (p as SavedPlan).name === "string" &&
      typeof (p as SavedPlan).savedAt === "string" &&
      isValidPlan((p as SavedPlan).plan),
  );
}
