/**
 * 여행 계획 — 담은 관광지 목록의 순수 로직 (localStorage와 분리해 테스트 가능).
 * 훅(useTravelPlan)이 이 함수들로 상태를 조작한다.
 */
import { haversineKm } from "@/lib/reco/distance";

export interface PlanItem {
  contentId: number;
  title: string;
  lat: number;
  lng: number;
  /** 담을 당시 안전점수 (표시용, 없을 수 있음) */
  score?: number;
}

export interface TravelPlan {
  items: PlanItem[];
  /** 여행 기간 (YYYY-MM-DD) */
  from?: string;
  to?: string;
}

export const EMPTY_PLAN: TravelPlan = { items: [] };

/** 중복(contentId) 없이 뒤에 추가 */
export function addItem(plan: TravelPlan, item: PlanItem): TravelPlan {
  if (plan.items.some((p) => p.contentId === item.contentId)) return plan;
  return { ...plan, items: [...plan.items, item] };
}

export function removeItem(plan: TravelPlan, contentId: number): TravelPlan {
  return { ...plan, items: plan.items.filter((p) => p.contentId !== contentId) };
}

/** from 위치의 항목을 to 위치로 이동 (드래그 순서 변경) */
export function reorder(plan: TravelPlan, from: number, to: number): TravelPlan {
  const n = plan.items.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return plan;
  const items = [...plan.items];
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
  return { ...plan, items };
}

export function setRange(plan: TravelPlan, from?: string, to?: string): TravelPlan {
  return { ...plan, from, to };
}

/** 담은 순서대로 이어붙인 직선 총 거리(km, 소수1) */
export function totalDistanceKm(plan: TravelPlan): number {
  let sum = 0;
  for (let i = 1; i < plan.items.length; i++) {
    const a = plan.items[i - 1];
    const b = plan.items[i];
    sum += haversineKm(a.lat, a.lng, b.lat, b.lng);
  }
  return Math.round(sum * 10) / 10;
}

/** 저장/복원 시 형태 검증 — 손상된 localStorage 값 방어 */
export function isValidPlan(v: unknown): v is TravelPlan {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  if (!Array.isArray(p.items)) return false;
  return p.items.every(
    (it) =>
      typeof it === "object" &&
      it !== null &&
      typeof (it as PlanItem).contentId === "number" &&
      typeof (it as PlanItem).title === "string" &&
      typeof (it as PlanItem).lat === "number" &&
      typeof (it as PlanItem).lng === "number",
  );
}
