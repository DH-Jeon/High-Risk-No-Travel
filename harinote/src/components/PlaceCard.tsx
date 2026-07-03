import Link from "next/link";
import type { PlaceWithSafety } from "@/lib/datasource";
import type { PlaceEnvType } from "@/lib/tour/types";
import { CONTENT_TYPE_LABEL, ENV_TYPE_LABEL } from "@/lib/tour/types";
import type { Profile } from "@/lib/safety/types";
import SafetyScoreBadge from "@/components/SafetyScoreBadge";
import { buildQuery, profileParam } from "@/components/search-params";

/** imageUrl 없는 관광지의 플레이스홀더 — 환경 유형별 이모지·그라데이션 */
const ENV_PLACEHOLDER: Record<PlaceEnvType, { emoji: string; bg: string }> = {
  indoor: { emoji: "🏛️", bg: "from-violet-100 to-indigo-200" },
  outdoor_water: { emoji: "🏞️", bg: "from-teal-100 to-cyan-200" },
  outdoor_mountain: { emoji: "⛰️", bg: "from-emerald-100 to-green-200" },
  outdoor_coast: { emoji: "🌊", bg: "from-sky-100 to-blue-200" },
  outdoor_general: { emoji: "🌳", bg: "from-lime-100 to-emerald-200" },
};

interface Props {
  place: PlaceWithSafety;
  profile: Profile;
  /** 카드 하단 추가 정보 (예: 대체지 추천의 거리·점수 비교) */
  footer?: React.ReactNode;
}

export default function PlaceCard({ place, profile, footer }: Props) {
  const ph = ENV_PLACEHOLDER[place.envType];
  const href = `/places/${place.contentId}${buildQuery({ profile: profileParam(profile) })}`;

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-teal-300"
    >
      <div className="relative h-40 overflow-hidden">
        {place.imageUrl ? (
          // TourAPI 외부 이미지 — next/image remotePatterns 설정 없이 표시
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.imageUrl}
            alt={place.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${ph.bg}`}
          >
            <span className="text-5xl" aria-hidden="true">
              {ph.emoji}
            </span>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm">
            {CONTENT_TYPE_LABEL[place.contentTypeId]}
          </span>
          <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {ENV_TYPE_LABEL[place.envType]}
          </span>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-teal-700">
          {place.title}
        </h3>
        <p className="truncate text-sm text-slate-500">{place.addr}</p>
        <SafetyScoreBadge score={place.safety.score} grade={place.safety.grade} />
        {footer}
      </div>
    </Link>
  );
}
