import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-5xl" aria-hidden="true">
        🗺️
      </p>
      <h1 className="mt-5 text-2xl font-extrabold text-slate-900">
        페이지를 찾을 수 없어요
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        주소가 잘못되었거나, 아직 등록되지 않은 관광지예요.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-teal-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-700"
        >
          홈으로
        </Link>
        <Link
          href="/places"
          className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
        >
          관광지 찾기
        </Link>
      </div>
    </div>
  );
}
