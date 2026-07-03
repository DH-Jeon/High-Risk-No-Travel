/** 하리노트 심볼 — 방패 + 체크 (안전 확인 서비스) */
export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" fill="#0d9488" />
      <path
        d="M16 5.5l8.5 3.2v6.1c0 5.3-3.5 9.7-8.5 11.7-5-2-8.5-6.4-8.5-11.7V8.7L16 5.5z"
        fill="#ffffff"
        opacity="0.95"
      />
      <path
        d="M12.2 16.3l2.7 2.8 5.2-5.8"
        stroke="#0d9488"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
