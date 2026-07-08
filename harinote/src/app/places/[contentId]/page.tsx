import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlaceWithSafety, getPlacesWithSafety } from "@/lib/datasource";
import { CONTENT_TYPE_LABEL, ENV_TYPE_LABEL } from "@/lib/tour/types";
import { PROFILE_LABEL, RISK_CATEGORY_LABELS } from "@/lib/safety/types";
import { Suspense } from "react";
import { recommendAlternatives } from "@/lib/reco/alternatives";
import { buildHalfDayCourse } from "@/lib/course/half-day";
import CourseTimeline from "@/components/CourseTimeline";
import PlaceCard from "@/components/PlaceCard";
import PlaceGallery from "@/components/PlaceGallery";
import PlaceMap from "@/components/PlaceMap";
import { GallerySection, ReviewsSection } from "./sections";
import ProfileChips from "@/components/ProfileChips";
import RiskBreakdownBar from "@/components/RiskBreakdownBar";
import RiskTypeBadge from "@/components/RiskTypeBadge";
import SafetyScoreBadge from "@/components/SafetyScoreBadge";
import {
  parseProfile,
  profileParam,
  buildQuery,
  type SearchParamValue,
} from "@/components/search-params";

interface Props {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<Record<string, SearchParamValue>>;
}

function parseContentId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const contentId = parseContentId((await params).contentId);
  if (contentId === null) return { title: "관광지 상세" };
  const place = await getPlaceWithSafety(contentId);
  return { title: place ? `${place.title} 안전 점수` : "관광지 상세" };
}

