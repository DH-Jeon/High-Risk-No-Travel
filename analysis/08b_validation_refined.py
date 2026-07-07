# -*- coding: utf-8 -*-
# 08b_validation_refined.py — 외부 검증 재설계
# 08 실패 원인: 시군 전체 사고(도로·주거 66%)가 관광지 신호를 희석
# 수정: ① 사고를 장소 유형으로 절단 (자연장소 vs 그 외) — within-시군 비교
#      ② 자연장소 사고만으로 시군별 출동거리·소요시간 vs 우리 유형 구성 상관
#      ③ 수난사고 40건은 발생 시군 분포를 수변·해안 관광지 분포와 직접 대조
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import mannwhitneyu, spearmanr, wilcoxon

HERE = Path(__file__).parent
ACC = HERE / "data" / "accidents"
CLUSTER_NAME = {0: "근교전천후", 1: "실내", 2: "산악", 3: "고지오지", 4: "수변", 5: "해안"}

t = pd.read_csv(ACC / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv").assign(yr=2022)
a = pd.read_csv(ACC / "안전사고_0000" / "안전사고_0000.csv").assign(yr=2021)
acc = pd.concat([t, a], ignore_index=True)
acc = acc[acc.GRNDS_SGG_NM != "강원도"].copy()

def to_dt(d, prefix):
    return pd.to_datetime(dict(
        year=d[f"{prefix}_YR"], month=d[f"{prefix}_MM"], day=d[f"{prefix}_DAY"],
        hour=d[f"{prefix}_HR"], minute=d[f"{prefix}_MN"]), errors="coerce")

acc["resp_min"] = (to_dt(acc, "GRNDS_ARVL") - to_dt(acc, "DSPT")).dt.total_seconds() / 60
acc = acc[acc.resp_min.between(0, 180)]
acc["dist_km"] = pd.to_numeric(acc.GRNDS_DSTNC, errors="coerce")
acc["nature"] = acc.ACDNT_OCRN_PLC_NM == "바다/강/산/논밭"

# ── ① 자연장소 사고는 정말 더 멀고 오래 걸리나 (전제 확인) ──
nat, oth = acc[acc.nature], acc[~acc.nature]
print("① 자연장소 vs 기타 장소 사고:")
print(f"   출동거리 중앙값: 자연 {nat.dist_km.median():.0f}km vs 기타 {oth.dist_km.median():.0f}km")
print(f"   소요시간 중앙값: 자연 {nat.resp_min.median():.0f}분 vs 기타 {oth.resp_min.median():.0f}분")
u1 = mannwhitneyu(nat.dist_km.dropna(), oth.dist_km.dropna(), alternative="greater")
u2 = mannwhitneyu(nat.resp_min.dropna(), oth.resp_min.dropna(), alternative="greater")
print(f"   Mann-Whitney(자연>기타): 거리 p={u1.pvalue:.2e}, 시간 p={u2.pvalue:.2e}")

# within-시군 쌍대 비교 (시군 고정효과 제거)
pair = acc.groupby(["GRNDS_SGG_NM", "nature"]).resp_min.median().unstack()
pair = pair.dropna()
w = wilcoxon(pair[True], pair[False], alternative="greater")
print(f"   시군 내 쌍대(Wilcoxon, n={len(pair)}): 자연장소가 더 오래 걸림 p={w.pvalue:.4f}")
print(f"   시군별 차이 중앙값: +{(pair[True] - pair[False]).median():.1f}분")

# ── ② 자연장소 사고만으로 시군 상관 재검정 ──
places = pd.read_parquet(HERE / "places_clustered_v2.parquet")
places["type"] = places.k6.map(CLUSTER_NAME)
mix = pd.crosstab(places.sigungu, places.type, normalize="index")
mix["mt_remote"] = mix["산악"] + mix["고지오지"]
er = places.groupby("sigungu").er_km.median().rename("er_km_med")

nat_sig = nat.groupby("GRNDS_SGG_NM").agg(
    n_nat=("resp_min", "size"),
    nat_resp=("resp_min", "median"),
    nat_dist=("dist_km", "median"),
)
m = nat_sig.join(mix).join(er).dropna()
print(f"\n② 자연장소 사고({len(nat)}건) 기준 시군 상관 (n={len(m)}):")
for name, x, y in [
    ("고지오지+산악 비중 ↔ 자연사고 출동거리", m.mt_remote, m.nat_dist),
    ("고지오지+산악 비중 ↔ 자연사고 소요시간", m.mt_remote, m.nat_resp),
    ("의료거리 중앙값 ↔ 자연사고 출동거리", m.er_km_med, m.nat_dist),
    ("의료거리 중앙값 ↔ 자연사고 소요시간", m.er_km_med, m.nat_resp),
]:
    rho, p = spearmanr(x, y)
    print(f"   {name}: rho={rho:+.3f}, p={p:.4f}")

print("\n   시군별 자연사고 상세:")
print(m[["n_nat", "nat_resp", "nat_dist", "고지오지", "산악", "er_km_med"]]
      .sort_values("nat_dist", ascending=False).round(2).to_string())

# ── ③ 수난사고 발생지 vs 수변·해안 관광지 분포 ──
wa = acc[acc.ACDNT_CS_NM.isin(["익수", "물"])]
water_places = places[places.type.isin(["수변", "해안"])]
tab = pd.DataFrame({
    "수난사고": wa.GRNDS_SGG_NM.value_counts(),
    "수변해안_관광지수": water_places.sigungu.value_counts(),
}).fillna(0).astype(int)
rho, p = spearmanr(tab.수난사고, tab.수변해안_관광지수)
print(f"\n③ 수난사고({len(wa)}건) 시군 분포 ↔ 수변·해안 관광지 수: rho={rho:+.3f}, p={p:.4f}")
print(tab.sort_values("수난사고", ascending=False).head(8).to_string())
