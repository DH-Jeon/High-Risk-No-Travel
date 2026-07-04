/**
 * 인기 관광지 큐레이션 — /places 사이드바 "인기 관광지 TOP 10"
 *
 * 선정 기준:
 * - 강원 대표 관광지 수동 큐레이션 (에디터 선정, 조회수 집계 아님)
 * - 시군 분산: 속초·춘천·강릉·동해·양양·평창
 * - 모든 contentId는 src/data/gangwon.json 실존 검증 완료 (title 대조)
 */

export interface CuratedEntry {
  contentId: number;
  blurb: string;
}

export const CURATED_PLACES: CuratedEntry[] = [
  { contentId: 128788, blurb: "설악산 권금성까지 단숨에 오르는 케이블카" }, // 설악산 케이블카 (속초)
  { contentId: 125707, blurb: "설악산을 등지고 펼쳐진 속초의 대표 해변" }, // 속초해수욕장 (속초)
  { contentId: 251738, blurb: "갯배 타고 건너가는 실향민 마을과 아바이순대" }, // 아바이마을 (속초)
  { contentId: 2396037, blurb: "소양강 위를 걷는 174m 투명 바닥 스카이워크" }, // 소양강스카이워크 (춘천)
  { contentId: 2814588, blurb: "의암호 위를 가로지르는 국내 최장 호수 케이블카" }, // 춘천 삼악산 호수케이블카 (춘천)
  { contentId: 3545967, blurb: "기차역에서 바로 만나는 해돋이 명소" }, // 정동진 (강릉)
  { contentId: 2804197, blurb: "빛과 소리로 채운 강릉의 몰입형 미디어아트" }, // 아르떼뮤지엄 강릉 (강릉)
  { contentId: 129000, blurb: "애국가 일출 장면으로 유명한 동해 바위 절경" }, // 추암 촛대바위 (동해)
  { contentId: 125795, blurb: "낙산사 절벽 끝에서 바다를 내려다보는 정자" }, // 낙산사 의상대 (양양)
  { contentId: 1949976, blurb: "해발 1,100m 초원에서 양떼를 만나는 목장" }, // 대관령 하늘목장 (평창)
];
