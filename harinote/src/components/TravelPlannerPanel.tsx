"use client";

import { useState } from "react";
import Link from "next/link";
import CourseRouteMap from "@/components/CourseRouteMap";
import { useTravelPlan } from "@/hooks/useTravelPlan";
import { PLAN_DRAG_TYPE } from "@/components/PlannerCard";
import { dateOfDay, totalDistanceKm, type PlanItem } from "@/lib/travel-plan";
import { formatKoreanDate } from "@/lib/date";

/**
 * 내 여행 계획 패널 — 카드 드롭으로 담고, 일차별 탭으로 나눠 순서 정렬,
 * 일차마다 직선 루트+총거리. N박이면 1일차/2일차 탭. localStorage 영속.
 */
export default function TravelPlannerPanel({ compact = false }: { compact?: boolean }) {
  const { plan, hydrated, add, remove, move, moveToDay, setActiveDay, clear, count, days, activeDay, byDay } =
    useTravelPlan();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  // 카드에서 온 드롭 페이로드 파싱 (없으면 null = 내부 순서변경)
  function parseCardDrop(e: React.DragEvent): PlanItem | null {
    const raw = e.dataTransfer.getData(PLAN_DRAG_TYPE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlanItem;
    } catch {
      return null;
    }
  }

  // 드롭존(빈 공간·컨테이너)에 카드가 떨어지면 활성 일차로 추가
  function onZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    const item = parseCardDrop(e);
    if (item) add(item, activeDay);
  }

  const dayLabel = (d: number) => {
    const iso = dateOfDay(plan, d);
    return iso ? formatKoreanDate(iso) : `${d}일차`;
  };

  const dayItems = hydrated ? (byDay[activeDay - 1] ?? []) : [];

  return (
    <aside
      aria-label="내 여행 계획"
      className={`flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 ${compact ? "" : ""}`}
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

      {/* 일차 탭 (N박일 때만) */}
      {days > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 py-2">
          {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDay(d)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) e.preventDefault();
              }}
              onDrop={(e) => {
                // 다른 일차 탭 위로 카드를 떨어뜨리면 그 일차로 담김
                const item = parseCardDrop(e);
                if (item) {
                  e.preventDefault();
                  add(item, d);
                  setActiveDay(d);
                }
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                activeDay === d
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {d}일차
              {byDay[d - 1]?.length ? ` (${byDay[d - 1].length})` : ""}
            </button>
          ))}
        </div>
      )}

      {/* 활성 일차 날짜 */}
      {hydrated && plan.from && (
        <p className="px-4 pt-2 text-xs font-semibold text-sky-700">
          {dayLabel(activeDay)} 기준
        </p>
      )}

      {/* 담긴 관광지 — 드롭존 + 순서 드래그 */}
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(PLAN_DRAG_TYPE)) {
            e.preventDefault();
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={onZoneDrop}
        className={`mx-3 my-2 min-h-[80px] rounded-xl p-1 transition-colors ${
          dropActive ? "bg-teal-50 ring-2 ring-teal-300" : ""
        }`}
      >
        {!hydrated || dayItems.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-slate-400">
            관광지 카드를 여기로 드래그하거나
            <br />
            <span className="font-semibold text-slate-500">+ 계획</span> 버튼으로 담아보세요
          </p>
        ) : (
          <ol className="space-y-1.5">
            {dayItems.map((it) => {
              const globalIdx = plan.items.indexOf(it);
              return (
                <li
                  key={it.contentId}
                  draggable
                  onDragStart={() => setDragIndex(globalIdx)}
                  onDragOver={(e) => {
                    // 내부 순서변경일 때만 이 항목이 드롭을 받는다
                    if (dragIndex !== null) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    const item = parseCardDrop(e);
                    if (item) {
                      // 외부 카드는 컨테이너가 처리하도록 버블링 (가로채지 않음)
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragIndex !== null && dragIndex !== globalIdx) {
                      move(dragIndex, globalIdx);
                    }
                    setDragIndex(null);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">
                    {dayItems.indexOf(it) + 1}
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
                  {/* 다른 일차로 이동 (N박일 때) */}
                  {days > 1 && (
                    <select
                      value={activeDay}
                      onChange={(e) => moveToDay(it.contentId, Number(e.target.value))}
                      aria-label="일차 변경"
                      className="shrink-0 rounded bg-white text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
                    >
                      {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}일차
                        </option>
                      ))}
                    </select>
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
              );
            })}
          </ol>
        )}
      </div>

      {/* 활성 일차 루트 지도 + 총거리 (2곳 이상) */}
      {hydrated && dayItems.length >= 2 && (
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{days > 1 ? `${activeDay}일차 ` : ""}이동 경로</span>
            <span className="text-slate-700">직선 {totalDistanceKm(dayItems)}km</span>
          </div>
          <CourseRouteMap
            stops={dayItems.map((it) => ({ title: it.title, lat: it.lat, lng: it.lng }))}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            직선 거리 기준이에요. 실제 소요 시간은 지도 앱에서 확인하세요.
          </p>
        </div>
      )}
    </aside>
  );
}
