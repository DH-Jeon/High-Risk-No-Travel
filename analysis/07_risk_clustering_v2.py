# -*- coding: utf-8 -*-
# 07_risk_clustering_v2.py — 위험 유형 클러스터링 2차
# 1차 실패 교훈 반영:
#  ① 시나리오를 상한 clamp 아래 "중간 강도"로 (envType 가중 신호 보존)
#  ② 강수/강풍 분리 (수변 vs 해안·산악 신호 분리)
#  ③ cat2 원핫 블록 가중 축소 (전체에서 컬럼 2개 분량으로) — 원핫 지배 방지
#  ④ k 선택: silhouette + bootstrap 안정성(ARI) 병행
import os

os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "4")

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import StandardScaler

from safety_engine import compute_safety_score

HERE = Path(__file__).parent
SEED = 42

df = pd.read_parquet(HERE / "places_features.parquet")
attr = df[df.contentTypeId == 12].reset_index(drop=True).copy()
print(f"대상: 관광지 {len(attr)}건")

# ── 1. 중간 강도 시나리오 (모두 상한 아래 → 가중치가 살아남음) ──
BASE = {"tempC": 24, "rainProbPct": 10, "windMs": 2, "pm25": 10, "forestFireLevel": 1}
SCEN = {
    "s_heat": ({"tempC": 34}, "heat"),                            # 주의보 구간 중간
    "s_rain": ({"rainProbPct": 60, "rainMm": 30}, "rain_wind"),   # 비만 — 수변 신호
    "s_wind": ({"windMs": 10}, "rain_wind"),                      # 바람만 — 해안·산악 신호
    "s_pm":   ({"pm25": 60}, "pm"),                               # 나쁨 등급
    "s_fire": ({"forestFireLevel": 3}, "fire"),                   # 3단계 — 산악 신호
}
for name, (over, key) in SCEN.items():
    attr[name] = [
        compute_safety_score({**BASE, **over, "emergencyRoomKm": km}, et)[key]
        for km, et in zip(attr.er_km, attr.envType)
    ]
attr["s_medical"] = [
    compute_safety_score({**BASE, "emergencyRoomKm": km}, et)["medical"]
    for km, et in zip(attr.er_km, attr.envType)
]

sens_cols = ["s_heat", "s_rain", "s_wind", "s_pm", "s_fire", "s_medical"]
print("\n시나리오 감점의 envType별 평균 (신호 보존 확인):")
print(attr.groupby("envType")[sens_cols].mean().round(1).to_string())

# ── 2. 피처: 민감도(6) + 표고(1) 표준화, cat2 블록은 총 2컬럼 분량으로 축소 ──
num = StandardScaler().fit_transform(attr[sens_cols + ["elevation_m"]])
cat2 = pd.get_dummies(attr.cat2_name, prefix="c2").astype(float)
cat2_s = StandardScaler().fit_transform(cat2) * np.sqrt(2 / cat2.shape[1])
X = np.hstack([num, cat2_s])
print(f"\n피처: 민감도 6 + 표고 1 + cat2 {cat2.shape[1]}(블록가중 √(2/{cat2.shape[1]})) = {X.shape[1]}차원")

# ── 3. k 선택: silhouette + bootstrap ARI ──
rng = np.random.default_rng(SEED)
print("\nk별 silhouette / bootstrap 안정성(ARI, 20회):")
metrics = {}
for k in range(3, 10):
    km = KMeans(n_clusters=k, n_init=20, random_state=SEED).fit(X)
    sil = silhouette_score(X, km.labels_)
    aris = []
    for b in range(20):
        idx = rng.choice(len(X), len(X), replace=True)
        kb = KMeans(n_clusters=k, n_init=10, random_state=b).fit(X[idx])
        # bootstrap 모델로 전체를 예측해 원 라벨과 비교
        aris.append(adjusted_rand_score(km.labels_, kb.predict(X)))
    metrics[k] = (sil, np.mean(aris))
    print(f"  k={k}: sil={sil:.3f}, ARI={np.mean(aris):.3f}")

# 선택 규칙: ARI 0.6 이상 중 silhouette 최대 (안정성 우선)
stable = {k: v for k, v in metrics.items() if v[1] >= 0.6} or metrics
best_k = max(stable, key=lambda k: stable[k][0])
print(f"→ 선택 k={best_k}")

km = KMeans(n_clusters=best_k, n_init=50, random_state=SEED).fit(X)
attr["cluster"] = km.labels_

# ── 4. 군집 프로파일 ──
print("\n군집별 평균 프로파일:")
prof = attr.groupby("cluster").agg(
    n=("contentId", "size"),
    heat=("s_heat", "mean"), rain=("s_rain", "mean"), wind=("s_wind", "mean"),
    pm=("s_pm", "mean"), fire=("s_fire", "mean"), medical=("s_medical", "mean"),
    elev=("elevation_m", "mean"), er_km=("er_km", "mean"),
).round(1)
print(prof.to_string())

print("\n군집 × envType:")
print(pd.crosstab(attr.cluster, attr.envType).to_string())

print("\n군집 × 시군 (상위 3):")
for c in sorted(attr.cluster.unique()):
    sub = attr[attr.cluster == c]
    top_sig = dict(sub.sigungu.value_counts().head(3))
    top_cat = dict(sub.cat3_name.value_counts().head(3))
    samples = sub.title.sample(min(4, len(sub)), random_state=SEED).tolist()
    print(f"\n[군집 {c}] {len(sub)}건 — 시군: {top_sig}")
    print(f"  소분류: {top_cat}")
    print(f"  예시: {samples}")

attr.to_parquet(HERE / "places_clustered_v2.parquet")
print("\n저장: analysis/places_clustered_v2.parquet")
