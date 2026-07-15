"use client";

import { useRouter } from "next/navigation";
import { useTravelPlan } from "@/hooks/useTravelPlan";
import { todayISOSeoul } from "@/lib/date";

const NIGHTS_OPTIONS = [
  { nights: 0, label: "당일치기" },
  { nights: 1, label: "1박 2일" },
  { nights: 2, label: "2박 3일" },
  { nights: 3, label: "3박 4일" },
];

/**
 * 홈 온보딩 — 박수 + 시작날 선택 → 여행 계획에 저장하고,
 * 그 시작날(1일차) 기준으로 안전 지도가 갱신되도록 URL date를 바꾼다.
 */
export default function TripSetup() {
  const router = useRouter();
  const { plan, hydrated, setTrip } = useTravelPlan();

  const today = todayISOSeoul();
  const nights = plan.nights ?? 0;
  const start = plan.from ?? "";

  function apply(nextNights: number, nextStart: string) {
    setTrip(nextNights, nextStart || undefined);
    // 지도는 1일차(=시작날) 기준. 오늘이거나 미선택이면 date 없이(오늘 모드)
    const q =
      nextStart && nextStart !== today ? `?date=${nextStart}` : "";
    router.replace(`/${q}`, { scroll: false });
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-600">
          며칠 여행이신가요?
        </p>
        <div className="flex flex-wrap gap-2">
          {NIGHTS_OPTIONS.map((o) => (
            <button
              key={o.nights}
              type="button"
              onClick={() => apply(o.nights, start)}
              aria-pressed={hydrated && nights === o.nights}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                hydrated && nights === o.nights
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-teal-50 hover:text-teal-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-600">
          언제 출발하시나요?
        </p>
        <input
          type="date"
          value={start}
          min={today}
          onChange={(e) => apply(nights, e.target.value)}
          aria-label="여행 시작일"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {hydrated && start && nights > 0 && (
          <span className="ml-2 text-xs font-medium text-slate-400">
            지도·검색은 1일차(출발일) 기준이에요
          </span>
        )}
      </div>
    </div>
  );
}