export default async function PlaceDetailPage({ params, searchParams }: Props) {
  const [{ contentId: rawId }, sp] = await Promise.all([params, searchParams]);
  const contentId = parseContentId(rawId);
  if (contentId === null) notFound();

  const profile = parseProfile(sp.profile);
  const place = await getPlaceWithSafety(contentId, profile);
  if (!place) notFound();

  const { safety } = place;

  // 대체지 추천: 전체 후보(요청 스코프 캐시로 재로드 비용 없음)에서 30km 이내 더 안전한 곳.
  // 사진 갤러리(detailImage2)·후기(네이버)는 느린 외부 API라 Suspense로 스트리밍한다.
  const candidates = await getPlacesWithSafety(undefined, profile);

  const alternatives = recommendAlternatives(place, candidates);

  // 안전 반나절 코스: 앵커(target 또는 대체지 1순위) + 음식점 + 관광지·문화시설
  const course = buildHalfDayCourse(place, alternatives, candidates);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href={`/places${buildQuery({ profile: profileParam(profile) })}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition-colors hover:text-teal-700"
      >
        <span aria-hidden="true">←</span> 목록으로
      </Link>

      {/* ── 히어로: 좌 갤러리 · 우 제목·점수·프로필 ── */}
      <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
        {/* 좌: 사진 갤러리 — 대표사진 즉시, detailImage2 추가 사진은 스트리밍 */}
        <Suspense
          fallback={
            <PlaceGallery
              title={place.title}
              envType={place.envType}
              images={place.imageUrl ? [place.imageUrl] : []}
            />
          }
        >
          <GallerySection
            contentId={contentId}
            title={place.title}
            envType={place.envType}
            imageUrl={place.imageUrl}
          />
        </Suspense>

        {/* 우: 제목·주소·뱃지 + 안전 점수 + 프로필 */}
        <div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700 ring-1 ring-teal-200">
              {CONTENT_TYPE_LABEL[place.contentTypeId]}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {ENV_TYPE_LABEL[place.envType]}
            </span>
            <RiskTypeBadge contentId={place.contentId} />
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {place.title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
            {place.addr}
            {place.tel && (
              <span className="ml-2 text-slate-400">{place.tel}</span>
            )}
          </p>

          <div className="mt-6">
            <SafetyScoreBadge
              score={safety.score}
              grade={safety.grade}
              size="lg"
            />
            <Link
              href={`/places/${place.contentId}/report${buildQuery({ profile: profileParam(profile) })}`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition-colors hover:bg-teal-100"
            >
              <span aria-hidden="true">📋</span> 출발 전 체크 리포트
            </Link>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-slate-600">
                동행에 따라 점수가 달라져요 —{" "}
                <strong className="text-teal-700">
                  {PROFILE_LABEL[profile]} 기준
                </strong>
              </p>
              <ProfileChips
                basePath={`/places/${place.contentId}`}
                current={profile}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문: 좌 안전 분석 · 우 주변·행동 ── */}
      <div className="mt-8 grid items-start gap-x-6 gap-y-8 lg:grid-cols-2">
        {/* 좌 컬럼: 왜 이 점수인가 (분석) */}
        <div className="space-y-8">
          {/* 카테고리 소계 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900">분야별 감점 요약</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RISK_CATEGORY_LABELS.map((c) => {
                const points = safety[c.key];
                return (
                  <div
                    key={c.key}
                    className="rounded-xl bg-white p-4 text-center ring-1 ring-slate-200"
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {c.icon}
                    </span>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {c.label}
                    </p>
                    <p
                      className={`text-lg font-extrabold tabular-nums ${
                        points > 0 ? "text-slate-800" : "text-slate-300"
                      }`}
                    >
                      −{points}점
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 요인별 상세 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900">왜 이 점수인가요?</h2>
            <div className="mt-3">
              <RiskBreakdownBar factors={safety.factors} />
            </div>
          </section>

          {/* 소개 */}
          {place.overview && (
            <section>
              <h2 className="text-lg font-bold text-slate-900">소개</h2>
              <p className="mt-2 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
                {place.overview}
              </p>
            </section>
          )}

          {/* 안전한 대체지 추천 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900">안전한 대체지 추천</h2>
            <p className="mt-1 text-sm text-slate-500">
              같은 유형의 더 안전한 주변 관광지예요 (30km 이내)
            </p>
            {alternatives.length === 0 ? (
              <div className="mt-3 rounded-2xl bg-teal-50/50 px-6 py-10 text-center ring-1 ring-teal-100">
                <p className="text-3xl" aria-hidden="true">
                  🧭
                </p>
                <p className="mt-3 font-bold text-slate-700">
                  이 관광지는 주변 대비 이미 주의 요인이 낮은 편이에요
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  30km 이내에서 안전 점수가 의미 있게 더 높은 관광지를 찾지
                  못했어요.
                </p>
                <Link
                  href={`/places${buildQuery({ profile: profileParam(profile) })}`}
                  className="mt-4 inline-block rounded-full bg-teal-50 px-4 py-1.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition-colors hover:bg-teal-100"
                >
                  다른 관광지 둘러보기
                </Link>
              </div>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {alternatives.map((alt) => (
                  <PlaceCard
                    key={alt.contentId}
                    place={alt}
                    profile={profile}
                    footer={
                      <p className="text-xs font-semibold text-teal-700">
                        {alt.distanceKm.toFixed(1)}km · 안전점수 +
                        {alt.safety.score - safety.score}점
                      </p>
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 우 컬럼: 그래서 어디로·무엇을 (행동) */}
        <div className="space-y-8">
          {/* 위치 지도 */}
          <section>
            <h2 className="text-lg font-bold text-slate-900">위치 보기</h2>
            <p className="mb-3 mt-1 text-sm text-slate-500">
              <span className="font-semibold text-teal-800">●</span> 현재 관광지
              {alternatives.length > 0 && (
                <>
                  {" · "}
                  <span className="font-semibold text-emerald-500">●</span> 더
                  안전한 대체지
                </>
              )}
            </p>
            <PlaceMap
              target={{
                contentId: place.contentId,
                title: place.title,
                lat: place.lat,
                lng: place.lng,
                score: safety.score,
              }}
              alternatives={alternatives.map((alt) => ({
                contentId: alt.contentId,
                title: alt.title,
                lat: alt.lat,
                lng: alt.lng,
                score: alt.safety.score,
                distanceKm: alt.distanceKm,
              }))}
              profileQuery={buildQuery({ profile: profileParam(profile) })}
            />
          </section>

          {/* 추천 반나절 코스 */}
          {course && (
            <section>
              <h2 className="text-lg font-bold text-slate-900">추천 반나절 코스</h2>
              <p className="mt-1 text-sm text-slate-500">
                {course.anchoredOnAlternative
                  ? `오늘은 ${place.title} 대신 더 안전한 코스를 추천해요`
                  : `${place.title}에서 시작하는 안전 코스예요`}
              </p>
              <CourseTimeline course={course} profile={profile} />
            </section>
          )}

          {/* 방문 후기 — 네이버 블로그 검색 (스트리밍, 후기 없으면 섹션 숨김) */}
          <Suspense fallback={null}>
            <ReviewsSection title={place.title} />
          </Suspense>
        </div>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-slate-400">
        본 점수는 공공데이터 기반 참고 정보이며 안전을 보장하지 않습니다. 방문
        전 기상특보와 현지 안내를 확인하세요.
      </p>
    </div>
  );
}
