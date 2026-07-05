/** /courses 로딩 스켈레톤 — 서버 렌더 대기 중 즉시 표시해 전환 체감 속도 개선 */
export default function CoursesLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="mt-3 h-4 w-80 rounded bg-slate-100" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="h-[420px] rounded-2xl bg-white ring-1 ring-slate-100"
          />
        ))}
      </div>
    </div>
  );
}
