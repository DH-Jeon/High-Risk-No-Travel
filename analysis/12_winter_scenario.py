# -*- coding: utf-8 -*-
# 12_winter_scenario.py — 겨울(한파) 축 추가 → 유형 분류 사계절 확장
#
# 근거:
#  - 119 사고 데이터에서 12월이 월별 최다 (겨울 낙상) — 여름 중심 시나리오의 공백
#  - 한파 기준: 기상청 한파특보 (주의보 아침 최저 -12℃ 지속, 경보 -15℃) — 폭염과 동일하게 공식 기준
#  - 관광지별 차등: 기온감률 -0.65℃/100m (표고) + 실내 ×0.3 — 자의적 가중치 없이 물리·기존 규칙만 사용
# 산출: 한파 감점 s_cold 추가 후 k=6 재클러스터링 → 기존 유형과 비교(ARI)
import os

os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "4")

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score
from sklearn.preprocessing import StandardScaler

HERE = Path(__file__).parent
SEED = 42
CLUSTER_NAME = {0: "근교전천후", 1: "실내", 2: "산악", 3: "고지오지", 4: "수변", 5: "해안"}

# ── 0. 사고 데이터로 겨울 축의 필요성 확인 ──
ACC = HERE / "data" / "accidents"
acc = pd.concat([pd.read_csv(ACC / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv"),
                 pd.read_csv(ACC / "안전사고_0000" / "안전사고_0000.csv")], ignore_index=True)
acc["season"] = acc.DCLR_MM.map(lambda m: "겨울(12~2월)" if m in (12, 1, 2) else "그 외")
fall = acc[acc.ACDNT_CS_NM == "낙상"]
tab = pd.crosstab(acc.season, acc.ACDNT_CS_NM == "낙상", normalize="index")
print("[0] 낙상 사고 비중: 겨울 vs 그 외")
print((tab[True] * 100).round(1).astype(str) + "%")

# ── 1. 한파 감점 함수 (heat_points와 동일 구조, 기상청 한파특보 기준) ──
COLD = {"RAMP_START_C": -5, "ADVISORY_C": -12, "WARNING_C": -15, "MAX": 25}

def cold_points(temp_c):
    """아침 최저기온(℃) → 한파 감점. -5℃부터 완만, 주의보(-12)에서 도약, 경보(-15)부터 상한 근접."""
    if temp_c > COLD["RAMP_START_C"]:
        return 0.0
    if temp_c > COLD["ADVISORY_C"]:
        return (COLD["RAMP_START_C"] - temp_c) / (COLD["RAMP_START_C"] - COLD["ADVISORY_C"]) * 8
    if temp_c > COLD["WARNING_C"]:
        return 12 + (COLD["ADVISORY_C"] - temp_c) * (10 / 3)
    return min(COLD["MAX"], 22 + (COLD["WARNING_C"] - temp_c) * 1.5)

# ── 2. 겨울 시나리오: 저지대 아침 최저 -8℃(강원 1월 평년 수준) + 기온감률 ──
LAPSE = 0.0065  # ℃/m
BASE_WINTER_C = -8.0

df = pd.read_parquet(HERE / "places_clustered_v2.parquet")
df["temp_winter"] = BASE_WINTER_C - LAPSE * df.elevation_m
indoor_w = np.where(df.envType == "indoor", 0.3, 1.0)
df["s_cold"] = [round(min(25, cold_points(t) * w)) for t, w in zip(df.temp_winter, indoor_w)]

print("\n[2] 겨울 시나리오 (저지대 -8℃) — 표고 구간별 한파 감점:")
bins = pd.cut(df.elevation_m, [0, 200, 400, 600, 800, 1600])
print(df.groupby(bins, observed=True).agg(
    n=("s_cold", "size"), temp=("temp_winter", "mean"), cold=("s_cold", "mean")).round(1).to_string())

# ── 3. s_cold 추가 후 재클러스터링 (07과 동일 파이프라인) ──
sens = ["s_heat", "s_rain", "s_wind", "s_pm", "s_fire", "s_medical", "s_cold"]
num = StandardScaler().fit_transform(df[sens + ["elevation_m"]])
cat2 = pd.get_dummies(df.cat2_name, prefix="c2").astype(float)
cat2_s = StandardScaler().fit_transform(cat2) * np.sqrt(2 / cat2.shape[1])
X = np.hstack([num, cat2_s])

km = KMeans(n_clusters=6, n_init=50, random_state=SEED).fit(X)
df["k6_winter"] = km.labels_

ari = adjusted_rand_score(df.k6, df.k6_winter)
print(f"\n[3] 기존 유형(여름·산불 5축) vs 겨울 포함(6축) 일치도: ARI = {ari:.3f}")

print("\n겨울 포함 군집 프로파일:")
prof = df.groupby("k6_winter").agg(
    n=("contentId", "size"), cold=("s_cold", "mean"), fire=("s_fire", "mean"),
    rain=("s_rain", "mean"), wind=("s_wind", "mean"), medical=("s_medical", "mean"),
    elev=("elevation_m", "mean"), er_km=("er_km", "mean")).round(1)
print(prof.to_string())

print("\n기존 유형 → 겨울 포함 유형 이동표:")
df["type_old"] = df.k6.map(CLUSTER_NAME)
print(pd.crosstab(df.type_old, df.k6_winter).to_string())

for c in sorted(df.k6_winter.unique()):
    sub = df[df.k6_winter == c]
    print(f"[{c}] n={len(sub)} cold={sub.s_cold.mean():.0f} elev={sub.elevation_m.mean():.0f}m — "
          f"{dict(sub.cat3_name.value_counts().head(3))}")

df.to_parquet(HERE / "places_clustered_v2.parquet")
print("\n저장: places_clustered_v2.parquet (s_cold, k6_winter 컬럼 추가)")
