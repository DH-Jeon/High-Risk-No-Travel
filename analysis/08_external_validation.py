# -*- coding: utf-8 -*-
# 08_external_validation.py — 위험 유형(k=6)의 외부 검증: 강원 119 구조출동 데이터
# 검증 논리 (시군 단위 n=18, Spearman):
#  H1 오지성: 고지·오지형 비중 높은 시군일수록 119 출동→현장도착 시간이 길다
#  H2 자연사고: 산악+고지·오지형 비중이 높을수록 자연장소 사고 구성비가 높다
#  H3 수난: 수변+해안형 비중이 높을수록 수난사고 구성비가 높다
# 주의: 사고 '건수'는 방문객 수(노출)에 비례하므로 절대건수 대신 구성비·소요시간 사용
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

HERE = Path(__file__).parent
ACC = HERE / "data" / "accidents"

CLUSTER_NAME = {0: "근교전천후", 1: "실내", 2: "산악", 3: "고지오지", 4: "수변", 5: "해안"}

# ── 1. 사고 데이터 통합 (2021 일반 + 2022 관광지) ──
t = pd.read_csv(ACC / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv").assign(yr=2022)
a = pd.read_csv(ACC / "안전사고_0000" / "안전사고_0000.csv").assign(yr=2021)
acc = pd.concat([t, a], ignore_index=True)
acc = acc[acc.GRNDS_SGG_NM != "강원도"]
print(f"사고 레코드: {len(acc)}건 (시군 {acc.GRNDS_SGG_NM.nunique()}개)")

# ── 2. 사고 유형 그룹핑 (원인 × 장소) ──
TRAFFIC = {"운전자", "동승자", "보행자", "오토바이사고", "자전거사고", "기타탈것"}
WATER = {"익수", "물"}
NATURE_CAUSE = {"낙상", "추락", "열상", "동물/곤충", "온열손상", "한랭손상", "(구)온열손상"}

def classify(row):
    if row.ACDNT_CS_NM in WATER:
        return "수난"
    if row.ACDNT_CS_NM in TRAFFIC:
        return "교통"
    if row.ACDNT_CS_NM in NATURE_CAUSE and row.ACDNT_OCRN_PLC_NM == "바다/강/산/논밭":
        return "자연활동"
    if row.ACDNT_CS_NM in NATURE_CAUSE:
        return "낙상등_기타장소"
    return "기타"

acc["acc_type"] = acc.apply(classify, axis=1)
print("\n사고 유형 분포:")
print(acc.acc_type.value_counts().to_string())

# ── 3. 출동→현장도착 소요시간 (분) ──
def to_dt(d, prefix):
    return pd.to_datetime(dict(
        year=d[f"{prefix}_YR"], month=d[f"{prefix}_MM"], day=d[f"{prefix}_DAY"],
        hour=d[f"{prefix}_HR"], minute=d[f"{prefix}_MN"]), errors="coerce")

acc["resp_min"] = (to_dt(acc, "GRNDS_ARVL") - to_dt(acc, "DSPT")).dt.total_seconds() / 60
valid = acc.resp_min.between(0, 180)  # 자정 넘김·오기록 제외
print(f"\n소요시간 유효 {valid.sum()}건 — 중앙값 {acc.loc[valid, 'resp_min'].median():.0f}분, "
      f"90% {acc.loc[valid, 'resp_min'].quantile(0.9):.0f}분")

sig_acc = acc[valid].groupby("GRNDS_SGG_NM").agg(
    n=("resp_min", "size"), resp_med=("resp_min", "median")
)
comp = pd.crosstab(acc.GRNDS_SGG_NM, acc.acc_type, normalize="index")
sig_acc = sig_acc.join(comp[["자연활동", "수난"]].rename(
    columns={"자연활동": "share_nature", "수난": "share_water"}))

# ── 4. 시군별 위험 유형 구성 (우리 군집) ──
places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
places["type"] = places.k6.map(CLUSTER_NAME)
mix = pd.crosstab(places.sigungu, places.type, normalize="index")
mix = mix.join(places.groupby("sigungu").er_km.median().rename("er_km_med"))

m = sig_acc.join(mix, how="inner")
print(f"\n결합: 시군 {len(m)}개")

# ── 5. 가설 검정 (Spearman) ──
m["mt_remote"] = m["산악"] + m["고지오지"]
m["watery"] = m["수변"] + m["해안"]
tests = [
    ("H1a 고지오지 비중 ↔ 출동소요시간", m["고지오지"], m.resp_med),
    ("H1b 의료거리 중앙값 ↔ 출동소요시간", m.er_km_med, m.resp_med),
    ("H2  산악+고지오지 비중 ↔ 자연장소 사고 구성비", m.mt_remote, m.share_nature),
    ("H3  수변+해안 비중 ↔ 수난사고 구성비", m.watery, m.share_water),
]
print("\n가설 검정 (n=18 시군):")
for name, x, y in tests:
    rho, p = spearmanr(x, y)
    print(f"  {name}: rho={rho:+.3f}, p={p:.4f}")

# ── 6. 상세 표 (보고용) ──
out = m[["n", "resp_med", "share_nature", "share_water",
         "고지오지", "산악", "수변", "해안", "er_km_med"]].round(3)
out = out.sort_values("resp_med", ascending=False)
print("\n시군별 상세 (출동소요 내림차순):")
print(out.to_string())
out.to_csv(HERE / "data" / "validation_sigungu.csv", encoding="utf-8-sig")
print("\n저장: data/validation_sigungu.csv")
