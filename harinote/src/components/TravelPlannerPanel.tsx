"use client";

import { useState } from "react";
import Link from "next/link";
import CourseRouteMap from "@/components/CourseRouteMap";
import { useTravelPlan } from "@/hooks/useTravelPlan";
import { PLAN_DRAG_TYPE } from "@/components/PlannerCard";
import type { PlanItem } from "@/lib/travel-plan";

/**
 * 내 여행 계획 패널 — 카드 드롭으로 담고, 순서 드래그로 정렬, 직선 루트+총거리 표시.
 * localStorage 영속(useTravelPlan). 목록 3열의 우측 · 모바일 서랍에서 재사용.
 */
export default function TravelPlannerPanel({ compact = false }: { compact?: boolean }) {
  const { plan, hydrated, add, remove, move, setDates, clear, count, totalKm } =
    useTravelPlan();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  // 카드에서 온 드롭 — PlanItem 추가
  function onCardDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const raw = e.dataTransfer.getData(PLAN_DRAG_TYPE);
    if (!raw) return;
    try {
      add(JSON.parse(raw) as PlanItem);
    } catch {
      /* 잘못된 페이로드 무시 */
    }
  }

  return (
    <aside
      aria-label="내 여행 계획"
      className={`flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 ${compact ? "" : "sticky top-20"}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">
          🗺 내 여행 계획
          {hydrated && count > 0 && (
            <span className="ml-1.5 text-sm font-semibold text-teal-600">{count}</span>
          )}
        </h2>
        {hydrated && count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold text-slate-400 transition-colors hover:text-red-500"
          >
            비우기
          </button>
        )}
      </div>

      {/* 기간 선택 */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 text-sm">
        <input
          type="date"
          value={plan.from ?? ""}
          onChange={(e) => setDates(e.target.value || undefined, plan.to)}
          aria-label="여행 시작일"
          className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
        />
        <span className="text-slate-300">~</span>
        <input
          type="date"
          value={plan.to ?? ""}
          min={plan.from}
          onChange={(e) => setDates(plan.from, e.target.value || undefined)}
          aria-label="여행 종료일"
          className="min-w-0 flex-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
        />
      </div>

      {/* 담긴 관광지 — 드롭존 + 순서 드래그 */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onCardDrop}
        className={`mx-3 mb-2 min-h-[80px] rounded-xl p-1 transition-colors ${
          dropActive ? "bg-teal-50 ring-2 ring-teal-300" : ""
        }`}
      >
        {!hydrated || count === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            관광지 카드를 여기로 드래그하거나
            <br />
            <span className="font-semibold text-slate-500">+ 계획</span> 버튼으로 담아보세요
          </p>
        ) : (
          <ol className="space-y-1.5">
            {plan.items.map((it, i) => (
              <li
                key={it.contentId}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  if (dragIndex !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <Link
                  href={`/places/${it.contentId}`}
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 hover:text-teal-700"
                >
                  {it.title}
                </Link>
                {it.score !== undefined && (
                  <span className="shrink-0 text-xs font-bold tabular-nums text-slate-400">
                    {it.score}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(it.contentId)}
                  aria-label={`${it.title} 빼기`}
                  className="shrink-0 text-slate-300 transition-colors hover:text-red-500"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 루트 지도 + 총거리 (2곳 이상일 때) */}
      {hydrated && count >= 2 && (
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>담은 순서대로 이동 경로</span>
            <span className="text-slate-700">직선 {totalKm}km</span>
          </div>
          <CourseRouteMap
            stops={plan.items.map((it) => ({ title: it.title, lat: it.lat, lng: it.lng }))}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            직선 거리 기준이에요. 실제 소요 시간은 지도 앱에서 확인하세요.
          </p>
        </div>
      )}
    </aside>
  );
}
