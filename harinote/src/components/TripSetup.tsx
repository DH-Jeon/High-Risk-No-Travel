"use client";

import { useRouter } from "next/navigation";
import { useTravelPlan } from "@/hooks/useTravelPlan";
import { todayISOSeoul } from "@/lib/date";
import type { Transport } from "@/lib/prefs";

const NIGHTS_OPTIONS = [
  { nights: 0, label: "당일치기" },
  { nights: 1, label: "1박 2일" },
  { nights: 2, label: "2박 3일" },
  { nights: 3, label: "3박 4일" },
];

const TRANSPORT_OPTIONS: { key: Transport; label: string }[] = [
  { key: "transit", label: "🚌 대중교통" },
  { key: "car", label: "🚗 자차" },
];

const YEAR = 60 * 60 * 24 * 365;

/** 이동수단 쿠키 쓰기 — 모듈 스코프 함수라 컴포넌트 순수성 규칙에 걸리지 않음 */
function setTransportCookie(t: Transport) {
  document.cookie = `hari_transport=${t}; path=/; max-age=${YEAR}; samesite=lax`;
}

/**
 * 홈 온보딩 — 박수·시작날·이동수단 선택 → 여행 계획에 저장하고,
 * 그 시작날(1일차) 기준으로 안전 지도가 갱신되도록 URL date를 바꾼다.
 * 이동수단은 쿠키(hari_transport)에 저장돼 관광지 검색·상세에 전파된다.
 */
export default function TripSetup({ transport }: { transport: Transport }) {
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

  function chooseTransport(t: Transport) {
    setTransportCookie(t);
    router.refresh(); // 서버 컴포넌트가 새 쿠키로 다시 렌더
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
      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-600">
          어떻게 이동하시나요?
        </p>
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => chooseTransport(t.key)}
              aria-pressed={transport === t.key}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                transport === t.key
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="self-center text-xs text-slate-400">
            자차는 대체지·코스를 더 넓게 (30→50km) 추천해요
          </span>
        </div>
      </div>
    </div>
  );
}
