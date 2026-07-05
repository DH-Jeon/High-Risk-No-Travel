/**
 * 상세 페이지의 외부 API 의존 섹션 — Suspense로 스트리밍해 페이지 본문을 블로킹하지 않는다.
 * - GallerySection: detailImage2 추가 사진 조회 (fallback은 대표사진만으로 즉시 렌더)
 * - ReviewsSection: 네이버 블로그 후기 조회 (fallback은 없음 — 준비되면 나타남)
 * TourAPI 게이트웨이가 느려도(초 단위 편차) 점수·대체지 등 본문은 즉시 뜬다.
 */
import type { PlaceEnvType } from "@/lib/tour/types";
import { fetchPlaceImages } from "@/lib/tour/images";
import { fetchBlogReviews } from "@/lib/review/naver-blog";
import PlaceGallery from "@/components/PlaceGallery";
import BlogReviews from "@/components/BlogReviews";

/** 대표사진(imageUrl) + detailImage2 실사진을 합치고 중복 제거 — 대표사진 우선 */
export async function GallerySection({
  contentId,
  title,
  envType,
  imageUrl,
}: {
  contentId: number;
  title: string;
  envType: PlaceEnvType;
  imageUrl?: string;
}) {
  const detailImages = await fetchPlaceImages(contentId);
  const images = [
    ...(imageUrl ? [imageUrl] : []),
    ...detailImages.filter((url) => url !== imageUrl),
  ];
  return <PlaceGallery title={title} envType={envType} images={images} />;
}

export async function ReviewsSection({ title }: { title: string }) {
  const reviews = await fetchBlogReviews(title);
  if (reviews.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900">방문 후기</h2>
      <p className="mt-1 text-sm text-slate-500">
        네이버 블로그에서 <strong>{title}</strong> 방문기를 모았어요. 카드를
        누르면 원문으로 이동해요.
      </p>
      <BlogReviews reviews={reviews} />
    </section>
  );
}
