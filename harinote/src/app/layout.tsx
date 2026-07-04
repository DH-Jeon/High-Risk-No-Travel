import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import NavTabs from "@/components/NavTabs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "하리노트 — 강원 가족여행 안전 확인",
    template: "%s | 하리노트",
  },
  description:
    "오늘, 이 강원 관광지 가도 될까? 기상·재난·의료·이동 공공데이터로 관광지별 방문 주의 요인을 점수로 확인하는 가족 여행 안전 확인 서비스입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-stretch justify-between px-4">
            <Link
              href="/"
              className="flex items-center gap-2 self-center"
              aria-label="하리노트 홈으로"
            >
              <Logo className="h-7 w-7" />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                하리노트
              </span>
              <span className="hidden text-xs font-medium text-slate-400 sm:inline">
                HARI-NOTE · High Risk, No Travel
              </span>
            </Link>
            <NavTabs />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-3 px-4 py-8 text-sm text-slate-500">
            <p className="font-semibold text-slate-700">
              하리노트 · 팀 새벽코딩 — 2026 관광데이터 활용 공모전
            </p>
            <p>
              데이터 출처: 한국관광공사 TourAPI · 기상청 · AirKorea(한국환경공단)
              · 산림청 · 보건복지부 · 행정안전부
            </p>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
              본 서비스의 안전 점수는 공공데이터 기반 참고 정보이며 안전을
              보장하지 않습니다. 실제 방문 전 기상특보·현지 안내를 반드시
              확인하세요.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
