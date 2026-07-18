import type { Metadata } from "next";
import SavedPlansList from "@/components/SavedPlansList";

export const metadata: Metadata = {
  title: "내 여행",
};

/** 저장된 여행 계획 목록 — 데이터는 전부 localStorage(클라이언트)라 서버 로직 없음 */
export default function PlansPage() {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-8 lg:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
        내 여행
      </h1>
      <p className="mt-2 text-sm text-slate-500 sm:text-base">
        저장한 여행 계획을 확인하고, 불러와서 이어서 수정할 수 있어요.
      </p>
      <div className="mt-6">
        <SavedPlansList />
      </div>
    </div>
  );
}
