/** 헤더 탭 활성 판정 — usePathname() 결과(쿼리 제외 경로)를 받는다 */
export type TabKey = "map" | "places" | "courses";

export function activeTab(pathname: string): TabKey | null {
  if (pathname === "/" || pathname === "/map") return "map";
  if (pathname === "/places" || pathname.startsWith("/places/")) return "places";
  if (pathname === "/courses" || pathname.startsWith("/courses/")) return "courses";
  return null;
}
