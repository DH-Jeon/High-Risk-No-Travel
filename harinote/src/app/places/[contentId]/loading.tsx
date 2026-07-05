/** 관광지 상세 로딩 스켈레톤 — 서버 렌더 대기 중 즉시 표시해 전환 체감 속도 개선 */
export default function PlaceDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 py-8">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="mt-4 h-8 w-64 rounded-lg bg-slate-200" />
      <div className="mt-3 h-5 w-40 rounded-full bg-slate-100" />
      <div className="mt-6 h-52 rounded-2xl bg-white ring-1 ring-slate-100" />
      <div className="mt-4 h-40 rounded-2xl bg-white ring-1 ring-slate-100" />
      <div className="mt-4 h-64 rounded-2xl bg-white ring-1 ring-slate-100" />
    </div>
  );
}
