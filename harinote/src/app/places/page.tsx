import type { Metadata } from "next";
import Link from "next/link";
import { getPlacesWithSafety } from "@/lib/datasource";
import {
  CONTENT_TYPE_LABEL,
  SUPPORTED_CONTENT_TYPE_IDS,
} from "@/lib/tour/types";
import PlaceCard from "@/components/PlaceCard";
import ProfileChips from "@/components/ProfileChips";
import SearchBox from "@/components/SearchBox";
import {
  buildQuery,
  first,
  parseContentTypeId,
  parseProfile,
  profileParam,
  type SearchParamValue,
} from "@/components/search-params";

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

  const places = await getPlacesWithSafety(
    { q: q || undefined, contentTypeId },
    profile,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
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
          extraParams={{ q: q || undefined, type: contentTypeId }}
        />
      </div>

      <p className="mt-6 text-sm text-slate-500">
        {q ? (
          <>
            <strong className="text-slate-800">&ldquo;{q}&rdquo;</strong> 검색
            결과{" "}
          </>
        ) : (
          "강원 관광지 "
        )}
        <strong className="text-teal-700">{places.length}곳</strong>
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
            {["남이섬", "설악산", "경포해변"].map((name) => (
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {places.map((place) => (
            <PlaceCard key={place.contentId} place={place} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
