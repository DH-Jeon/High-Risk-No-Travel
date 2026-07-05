/** /places 로딩 스켈레톤 — 서버 렌더 대기 중 즉시 표시해 전환 체감 속도 개선 */
export default function PlacesLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
      <div>
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="mt-3 h-4 w-72 rounded bg-slate-100" />
        <div className="mt-6 h-12 w-full max-w-xl rounded-2xl bg-slate-100" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white ring-1 ring-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="mt-8 h-96 rounded-2xl bg-white ring-1 ring-slate-100 lg:mt-0" />
    </div>
  );
}
