"use client";

import { useEffect, useRef, useState } from "react";

/** 출발 전 체크 리포트 액션 — 인쇄·링크 복사 (인쇄물에는 print:hidden으로 미포함) */
export default function ReportActions() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한 거부 시 사용자가 주소창에서 직접 복사하도록 둔다
    }
  }

  return (
    <div className="flex gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
      >
        <span aria-hidden="true">🖨️</span> 인쇄
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition-colors hover:bg-teal-50"
      >
        <span aria-hidden="true">🔗</span> {copied ? "복사됨!" : "링크 복사"}
      </button>
    </div>
  );
}
