import Link from "next/link";
import { Suspense } from "react";
import { getRegionSummaries } from "@/lib/risk/region-summary";
import FestivalSection from "@/components/FestivalSection";
import { hasLiveRiskKeys } from "@/lib/risk/live";
import { hasForestKey } from "@/lib/risk/forest";
import { medicalDataSource } from "@/lib/risk/medical";
import { formatKoreanDate } from "@/lib/date";
import SearchBox from "@/components/SearchBox";
import DateChips from "@/components/DateChips";
import ProfileChips from "@/components/ProfileChips";
import RegionDashboard from "@/components/RegionDashboard";
import {
  parseDate,
  parseProfile,
  parseTransport,
  profileParam,
  buildQuery,
  type SearchParamValue,
} from "@/components/search-params";
import { savedProfile, savedTransport, type Transport } from "@/lib/prefs";
import PrefsPersist from "@/components/PrefsPersist";

// 검색어별 결과가 실제로 존재하는지 확인된 목록 (gangwon.json 기준 — "경포해변"은 0건이라 "경포"로)
const POPULAR = ["남이섬", "설악산", "경포", "정동진", "춘천", "속초"];

interface Props {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  // URL 파라미터 우선, 없으면 쿠키에 기억된 조건 (한 번 고르면 다음 방문에도 유지)
  const profile =
    sp.profile !== undefined
      ? parseProfile(sp.profile)
      : ((await savedProfile()) ?? "default");
  const transport: Transport =
    parseTransport(sp.tr) ?? (await savedTransport()) ?? "transit";
  const date = parseDate(sp.date);

  // 선택한 조건(언제·누구와)이 지도·시군 요약에 바로 반영된다
  const regions = await getRegionSummaries(profile, date);
  const dateLabel = date ? formatKoreanDate(date) : "오늘";

  return (
    <div className="bg-gradient-to-b from-teal-50/60 to-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-8">
        {/* 컴팩트 히어로 */}
        <div className="max-w-2xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {date ? `${dateLabel}, ` : "오늘, "}이 강원 관광지 가도 될까?
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            기상·재난·의료 공공데이터로 관광지별 방문 주의 요인을 점수로
            알려드립니다.
          </p>
          <div className="mt-4">
            <SearchBox profile={profile} date={date} />
          </div>

          <PrefsPersist profile={profile} transport={transport} />

          {/* 온보딩 — 누르면 지도·점수가 그 조건으로 바로 갱신되고, 선택은 기억된다 */}
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-600">
                언제 가시나요?
              </p>
              <DateChips
                basePath="/"
                current={date}
                extraParams={{ profile: profileParam(profile) }}
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-600">
                누구와 함께 가시나요?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ProfileChips
                  basePath="/"
                  current={profile}
                  extraParams={{ date }}
                  exclude={["own_car"]}
                />
                <Link
                  href={`/places${buildQuery({ pet: "1", profile: profileParam(profile), date })}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-amber-50 hover:text-amber-700"
                >
                  🐶 반려동물과 함께
                </Link>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-600">
                어떻게 이동하시나요?{" "}
                <span className="font-normal text-slate-400">
                  — 한 번 고르면 기억돼요
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: "transit", label: "🚌 대중교통" },
                    { key: "car", label: "🚗 자차" },
                  ] as const
                ).map((t) => (
                  <Link
                    key={t.key}
                    href={`/${buildQuery({ profile: profileParam(profile), date, tr: t.key })}`}
                    aria-current={transport === t.key ? "true" : undefined}
                    className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      transport === t.key
                        ? "bg-slate-700 text-white shadow-sm"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </Link>
                ))}
                <span className="self-center text-xs text-slate-400">
                  자차는 대체지·코스를 더 넓게 (30→50km) 찾아드려요
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              인기 검색
            </span>
            {POPULAR.map((name) => (
              <Link
                key={name}
                href={`/places${buildQuery({ q: name, profile: profileParam(profile), date })}`}
                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-teal-50 hover:text-teal-700 hover:ring-teal-300"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>

        {/* 안전 지도 대시보드 — 선택 조건 기준 */}
        <section className="mt-6" aria-label={`${dateLabel} 안전 지도`}>
          <RegionDashboard
            regions={regions}
            dateLabel={dateLabel}
            extraQuery={{ profile: profileParam(profile), date }}
          />
        </section>

        {/* 축제·행사 — TourAPI 실시간, 등록 없으면 숨김 (스트리밍) */}
        <Suspense fallback={null}>
          <FestivalSection dateISO={date} profile={profile} />
        </Suspense>

        {/* 출처·참고 */}
        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-400">
          <p>
            본 지도는 공공데이터 기반 참고 정보이며 안전을 보장하지 않습니다.
            방문 전 기상특보와 현지 안내를 반드시 확인하세요.
          </p>
          <p className="mt-1">
            데이터 출처: 한국관광공사 TourAPI · {medicalDataSource()}
            {hasLiveRiskKeys()
              ? hasForestKey()
                ? " · 기상청 · AirKorea(한국환경공단) · 산림청(산불위험예보)."
                : " · 기상청 · AirKorea(한국환경공단). 산불위험은 실연동 준비 중인 시범값입니다."
              : ". 기상·미세먼지·산불위험은 시범값 기준입니다."}
          </p>
        </footer>
      </div>
    </div>
  );
}
