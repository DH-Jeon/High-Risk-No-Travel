"use client";

import { useEffect } from "react";
import type { Profile } from "@/lib/safety/types";
import type { Transport } from "@/lib/prefs";

const YEAR = 60 * 60 * 24 * 365;

/** 현재 화면의 동행/이동수단 선택을 쿠키로 기억 — 다음 방문의 기본값 */
export default function PrefsPersist({
  profile,
  transport,
}: {
  profile: Profile;
  transport: Transport;
}) {
  useEffect(() => {
    document.cookie = `hari_profile=${profile}; path=/; max-age=${YEAR}; samesite=lax`;
    document.cookie = `hari_transport=${transport}; path=/; max-age=${YEAR}; samesite=lax`;
  }, [profile, transport]);
  return null;
}
