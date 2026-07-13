import type { Metadata } from "next";
import Link from "next/link";
import { getPlacesWithSafety } from "@/lib/datasource";
import {
  CONTENT_TYPE_LABEL,
  SUPPORTED_CONTENT_TYPE_IDS,
} from "@/lib/tour/types";
import PlaceCard from "@/components/PlaceCard";
import PopularSidebar from "@/components/PopularSidebar";
import ProfileChips from "@/components/ProfileChips";
import SearchBox from "@/components/SearchBox";
import {
  buildQuery,
  first,
  parseContentTypeId,
  parsePage,
  parseProfile,
  parseSigungu,
  profileParam,
  type SearchParamValue,
} from "@/components/search-params";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "관광지 검색",
};

const TYPE_TABS: { label: string; value?: number }[] = [
  { label: "전체" },
  ...SUPPORTED_CONTENT_TYPE_IDS.map((id) => ({
    label: CONTENT_TYPE_LABEL[id],
    value: id,
  })),
];

interface Props {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

export default async function PlacesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const contentTypeId = parseContentTypeId(sp.type);
  const profile = parseProfile(sp.profile);
  const sigunguCode = parseSigungu(sp.sigungu);
  const sigunguName = sigunguCode ? SIGUNGU_SEATS[sigunguCode].name : undefined;

  // 기본 정렬 = 안전점수 높은 순 — "어디가 안전한가"가 서비스의 축이므로
  // 데이터 순서(사실상 가나다)가 아니라 점수가 목록의 기준이어야 한다.
  // 전량 점수는 getPlacesWithSafety의 10분 메모리 캐시를 재사용해 부담 없음.
  const places = [
    ...(await getPlacesWithSafety(
      { q: q || undefined, contentTypeId, sigunguCode },
      profile,
    )),
  ].sort((a, b) => b.safety.score - a.safety.score);

  // 서버 사이드 페이지네이션 — 24건/페이지.
  const totalPages = Math.max(1, Math.ceil(places.length / PAGE_SIZE));
  const page = Math.min(parsePage(sp.page), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pagePlaces = places.slice(start, start + PAGE_SIZE);

  const pageHref = (p: number) =>
    `/places${buildQuery({
      q: q || undefined,
      type: contentTypeId,
      sigungu: sigunguCode,
      profile: profileParam(profile),
      page: p === 1 ? undefined : p,
    })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
      <div>
        <div className="max-w-2xl">
          <SearchBox defaultQuery={q} profile={profile} compact />
        </div>

      <div className="mt-5 space-y-3">
        {/* 유형 필터 탭 */}
        <nav aria-label="관광지 유형 필터" className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => {
            const active = tab.value === contentTypeId;
            const href = `/places${buildQuery({
              q: q || undefined,
              type: tab.value,
              sigungu: sigunguCode,
              profile: profileParam(profile),
            })}`;
            return (
              <Link
                key={tab.label}
                href={href}
                aria-current={active ? "true" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* 동행 프로필 전환 */}
        <ProfileChips
          basePath="/places"
          current={profile}
          extraParams={{
            q: q || undefined,
            type: contentTypeId,
            sigungu: sigunguCode,
          }}
        />
      </div>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>
          {sigunguName && (
            <strong className="text-slate-800">{sigunguName} </strong>
          )}
          {q ? (
            <>
              <strong className="text-slate-800">&ldquo;{q}&rdquo;</strong>{" "}
              검색 결과{" "}
            </>
          ) : sigunguName ? (
            "관광지 "
          ) : (
            "강원 관광지 "
          )}
          <strong className="text-teal-700">{places.length}곳</strong>
          {places.length > PAGE_SIZE && (
            <>
              {" "}
              중 {start + 1}–{start + pagePlaces.length}번째
            </>
          )}
        </span>
        {sigunguName && (
          <Link
            href={`/places${buildQuery({
              q: q || undefined,
              type: contentTypeId,
              profile: profileParam(profile),
            })}`}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
          >
            {sigunguName} 필터 해제 ✕
          </Link>
        )}
      </p>

      {places.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-slate-200">
          <p className="text-4xl" aria-hidden="true">
            🔎
          </p>
          <p className="mt-4 text-lg font-bold text-slate-800">
            검색 결과가 없어요
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            다른 검색어로 시도하거나, 아래 인기 관광지를 둘러보세요.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["남이섬", "설악산", "경포"].map((name) => (
              <Link
                key={name}
                href={`/places${buildQuery({ q: name, profile: profileParam(profile) })}`}
                className="rounded-full bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {pagePlaces.map((place) => (
              <PlaceCard
                key={place.contentId}
                place={place}
                profile={profile}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <nav
              aria-label="페이지 이동"
              className="mt-8 flex items-center justify-center gap-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                >
                  ← 이전
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="rounded-full bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-300 ring-1 ring-slate-100"
                >
                  ← 이전
                </span>
              )}
              <span className="text-sm font-semibold tabular-nums text-slate-600">
                {page} / {totalPages} 페이지
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                >
                  다음 →
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="rounded-full bg-slate-50 px-4 py-1.5 text-sm font-semibold text-slate-300 ring-1 ring-slate-100"
                >
                  다음 →
                </span>
              )}
            </nav>
          )}
        </>
      )}
      </div>

      {/* 인기 관광지 사이드바 — lg 미만에서는 결과 아래 스택 */}
      <div className="mt-10 lg:mt-0">
        <PopularSidebar profile={profile} />
      </div>
    </div>
  );
}
