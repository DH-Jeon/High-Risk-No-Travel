"use client";

import { useLinkStatus } from "next/link";

/**
 * Link 내부 라벨 래퍼 — 클릭 직후 내비게이션이 끝날 때까지 라벨을 흐리게 하고
 * 스피너를 겹쳐 보여준다. 서버 렌더가 오래 걸리는 쿼리 전환(코스 추천 등)에서
 * "눌렀는데 반응이 없다"는 느낌을 없애기 위한 즉시 피드백.
 * 스피너는 absolute 오버레이라 레이아웃이 흔들리지 않는다.
 */
export default function LinkLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-flex max-w-full items-center justify-center gap-1.5">
      <span
        className={`inline-flex min-w-0 items-center gap-1.5 transition-opacity ${
          pending ? "opacity-40" : ""
        }`}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className={`absolute h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent transition-opacity ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      />
    </span>
  );
}
