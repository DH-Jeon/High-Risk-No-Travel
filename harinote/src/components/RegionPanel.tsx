"use client";

import Link from "next/link";
import type { RegionSummary } from "@/lib/risk/region-summary";
import { GRADE_LABEL } from "@/lib/safety/types";
import SafetyScoreBadge from "@/components/SafetyScoreBadge";

interface RegionPanelProps {
  regions: RegionSummary[];
  selectedCode: number | null;
  onSelect: (sigunguCode: number) => void;
  onClear: () => void;
  /** 점수 기준 라벨 (기본 "오늘", 날짜 모드에서 "7월 20일 (월)" 등) */
  dateLabel?: string;
  /** 목록/코스 링크에 유지할 조건 (profile=..., date=...) */
  extraQuery?: Record<string, string | undefined>;
}

/** 대시보드 우측 패널 — 선택 전: 시군 리스트 / 선택 후: 시군 상세 */
export default function RegionPanel({
  regions,
  selectedCode,
  onSelect,
  onClear,
  dateLabel = "오늘",
  extraQuery = {},
}: RegionPanelProps) {
  const selected = regions.find((r) => r.sigunguCode === selectedCode);

  function hrefWith(base: string, sigunguCode: number): string {
    const q = new URLSearchParams({ sigungu: String(sigunguCode) });
    for (const [k, v] of Object.entries(extraQuery)) {
      if (v) q.set(k, v);
    }
    return `${base}?${q.toString()}`;
  }

  if (selected) {
    return (
      <aside className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <button
          type="button"
          onClick={onClear}
          className="self-start text-xs font-semibold text-slate-400 transition-colors hover:text-teal-700"
        >
          ← 전체 시군 보기
        </button>
        <h2 className="mt-3 text-xl font-extrabold text-slate-900">
          {selected.name}
        </h2>
        <div className="mt-2">
          {selected.medianScore !== null && selected.grade !== null ? (
            <div className="space-y-1.5">
              <SafetyScoreBadge
                score={selected.medianScore}
                grade={selected.grade}
              />
              <p className="text-xs text-slate-500">
                {dateLabel} 기준 {GRADE_LABEL[selected.grade]} — 시군 내 관광지
                안전점수의 중앙값입니다.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {dateLabel} 점수를 계산할 관광지 데이터가 없습니다.
            </p>
          )}
        </div>
        <p className="mt-4 text-sm text-slate-600">
          등록 관광지{" "}
          <strong className="tabular-nums text-slate-900">
            {selected.placeCount}곳
          </strong>
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={hrefWith("/places", selected.sigunguCode)}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-teal-700"
          >
            {selected.name} 관광지 보기
          </Link>
          <Link
            href={`${hrefWith("/places", selected.sigunguCode)}&course=1`}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200"
          >
            AI 코스 추천 받기
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col rounded-2xl bg-white ring-1 ring-slate-200">
      <p className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">
        시군별 요약
        <span className="ml-2 text-xs font-medium text-slate-400">
          지도나 목록에서 시군을 선택하세요
        </span>
      </p>
      <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto sm:max-h-[440px]">
        {regions.map((region) => (
          <li key={region.sigunguCode}>
            <button
              type="button"
              onClick={() => onSelect(region.sigunguCode)}
              className="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left transition-colors hover:bg-teal-50/60"
            >
              <span className="text-sm font-semibold text-slate-700">
                {region.name}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  관광지 {region.placeCount}곳
                </span>
              </span>
              {region.medianScore !== null && region.grade !== null ? (
                <SafetyScoreBadge
                  score={region.medianScore}
                  grade={region.grade}
                />
              ) : (
                <span className="text-xs font-semibold text-slate-400">
                  데이터 없음
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
