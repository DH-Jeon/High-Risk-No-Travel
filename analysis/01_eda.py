# -*- coding: utf-8 -*-
# 01_eda.py — gangwon.json 기초 EDA
# 목적: 위험 유형 분류 모델의 재료 파악 (분포, 결측, envType 분류 품질, 의료 거리)
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 30)
pd.set_option("display.unicode.east_asian_width", True)

ROOT = Path(__file__).resolve().parents[1] / "harinote"
DATA = ROOT / "src" / "data"

CONTENT_TYPE = {12: "관광지", 14: "문화시설", 39: "음식점"}
SIGUNGU = {
    1: "강릉시", 2: "고성군", 3: "동해시", 4: "삼척시", 5: "속초시", 6: "양구군",
    7: "양양군", 8: "영월군", 9: "원주시", 10: "인제군", 11: "정선군", 12: "철원군",
    13: "춘천시", 14: "태백시", 15: "평창군", 16: "홍천군", 17: "화천군", 18: "횡성군",
}

df = pd.DataFrame(json.loads((DATA / "gangwon.json").read_text(encoding="utf-8")))
hospitals = pd.DataFrame(json.loads((DATA / "hospitals.gangwon.json").read_text(encoding="utf-8")))

print("=" * 70)
print("[1] 기본 구조")
print("=" * 70)
print(f"관광지 수: {len(df)},  컬럼: {list(df.columns)}")
print(f"contentId 중복: {df.contentId.duplicated().sum()}")
print("\n콘텐츠 유형 분포:")
print(df.contentTypeId.map(CONTENT_TYPE).value_counts())

print("\n결측 현황:")
print(df.isna().sum()[lambda s: s > 0])

print("\n" + "=" * 70)
print("[2] 시군 분포 (sigunguCode)")
print("=" * 70)
sig = df.assign(sigungu=df.sigunguCode.map(SIGUNGU))
tab = pd.crosstab(sig.sigungu, df.contentTypeId.map(CONTENT_TYPE), margins=True)
print(tab)

# 주소 텍스트와 sigunguCode 정합성 검증
def addr_sigungu(addr: str):
    for name in SIGUNGU.values():
        if isinstance(addr, str) and name in addr:
            return name
    return None

sig["addr_sigungu"] = sig.addr.map(addr_sigungu)
mismatch = sig[(sig.addr_sigungu.notna()) & (sig.sigungu.notna()) & (sig.addr_sigungu != sig.sigungu)]
print(f"\n주소 vs sigunguCode 불일치: {len(mismatch)}건 / 주소에서 시군 판독 실패: {sig.addr_sigungu.isna().sum()}건")
if len(mismatch):
    print(mismatch[["title", "addr_sigungu", "sigungu"]].head(10).to_string())

print("\n" + "=" * 70)
print("[3] envType 분포 — 분류 모델의 사실상 사전(prior)")
print("=" * 70)
print(pd.crosstab(df.envType, df.contentTypeId.map(CONTENT_TYPE), margins=True))

# 관광지(12)만 — 유형 분류의 주 대상
attr = df[df.contentTypeId == 12].copy()
print(f"\n관광지({len(attr)}건)만의 envType 비율:")
print((attr.envType.value_counts(normalize=True) * 100).round(1).astype(str) + "%")

print("\n" + "=" * 70)
print("[4] TourAPI 카테고리 커버리지 (cat1~3)")
print("=" * 70)
for c in ["cat1", "cat2", "cat3"]:
    print(f"{c}: 결측 {df[c].isna().sum()}건 ({df[c].isna().mean()*100:.1f}%), 고유값 {df[c].nunique()}개")
print("\n관광지 cat3 상위 15:")
print(attr.cat3.value_counts().head(15))

print("\n" + "=" * 70)
print("[5] envType 휴리스틱 품질 점검 — 키워드 vs 분류 결과")
print("=" * 70)
# 명칭에 유형 키워드가 있는데 다른 유형으로 분류된 사례
checks = {
    "계곡|폭포|호수|저수지|댐": "outdoor_water",
    "해수욕장|해변|해안|항구|등대": "outdoor_coast",
    "산$|봉$|휴양림|국립공원": "outdoor_mountain",
    "박물관|미술관|전시|기념관|체험관": "indoor",
}
for pat, expected in checks.items():
    hit = attr[attr.title.str.contains(pat, regex=True, na=False)]
    bad = hit[hit.envType != expected]
    print(f"'{pat}' → {expected}: {len(hit)}건 중 다른 분류 {len(bad)}건 ({len(bad)/max(len(hit),1)*100:.0f}%)")
    if len(bad):
        print("   예시: " + ", ".join(f"{t}({e})" for t, e in bad[["title", "envType"]].head(5).values))

print("\n" + "=" * 70)
print("[6] 응급의료 거리 — 관광지별 최근접 병원 (Haversine)")
print("=" * 70)
print(f"병원 수: {len(hospitals)}, 컬럼: {list(hospitals.columns)}")

def haversine_matrix(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp = p2[None, :] - p1[:, None]
    dl = np.radians(lng2)[None, :] - np.radians(lng1)[:, None]
    a = np.sin(dp / 2) ** 2 + np.cos(p1)[:, None] * np.cos(p2)[None, :] * np.sin(dl / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))

dist = haversine_matrix(df.lat.values, df.lng.values, hospitals.lat.values, hospitals.lng.values)
df["er_km"] = dist.min(axis=1)
print("\n최근접 응급의료기관 거리(km) 분위수:")
print(df.er_km.describe(percentiles=[0.1, 0.25, 0.5, 0.75, 0.9, 0.95]).round(1))

# 점수 엔진 감점 구간(10/20/30km) 기준 분포
bins = pd.cut(df.er_km, [0, 10, 20, 30, np.inf], labels=["~10km(0~2점)", "10~20(2~5점)", "20~30(5~10점)", "30km+(10점)"])
print("\n의료 감점 구간 분포:")
print(bins.value_counts().sort_index())

print("\n시군별 의료 거리 중앙값 상위 (취약 순):")
med = df.assign(sigungu=df.sigunguCode.map(SIGUNGU)).groupby("sigungu").er_km.agg(["median", "max", "count"])
print(med.sort_values("median", ascending=False).round(1).head(8))

print("\n의료 최취약 관광지 TOP 5:")
print(df.nlargest(5, "er_km")[["title", "addr", "er_km"]].round(1).to_string(index=False))

print("\n" + "=" * 70)
print("[7] 좌표 위생 — 강원 범위 밖 이상치")
print("=" * 70)
# 강원 대략 bbox: lat 37.0~38.7, lng 127.0~129.5
out = df[(df.lat < 37.0) | (df.lat > 38.7) | (df.lng < 127.0) | (df.lng > 129.5)]
print(f"bbox 밖: {len(out)}건")
if len(out):
    print(out[["title", "addr", "lat", "lng"]].head(10).to_string(index=False))
zero = df[(df.lat == 0) | (df.lng == 0)]
print(f"좌표 0: {len(zero)}건")

# 유형 분류 재료로 쓸 파생 요약 저장
df.assign(sigungu=df.sigunguCode.map(SIGUNGU)).to_parquet(Path(__file__).parent / "places_eda.parquet")
print("\n저장: analysis/places_eda.parquet (er_km 파생 포함)")
