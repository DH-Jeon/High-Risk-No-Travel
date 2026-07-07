# -*- coding: utf-8 -*-
# 03_build_codebook.py — 공식 서비스분류코드 파싱 → 코드북 CSV + 피처 테이블 병합
# 입력: data/서비스분류코드_v4.2.xlsx (공모전 공식 배포), data/elevation.json
# 출력: data/cat_codebook.csv, places_features.parquet
import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
DATA = HERE / "data"

# ── 1. 코드북 파싱 (영문 시트에 국문 분류명 포함) ──
raw = pd.read_excel(DATA / "서비스분류코드_v4.2.xlsx", sheet_name="영문", header=None, skiprows=4)
cb = raw.iloc[:, 1:7].copy()
cb.columns = ["cat1", "cat2", "cat3", "cat1_name", "cat2_name", "cat3_name"]
cb = cb.dropna(subset=["cat3"]).drop_duplicates(subset=["cat3"])
# 병합 셀로 인한 결측은 위 값으로 전파
cb[["cat1", "cat2", "cat1_name", "cat2_name"]] = cb[["cat1", "cat2", "cat1_name", "cat2_name"]].ffill()
cb.to_csv(DATA / "cat_codebook.csv", index=False, encoding="utf-8-sig")
print(f"[1] 코드북: cat3 {len(cb)}개 (cat1 {cb.cat1.nunique()}, cat2 {cb.cat2.nunique()})")

# ── 2. 관광지 데이터에 조인 + 커버리지 확인 ──
df = pd.read_parquet(HERE / "places_eda.parquet")
before = df.cat3.nunique()
df = df.merge(cb[["cat3", "cat1_name", "cat2_name", "cat3_name"]], on="cat3", how="left")
missing = df[df.cat3_name.isna()].cat3.unique()
print(f"[2] 조인: 데이터 cat3 {before}종 중 코드북 매칭 실패 {len(missing)}종 {list(missing)}")

# ── 3. 표고 병합 ──
elev = json.loads((DATA / "elevation.json").read_text(encoding="utf-8"))
df["elevation_m"] = df.contentId.astype(str).map(elev)
print(f"[3] 표고: 결측 {df.elevation_m.isna().sum()}건, 중앙값 {df.elevation_m.median():.0f}m")

df.to_parquet(HERE / "places_features.parquet")
print("저장: analysis/places_features.parquet")

# ── 4. 핵심 질문: outdoor_general 443건의 정체 ──
attr = df[df.contentTypeId == 12]
gen = attr[attr.envType == "outdoor_general"]
print(f"\n[4] 관광지 중 outdoor_general {len(gen)}건의 소분류 구성 (상위 20):")
comp = gen.groupby(["cat2_name", "cat3_name"]).size().sort_values(ascending=False)
print(comp.head(20).to_string())

print("\n[참고] outdoor_general의 표고 분포 vs 산악 분류:")
for et in ["outdoor_general", "outdoor_mountain"]:
    sub = attr[attr.envType == et].elevation_m
    print(f"  {et}: 중앙값 {sub.median():.0f}m, 90% {sub.quantile(0.9):.0f}m, 400m+ {(sub >= 400).sum()}건")
