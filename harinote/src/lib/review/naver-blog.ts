/**
 * 네이버 블로그 검색 API — 관광지 방문 후기 조회. 서버 전용.
 * https://openapi.naver.com/v1/search/blog.json (무료 일 25,000회)
 *
 * 안정성 계약 (risk/live.ts와 동일 원칙):
 * - NAVER_CLIENT_ID/SECRET이 없으면 네트워크 호출 없이 빈 배열 → 후기 섹션 숨김
 * - 호출 실패도 throw 없이 빈 배열 (화면이 죽으면 안 됨)
 * - 검색어당 1시간 프로미스 캐시, 실패는 5분 뒤 재시도
 *
 * 약관 범위: 검색 결과의 제목·요약·링크 노출 및 원문 이동 — 본문 전재 금지.
 */
import { z } from "zod";
import { createTtlCache } from "@/lib/risk/cache";

const BASE_URL = "https://openapi.naver.com/v1/search/blog.json";

/** 상세 페이지에 노출할 후기 수 */
export const BLOG_REVIEW_COUNT = 4;

export interface BlogReview {
  title: string;
  summary: string;
  link: string;
  blogger: string;
  /** "2026.07.01" — 원본 postdate가 YYYYMMDD가 아니면 없음 */
  postDate?: string;
}

export function hasNaverKeys(): boolean {
  return Boolean(
    process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET,
  );
}

/** 검색어 강조 태그(<b>)·HTML 엔티티 제거 — API가 제목·요약에 섞어 보낸다 */
export function cleanNaverText(s: string): string {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** "20260701" → "2026.07.01" */
export function formatPostdate(s: string | undefined): string | undefined {
  if (!s || !/^\d{8}$/.test(s)) return undefined;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

const blogItemSchema = z.looseObject({
  title: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  bloggername: z.string().optional(),
  postdate: z.string().optional(),
});

const blogResponseSchema = z.looseObject({
  items: z.array(blogItemSchema),
});

/** 검색 API 응답 JSON → BlogReview[] (제목·링크 없는 항목 제외) */
export function toBlogReviews(json: unknown): BlogReview[] {
  const parsed = blogResponseSchema.safeParse(json);
  if (!parsed.success) return [];

  const reviews: BlogReview[] = [];
  for (const item of parsed.data.items) {
    const title = cleanNaverText(item.title ?? "").trim();
    const link = item.link ?? "";
    if (!title || !/^https?:\/\//.test(link)) continue;
    const postDate = formatPostdate(item.postdate);
    reviews.push({
      title,
      link,
      summary: cleanNaverText(item.description ?? "").trim(),
      blogger: item.bloggername ?? "",
      ...(postDate ? { postDate } : {}),
    });
  }
  return reviews;
}

const cache = createTtlCache<BlogReview[]>(60 * 60 * 1000, 5 * 60 * 1000);

export async function fetchBlogReviews(query: string): Promise<BlogReview[]> {
  if (!hasNaverKeys()) return [];

  try {
    return await cache.get(query, async () => {
      const params = new URLSearchParams({
        query,
        display: String(BLOG_REVIEW_COUNT),
        sort: "sim",
      });
      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: {
          "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID!,
          "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET!,
        },
      });
      if (!res.ok) throw new Error(`naver blog search HTTP ${res.status}`);
      return toBlogReviews(await res.json());
    });
  } catch {
    return [];
  }
}
