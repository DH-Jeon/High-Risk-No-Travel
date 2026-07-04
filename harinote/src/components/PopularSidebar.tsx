import Link from "next/link";
import { getPlace } from "@/lib/datasource";
import { CURATED_PLACES, type CuratedEntry } from "@/lib/curation";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import type { Place, PlaceEnvType } from "@/lib/tour/types";
import type { Profile } from "@/lib/safety/types";
import { buildQuery, profileParam } from "@/components/search-params";

/** imageUrl 없는 관광지의 플레이스홀더 — PlaceCard와 동일한 환경 유형별 이모지·그라데이션 */
const ENV_PLACEHOLDER: Record<PlaceEnvType, { emoji: string; bg: string }> = {
  indoor: { emoji: "🏛️", bg: "from-violet-100 to-indigo-200" },
  outdoor_water: { emoji: "🏞️", bg: "from-teal-100 to-cyan-200" },
  outdoor_mountain: { emoji: "⛰️", bg: "from-emerald-100 to-green-200" },
  outdoor_coast: { emoji: "🌊", bg: "from-sky-100 to-blue-200" },
  outdoor_general: { emoji: "🌳", bg: "from-lime-100 to-emerald-200" },
};

interface Props {
  profile: Profile;
}

/**
 * 인기 관광지 TOP 10 사이드바 — 수동 큐레이션(lib/curation.ts).
 * 안전점수는 붙이지 않는다 (기상 API 부하 — 상세 페이지에서 표시).
 */
export default async function PopularSidebar({ profile }: Props) {
  const resolved = await Promise.all(
    CURATED_PLACES.map(async (entry) => ({
      entry,
      place: await getPlace(entry.contentId),
    })),
  );
  // 시딩 변경으로 사라진 관광지는 조용히 제외
  const items = resolved.filter(
    (r): r is { entry: CuratedEntry; place: Place } => r.place !== null,
  );

  if (items.length === 0) return null;

  return (
    <aside aria-label="인기 관광지">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-slate-900">
          인기 관광지 TOP 10
        </h2>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
          에디터 선정
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {items.map(({ entry, place }, i) => {
          const ph = ENV_PLACEHOLDER[place.envType];
          const sigungu = place.sigunguCode
            ? SIGUNGU_SEATS[place.sigunguCode]?.name
            : undefined;
          const href = `/places/${place.contentId}${buildQuery({ profile: profileParam(profile) })}`;
          return (
            <li key={place.contentId}>
              <Link
                href={href}
                className="group flex gap-3 rounded-xl bg-white p-2 ring-1 ring-slate-200 transition-shadow hover:shadow-md hover:ring-teal-300"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  {place.imageUrl ? (
                    // TourAPI 외부 이미지 — next/image remotePatterns 설정 없이 표시
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${ph.bg}`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {ph.emoji}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-0 top-0 rounded-br-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 group-hover:text-teal-700">
                    {place.title}
                    {sigungu && (
                      <span className="ml-1.5 text-xs font-medium text-slate-400">
                        {sigungu}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                    {entry.blurb}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
