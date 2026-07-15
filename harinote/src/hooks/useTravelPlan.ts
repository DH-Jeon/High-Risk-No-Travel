"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addItem,
  EMPTY_PLAN,
  isValidPlan,
  type PlanItem,
  removeItem,
  reorder,
  setRange,
  totalDistanceKm,
  type TravelPlan,
} from "@/lib/travel-plan";

const STORAGE_KEY = "hari_travel_plan";
/** 같은 탭 내 여러 인스턴스(패널·카드·서랍) 동기화용 이벤트 */
const SYNC_EVENT = "hari-plan-change";

// useSyncExternalStore는 getSnapshot이 안정된 참조를 반환해야 한다 —
// 원문(raw)이 바뀌지 않으면 같은 객체를 돌려주도록 모듈 레벨 캐시.
let cachedRaw: string | null = null;
let cachedPlan: TravelPlan = EMPTY_PLAN;

function readPlan(): TravelPlan {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedPlan;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedPlan = isValidPlan(parsed) ? parsed : EMPTY_PLAN;
  } catch {
    cachedPlan = EMPTY_PLAN;
  }
  return cachedPlan;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(SYNC_EVENT, onChange);
  window.addEventListener("storage", onChange); // 다른 탭
  return () => {
    window.removeEventListener(SYNC_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(next: TravelPlan) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    /* 저장 실패해도 화면은 다음 읽기에서 이전 상태 유지 */
  }
}

/**
 * 여행 계획 상태 — localStorage 외부 스토어를 useSyncExternalStore로 구독.
 * SSR·다른 탭·같은 탭 인스턴스 간 동기화가 자동으로 안전.
 */
export function useTravelPlan() {
  const plan = useSyncExternalStore(subscribe, readPlan, () => EMPTY_PLAN);
  // 서버 렌더는 false, 클라이언트 hydrate 후 true (깜빡임 방지용 게이트)
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const add = useCallback((item: PlanItem) => write(addItem(readPlan(), item)), []);
  const remove = useCallback((contentId: number) => write(removeItem(readPlan(), contentId)), []);
  const move = useCallback((from: number, to: number) => write(reorder(readPlan(), from, to)), []);
  const setDates = useCallback((from?: string, to?: string) => write(setRange(readPlan(), from, to)), []);
  const clear = useCallback(() => write(EMPTY_PLAN), []);
  const has = useCallback(
    (contentId: number) => plan.items.some((p) => p.contentId === contentId),
    [plan],
  );

  return {
    plan,
    hydrated,
    add,
    remove,
    move,
    setDates,
    clear,
    has,
    count: plan.items.length,
    totalKm: totalDistanceKm(plan),
  };
}
