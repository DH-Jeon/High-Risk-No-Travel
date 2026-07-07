# -*- coding: utf-8 -*-
# 04_accidents_profile.py — 강원 119 구조출동(관광지) 데이터 프로파일링
# 출력: 시군×사고유형 집계 (data/accidents_sigungu.csv) — 클러스터 외부 검증용
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
ACC = HERE / "data" / "accidents"

tour = pd.read_csv(ACC / "안전사고_0000_관광지" / "안전사고_0000_관광지.csv", encoding="utf-8")
allrec = pd.read_csv(ACC / "안전사고_0000" / "안전사고_0000.csv", encoding="utf-8")
print(f"관광지 파일 {len(tour)}행 / 일반 파일 {len(allrec)}행")

for name, d in [("관광지", tour), ("일반", allrec)]:
    print(f"\n[{name}] 연도: {sorted(d.DCLR_YR.unique())}, 시군 {d.GRNDS_SGG_NM.nunique()}개")

# 관광지 파일 기준 프로파일
t = tour.copy()
print("\n사고발생장소(ACDNT_OCRN_PLC_NM) 상위 15:")
print(t.ACDNT_OCRN_PLC_NM.value_counts().head(15))

print("\n사고원인(ACDNT_CS_NM) 상위 15:")
print(t.ACDNT_CS_NM.value_counts().head(15))

print("\n월별 분포 (계절성):")
print(t.DCLR_MM.value_counts().sort_index())

print("\n시군별 건수:")
print(t.GRNDS_SGG_NM.value_counts())

# 사고원인 → 위험 유형 그룹핑 (점수 엔진의 요인과 대응)
CAUSE_GROUP = {
    "산악": ["실족추락", "조난", "개인질환", "탈진탈수", "저체온증", "암벽등반", "낙석"],
    "수난": ["급류", "익수", "물놀이", "수영미숙", "선박", "표류", "패류채취"],
    "낙상·미끄러짐": ["낙상", "미끄러짐", "넘어짐"],
    "교통": ["운전자", "동승자", "보행자", "자전거", "오토바이"],
}

def group_cause(row) -> str:
    text = f"{row.ACDNT_CS_NM} {row.PTN_OCRN_TYPE_NM} {row.ACDNT_OCRN_PLC_NM}"
    for g, kws in CAUSE_GROUP.items():
        if any(k in text for k in kws):
            return g
    return "기타"

t["cause_group"] = t.apply(group_cause, axis=1)
print("\n위험 유형 그룹 분포:")
print(t.cause_group.value_counts())

agg = pd.crosstab(t.GRNDS_SGG_NM, t.cause_group)
agg.to_csv(HERE / "data" / "accidents_sigungu.csv", encoding="utf-8-sig")
print("\n시군 × 위험유형 (검증용, 저장됨):")
print(agg.to_string())
