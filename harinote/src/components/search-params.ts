/** URL 쿼리 파라미터 파싱 유틸 — UI 전용 */
import { PROFILE_LABEL, type Profile } from "@/lib/safety/types";
import { SIGUNGU_SEATS } from "@/lib/risk/regions";
import {
  SUPPORTED_CONTENT_TYPE_IDS,
  type ContentTypeId,
} from "@/lib/tour/types";

export type SearchParamValue = string | string[] | undefined;

export function first(v: SearchParamValue): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseProfile(v: SearchParamValue): Profile {
  const s = first(v);
  return s && s in PROFILE_LABEL ? (s as Profile) : "default";
}

export function parseContentTypeId(
  v: SearchParamValue,
): ContentTypeId | undefined {
  const n = Number(first(v));
  return (SUPPORTED_CONTENT_TYPE_IDS as readonly number[]).includes(n)
    ? (n as ContentTypeId)
    : undefined;
}

/** 강원 시군구 코드 파싱 — SIGUNGU_SEATS에 있는 코드(1~18)만 허용 */
export function parseSigungu(v: SearchParamValue): number | undefined {
  const n = Number(first(v));
  return n in SIGUNGU_SEATS ? n : undefined;
}

/** 페이지 번호 파싱 — 1 이상의 정수만 허용, 잘못된 값은 1 */
export function parsePage(v: SearchParamValue): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 빈 값(undefined, "")을 제외하고 쿼리스트링 생성 ("?q=..&profile=.." 또는 "") */
export function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (val !== undefined && val !== "") sp.set(k, String(val));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** profile=default는 URL에서 생략 */
export function profileParam(profile: Profile): string | undefined {
  return profile === "default" ? undefined : profile;
}
