"use client";

import PlaceCard from "@/components/PlaceCard";
import type { PlaceWithSafety } from "@/lib/datasource";
import type { Profile } from "@/lib/safety/types";
import { useTravelPlan } from "@/hooks/useTravelPlan";
import type { PlanItem } from "@/lib/travel-plan";

/** 드래그 전송 키 — TravelPlannerPanel의 드롭존과 공유 */
export const PLAN_DRAG_TYPE = "application/x-hari-place";

export function planItemOf(place: PlaceWithSafety): PlanItem {
  return {
    contentId: place.contentId,
    title: place.title,
    lat: place.lat,
    lng: place.lng,
    score: place.safety.score,
  };
}

/**
 * 목록 전용 카드 래퍼 — PlaceCard(서버)를 감싸 드래그 소스 + "계획 담기" 버튼 부여.
 * 데스크톱은 우측 계획 패널로 드래그, 모바일은 버튼으로 담는다.
 */
export default function PlannerCard({
  place,
  profile,
  date,
}: {
  place: PlaceWithSafety;
  profile: Profile;
  date?: string;
}) {
  const { add, remove, has, hydrated } = useTravelPlan();
  const item = planItemOf(place);
  const added = hydrated && has(place.contentId);

  return (
    <div
      className="group/planner relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PLAN_DRAG_TYPE, JSON.stringify(item));
        e.dataTransfer.setData("text/plain", place.title);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <PlaceCard place={place} profile={profile} date={date} />

      {/* 담기/담김 토글 — 카드 우하단 오버레이 (Link 밖이라 클릭 전파 없음) */}
      <button
        type="button"
        onClick={() => (added ? remove(place.contentId) : add(item))}
        aria-pressed={added}
        title={added ? "계획에서 빼기" : "여행 계획에 담기"}
        className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-colors ${
          added
            ? "bg-teal-600 text-white hover:bg-teal-700"
            : "bg-white text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
        }`}
      >
        {added ? "✓ 담김" : "+ 계획"}
      </button>

      {/* 데스크톱 드래그 힌트 (호버 시) */}
      <span className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/planner:opacity-100 lg:block">
        ⠿ 드래그해서 담기
      </span>
    </div>
  );
}
