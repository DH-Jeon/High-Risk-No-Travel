# -*- coding: utf-8 -*-
# 06_risk_clustering.py — 위험 민감도 프로파일 기반 관광지 위험 유형 도출 (1차)
# 피처 = 요인별 극한 시나리오 감점(엔진) + 표고 + 의료거리 + cat2 구성
# 방법 = 표준화 → KMeans (k는 silhouette로 선택) → 군집 프로파일 해석
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from safety_engine import compute_safety_score

HERE = Path(__file__).parent
rng = 42

df = pd.read_parquet(HERE / "places_features.parquet")
attr = df[df.contentTypeId == 12].reset_index(drop=True).copy()
print(f"대상: 관광지 {len(attr)}건")

# ── 1. 요인별 극한 시나리오 감점 — envType 가중·의료거리가 반응으로 드러남 ──
BASE = {"tempC": 24, "rainProbPct": 10, "windMs": 2, "pm25": 10, "forestFireLevel": 1}
SCENARIOS = {
    "s_heat": {"tempC": 36},
    "s_storm": {"rainProbPct": 85, "rainMm": 70, "windMs": 15},
    "s_pm": {"pm25": 90},
    "s_fire": {"forestFireLevel": 4},
}
KEY = {"s_heat": "heat", "s_storm": "rain_wind", "s_pm": "pm", "s_fire": "fire"}

for name, over in SCENARIOS.items():
    attr[name] = [
        compute_safety_score({**BASE, **over, "emergencyRoomKm": km}, et)[KEY[name]]
        for km, et in zip(attr.er_km, attr.envType)
    ]
attr["s_medical"] = [
    compute_safety_score({**BASE, "emergencyRoomKm": km}, et)["medical"]
    for km, et in zip(attr.er_km, attr.envType)
]

# ── 2. 피처 행렬: 민감도 + 표고 + cat2 원핫 ──
sens = attr[["s_heat", "s_storm", "s_pm", "s_fire", "s_medical"]]
static = attr[["elevation_m"]]
cat2 = pd.get_dummies(attr.cat2_name, prefix="c2")
X = pd.concat([sens, static, cat2.astype(float)], axis=1)
Xs = StandardScaler().fit_transform(X)
print(f"피처: 민감도 5 + 표고 1 + cat2 {cat2.shape[1]} = {X.shape[1]}차원")

# ── 3. k 선택 ──
print("\nk별 silhouette:")
scores = {}
for k in range(3, 11):
    km = KMeans(n_clusters=k, n_init=20, random_state=rng).fit(Xs)
    scores[k] = silhouette_score(Xs, km.labels_)
    print(f"  k={k}: {scores[k]:.3f}")
best_k = max(scores, key=scores.get)
print(f"→ 선택 k={best_k}")

km = KMeans(n_clusters=best_k, n_init=50, random_state=rng).fit(Xs)
attr["cluster"] = km.labels_

# ── 4. 군집 프로파일 ──
print("\n군집별 요약 (평균):")
prof = attr.groupby("cluster").agg(
    n=("contentId", "size"),
    heat=("s_heat", "mean"), storm=("s_storm", "mean"), pm=("s_pm", "mean"),
    fire=("s_fire", "mean"), medical=("s_medical", "mean"),
    elev=("elevation_m", "mean"), er_km=("er_km", "mean"),
).round(1)
print(prof.to_string())

print("\n군집 × envType:")
print(pd.crosstab(attr.cluster, attr.envType).to_string())

for c in sorted(attr.cluster.unique()):
    sub = attr[attr.cluster == c]
    top_cat = sub.cat3_name.value_counts().head(3)
    samples = sub.title.sample(min(4, len(sub)), random_state=rng).tolist()
    print(f"\n[군집 {c}] {len(sub)}건 — 주요 소분류: {dict(top_cat)}")
    print(f"  예시: {samples}")

attr.to_parquet(HERE / "places_clustered.parquet")
print("\n저장: analysis/places_clustered.parquet")
