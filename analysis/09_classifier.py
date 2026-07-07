# -*- coding: utf-8 -*-
# 09_classifier.py — 위험 유형 분류기: 신규 관광지에 유형을 할당하는 지도학습 단계
# 타깃 = k6 군집 라벨 (775건, 6유형)
# 피처 = 점수 엔진·envType 규칙 없이 얻을 수 있는 원천 정보만
#        (TourAPI cat1~3, 좌표, 표고, 최근접 응급실 거리, 명칭 키워드)
# 비교 = ① 다수 클래스 ② envType 규칙 → 군집 최빈값 매핑 (규칙 베이스라인)
# 존재 이유 = 타지역(제주·경북) 이식 시 시나리오 계산 없이 유형 즉시 할당 + 확률 제공
import os

os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "4")

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict

HERE = Path(__file__).parent
SEED = 42
CLUSTER_NAME = {0: "근교전천후", 1: "실내", 2: "산악", 3: "고지오지", 4: "수변", 5: "해안"}

df = pd.read_parquet(HERE / "places_clustered_v2.parquet")
df["type"] = df.k6.map(CLUSTER_NAME)
y = df.type
print(f"대상 {len(df)}건, 클래스 분포: {dict(y.value_counts())}")

# ── 피처 구성 (엔진 산출물·envType 미사용) ──
KEYWORDS = ["계곡", "폭포", "호수", "강", "해수욕장", "해변", "항", "산", "봉", "휴양림",
            "사찰", "사", "박물관", "전시", "체험", "마을", "공원", "동굴", "온천"]
feats = pd.DataFrame(index=df.index)
feats["elevation_m"] = df.elevation_m
feats["er_km"] = df.er_km
feats["lat"] = df.lat
feats["lng"] = df.lng
for kw in KEYWORDS:
    feats[f"kw_{kw}"] = df.title.str.contains(kw, regex=False).astype(int)
feats = pd.concat([feats, pd.get_dummies(df.cat2, prefix="cat2").astype(int),
                   pd.get_dummies(df.cat3, prefix="cat3").astype(int)], axis=1)
print(f"피처 {feats.shape[1]}차원 (수치 4 + 키워드 {len(KEYWORDS)} + cat2/3 원핫)")

# ── 베이스라인 ──
maj = y.value_counts(normalize=True).iloc[0]
rule_map = df.groupby("envType").type.agg(lambda s: s.mode()[0])
rule_pred = df.envType.map(rule_map)
rule_acc = (rule_pred == y).mean()
rule_f1 = f1_score(y, rule_pred, average="macro")
print(f"\n베이스라인: 다수클래스 acc={maj:.3f} | envType규칙 acc={rule_acc:.3f}, macro-F1={rule_f1:.3f}")
print(f"  (규칙 매핑: {dict(rule_map)})")

# ── 분류기: RandomForest + 5-fold CV ──
clf = RandomForestClassifier(
    n_estimators=500, min_samples_leaf=2, class_weight="balanced",
    random_state=SEED, n_jobs=4,
)
cv = StratifiedKFold(5, shuffle=True, random_state=SEED)
pred = cross_val_predict(clf, feats, y, cv=cv)
acc = (pred == y).mean()
print(f"\nRandomForest 5-fold CV: acc={acc:.3f}, macro-F1={f1_score(y, pred, average='macro'):.3f}")
print("\n클래스별 성능:")
print(classification_report(y, pred, digits=3))

labels = sorted(y.unique())
cm = pd.DataFrame(confusion_matrix(y, pred, labels=labels), index=labels, columns=labels)
print("혼동행렬 (행=실제, 열=예측):")
print(cm.to_string())

# ── 피처 중요도 (전체 적합 후 permutation) ──
clf.fit(feats, y)
imp = permutation_importance(clf, feats, y, n_repeats=10, random_state=SEED, n_jobs=4)
top = pd.Series(imp.importances_mean, index=feats.columns).nlargest(12)
print("\nPermutation 중요도 상위 12:")
print(top.round(4).to_string())

# ── 규칙이 틀리고 모델이 맞춘 사례 (헤드라인용) ──
fixed = df[(rule_pred != y) & (pred == y)]
print(f"\n규칙 오분류 → 모델 정분류: {len(fixed)}건 (규칙 오류 {int((rule_pred != y).sum())}건 중)")
show = fixed[fixed.type == "고지오지"].head(6)
print(show[["title", "sigungu", "elevation_m", "er_km", "type"]].round(1).to_string(index=False))

import joblib

joblib.dump({"model": clf, "features": list(feats.columns), "keywords": KEYWORDS,
             "cluster_name": CLUSTER_NAME}, HERE / "risk_type_classifier.joblib")
print("\n저장: analysis/risk_type_classifier.joblib")
