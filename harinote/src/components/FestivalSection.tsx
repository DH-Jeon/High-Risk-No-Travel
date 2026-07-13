/**
 * "이날 열리는 축제" — TourAPI searchFestival2 실시간 (서버 컴포넌트, Suspense 대상).
 * 등록된 축제가 없으면 섹션 자체를 렌더하지 않는다 (축제는 개최 임박 시점에 등록되는
 * 데이터라 비수기엔 0건이 정상 — lib/tour/festival.ts 주석 참고).
 */
import Image from "next/image";
import type { Profile } from "@/lib/safety/types";
import { fetchGangwonFestivals, type Festival } from "@/lib/tour/festival";
import { getSpotSafety } from "@/lib/datasource";
import { formatKoreanDate } from "@/lib/date";
import SafetyScoreBadge from "@/components/SafetyScoreBadge";

/** YYYYMMDD → "M.D" */
function md(ymd: string): string {
  return `${Number(ymd.slice(4, 6))}.${Number(ymd.slice(6, 8))}`;
}

const MAX_UPCOMING = 4;

async function FestivalCard({
  festival,
  profile,
  dateISO,
}: {
  festival: Festival;
  profile: Profile;
  dateISO?: string;
}) {
  // 축제 장소 좌표가 있으면 그 지점의 안전 점수도 함께 (야외 행사 기준)
  const safety =
    festival.lat !== undefined && festival.lng !== undefined
      ? await getSpotSafety(
          {
            contentId: festival.contentId,
            envType: "outdoor_general",
            sigunguCode: festival.sigunguCode,
            lat: festival.lat,
            lng: festival.lng,
          },
          profile,
          dateISO,
        )
      : null;

  return (
    <a
      href={`https://search.naver.com/search.naver?query=${encodeURIComponent(festival.title)}`}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition-shadow hover:shadow-lg hover:ring-amber-300"
    >
      <div className="relative h-28 overflow-hidden bg-gradient-to-br from-amber-100 to-orange-200">
        {festival.imageUrl && (
          <Image
            src={festival.imageUrl}
            alt={festival.title}
            fill
            sizes="(max-width: 640px) 100vw, 280px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span
          className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm ${
            festival.ongoing
              ? "bg-amber-500 text-white"
              : "bg-white/90 text-slate-700"
          }`}
        >
          {festival.ongoing ? "진행 중" : `${md(festival.start)} 시작`}
        </span>
      </div>
      <div className="space-y-1.5 p-3.5">
        <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-amber-700">
          {festival.title}
        </h3>
        <p className="truncate text-xs text-slate-500">
          {md(festival.start)}~{md(festival.end)}
          {festival.addr && ` · ${festival.addr}`}
        </p>
        {safety && <SafetyScoreBadge score={safety.score} grade={safety.grade} />}
      </div>
    </a>
  );
}

export default async function FestivalSection({
  dateISO,
  profile,
}: {
  dateISO?: string;
  profile: Profile;
}) {
  const festivals = await fetchGangwonFestivals(dateISO);
  if (festivals.length === 0) return null;

  const ongoing = festivals.filter((f) => f.ongoing);
  const upcoming = festivals.filter((f) => !f.ongoing).slice(0, MAX_UPCOMING);
  const show = [...ongoing, ...upcoming];
  const dateLabel = dateISO ? formatKoreanDate(dateISO) : "지금";

  return (
    <section className="mt-8" aria-label="축제·행사">
      <h2 className="text-lg font-bold text-slate-900">
        🎪 {dateLabel} 열리는 축제
        {ongoing.length === 0 && upcoming.length > 0 && " · 다가오는 축제"}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        한국관광공사 등록 축제입니다. 카드를 누르면 자세히 볼 수 있어요.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {show.map((f) => (
          <FestivalCard
            key={f.contentId}
            festival={f}
            profile={profile}
            dateISO={dateISO}
          />
        ))}
      </div>
    </section>
  );
}
