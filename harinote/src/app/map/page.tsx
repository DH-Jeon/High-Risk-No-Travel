import { redirect } from "next/navigation";

/** 안전지도가 홈(/)으로 승격됨 — 기존 링크·북마크 보존용 redirect */
export default function MapPage() {
  redirect("/");
}
