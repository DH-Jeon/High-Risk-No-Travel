import Link from "next/link";
import { getRegionSummaries } from "@/lib/risk/region-summary";
import { hasLiveRiskKeys } from "@/lib/risk/live";
import { medicalDataSource } from "@/lib/risk/medical";
import SearchBox from "@/components/SearchBox";
import RegionDashboard from "@/components/RegionDashboard";

// 검색어별 결과가 실제로 존재하는지 확인된 목록 (gangwon.json 기준 — "경포해변"은 0건이라 "경포"로)
const POPULAR = ["남이섬", "설악산", "경포", "정동진", "춘천", "속초"];

export default async function Home() {
  const regions = await getRegionSummaries();

  return (
    <div className="bg-gradient-to-b from-teal-50/60 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8">
        {/* 컴팩트 히어로 */}
        <div className="max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            오늘, 이 강원 관광지 가도 될까?
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            기상·재난·의료 공공데이터로 관광지별 방문 주의 요인을 점수로
            알려드립니다.
          </p>
          <div className="mt-4">
            <SearchBox withProfile withDate />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              인기 검색
            </span>
            {POPULAR.map((name) => (
              <Link
                key={name}
                href={`/places?q=${encodeURIComponent(name)}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-300"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>

        {/* 오늘의 안전 지도 대시보드 */}
        <section className="mt-6" aria-label="오늘의 안전 지도">
          <RegionDashboard regions={regions} />
        </section>

        {/* 출처·참고 */}
        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-400">
          <p>
            본 지도는 공공데이터 기반 참고 정보이며 안전을 보장하지 않습니다.
            방문 전 기상특보와 현지 안내를 반드시 확인하세요.
          </p>
          <p className="mt-1">
            데이터 출처: 한국관광공사 TourAPI · {medicalDataSource()}
            {hasLiveRiskKeys()
              ? " · 기상청 · AirKorea(한국환경공단). 산불위험은 실연동 준비 중인 시범값입니다."
              : ". 기상·미세먼지·산불위험은 시범값 기준입니다."}
          </p>
        </footer>
      </div>
    </div>
  );
}
