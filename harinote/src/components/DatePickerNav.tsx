"use client";

import { useRouter } from "next/navigation";

interface Props {
  basePath: string;
  /** 현재 선택 날짜 (YYYY-MM-DD, 없으면 오늘) */
  current?: string;
  /** date 외에 유지할 쿼리 파라미터 */
  extraParams?: Record<string, string | number | undefined>;
  todayISO: string;
  maxISO: string;
}

/** 날짜를 고르는 즉시 반영되는 달력 — 선택하면 date 쿼리로 이동 */
export default function DatePickerNav({
  basePath,
  current,
  extraParams = {},
  todayISO,
  maxISO,
}: Props) {
  const router = useRouter();

  function navigate(value: string) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) {
      if (v !== undefined && v !== "") q.set(k, String(v));
    }
    // 오늘(또는 빈 값)은 date 없이 = 오늘 모드
    if (value && value !== todayISO) q.set("date", value);
    const qs = q.toString();
    router.push(`${basePath}${qs ? `?${qs}` : ""}`);
  }

  return (
    <input
      type="date"
      value={current ?? todayISO}
      min={todayISO}
      max={maxISO}
      onChange={(e) => navigate(e.target.value)}
      aria-label="여행 날짜 선택"
      className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
    />
  );
}
