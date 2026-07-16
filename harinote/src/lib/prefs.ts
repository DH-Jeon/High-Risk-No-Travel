/**
 * 사용자 조건 기억 — 쿠키 기반 (서버 전용 읽기).
 * 첫 화면에서 고른 동행/이동수단을 저장해 다음 방문의 기본값으로 쓴다.
 * URL 파라미터가 있으면 항상 그것이 우선 (쿠키는 폴백).
 */
import { cookies } from "next/headers";
import { PROFILE_LABEL, type Profile } from "@/lib/safety/types";

export type Transport = "transit" | "car";

export const PREF_COOKIE = {
  profile: "hari_profile",
  transport: "hari_transport",
} as const;

export async function savedProfile(): Promise<Profile | undefined> {
  const v = (await cookies()).get(PREF_COOKIE.profile)?.value;
  return v && v in PROFILE_LABEL ? (v as Profile) : undefined;
}

export async function savedTransport(): Promise<Transport | undefined> {
  const v = (await cookies()).get(PREF_COOKIE.transport)?.value;
  return v === "car" || v === "transit" ? v : undefined;
}
