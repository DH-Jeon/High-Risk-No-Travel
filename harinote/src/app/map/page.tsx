import type { Metadata } from "next";
import Link from "next/link";
import { getRegionSummaries } from "@/lib/risk/region-summary";
import { GRADE_LABEL, type RiskLevel } from "@/lib/safety/types";
import { hasLiveRiskKeys } from "@/lib/risk/live";
import { medicalDataSource } from "@/lib/risk/medical";
import RegionRiskMap from "@/components/RegionRiskMap";
import SafetyScoreBadge from "@/components/SafetyScoreBadge";

export const metadata: Metadata = {
  title: "오늘의 안전 지도",
};

/** 범례 점 색 — SafetyScoreBadge의 dot 색 체계와 동일 */
const LEGEND_DOT: Record<RiskLevel, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  high: "bg-red-500",
};
const GRADES: RiskLevel[] = ["low", "moderate", "high"];

export default async function MapPage() {
  const regions = await getRegionSummaries();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">
        오늘의 안전 지도
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        오늘 기준 강원 18개 시군의 방문 주의 요인을 한눈에 확인하세요. 점수는
        시군 내 관광지 안전점수의 중앙값이며, 시군을 누르면 관광지 목록으로
        이동합니다.
      </p>

      <div className="mt-5">
        <RegionRiskMap regions={regions} />
      </div>

      {/* 범례 */}
      <ul
        aria-label="등급 범례"
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-slate-600"
      >
        {GRADES.map((grade) => (
          <li key={grade} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${LEGEND_DOT[grade]}`}
            />
            {GRADE_LABEL[grade]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-slate-400"
          />
          데이터 없음
        </li>
      </ul>

      {/* 시군 칩 그리드 */}
      <h2 className="mt-8 text-lg font-bold text-slate-900">시군별 요약</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {regions.map((region) => (
          <div
            key={region.sigunguCode}
            className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{region.name}</p>
              {region.medianScore !== null && region.grade !== null ? (
                <SafetyScoreBadge
                  score={region.medianScore}
                  grade={region.grade}
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  데이터 없음
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              관광지{" "}
              <strong className="tabular-nums text-slate-700">
                {region.placeCount}곳
              </strong>
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/places?sigungu=${region.sigunguCode}`}
                className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100"
              >
                관광지 보기
              </Link>
              <Link
                href={`/courses?sigungu=${region.sigunguCode}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
              >
                코스 만들기
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* 출처·참고 */}
      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-400">
        <p>
          본 지도는 공공데이터 기반 참고 정보이며 안전을 보장하지 않습니다.
          방문 전 기상특보와 현지 안내를 반드시 확인하세요.
        </p>
        <p className="mt-1">
          데이터 출처: 한국관광공사 TourAPI · {medicalDataSource()}
          {hasLiveRiskKeys()
            ? " · 기상청 · AirKorea(한국환경공단). 산불위험·대피소는 실연동 준비 중인 시범값입니다."
            : ". 기상·미세먼지·산불위험·대피소는 시범값 기준입니다."}
        </p>
      </footer>
    </div>
  );
}
