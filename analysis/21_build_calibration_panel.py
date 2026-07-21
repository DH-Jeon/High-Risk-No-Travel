# 가중치 보정용 216셀 패널 빌드 (시군 18 × 월 12, 2022)
# Y=관광 사고건수(+외지인 정제), X=월별 기상 노출, 정적특성=표고·응급실거리
# offset(방문자수)는 data.go.kr 15101972 승인 후 채운다 — 지금은 결측 자리.
import json, glob, os
import pandas as pd

SG18 = [os.path.splitext(os.path.basename(f))[0]
        for f in sorted(glob.glob("data/climate_2022_raw/*.json"))]

# ── 1) 사고 집계 (관광지판) ──
acc = pd.read_csv("data/accidents/안전사고_0000_관광지/안전사고_0000_관광지.csv",
                  encoding="utf-8-sig", dtype=str)
acc = acc[acc["GRNDS_SGG_NM"].isin(SG18)].copy()
acc["month"] = acc["DCLR_MM"].astype(int)
# 외지인 = 환자 거주 시도가 강원이 아닌 경우
acc["is_visitor"] = ~acc["PTN_CTPV_NM"].fillna("").str.contains("강원")
g = acc.groupby(["GRNDS_SGG_NM", "month"])
acc_panel = g.size().rename("acc_all").to_frame()
acc_panel["acc_visitor"] = g["is_visitor"].sum().astype(int)
acc_panel = acc_panel.reset_index().rename(columns={"GRNDS_SGG_NM": "sigungu"})

# ── 2) 기상 노출 월별 집계 ──
rows = []
for sg in SG18:
    d = json.load(open(f"data/climate_2022_raw/{sg}.json", encoding="utf-8"))["daily"]
    df = pd.DataFrame({
        "date": pd.to_datetime(d["time"]),
        "tmax": d["temperature_2m_max"],
        "precip": d["precipitation_sum"],
        "wind_ms": [w/3.6 for w in d["windspeed_10m_max"]],  # km/h→m/s
    })
    df["month"] = df["date"].dt.month
    for m, sub in df.groupby("month"):
        rows.append({
            "sigungu": sg, "month": int(m),
            "tmax_mean": round(sub["tmax"].mean(), 1),
            "heat_days": int((sub["tmax"] >= 33).sum()),      # 폭염일수
            "precip_sum": round(sub["precip"].sum(), 1),
            "rain_days": int((sub["precip"] >= 1).sum()),
            "heavy_rain_days": int((sub["precip"] >= 30).sum()),
            "wind_max_ms": round(sub["wind_ms"].max(), 1),
            "windy_days": int((sub["wind_ms"] >= 14).sum()),  # 강풍주의보 기준
        })
wx_panel = pd.DataFrame(rows)

# ── 3) 정적 시군 특성 (표고=대표점, er_km=검증셋 중앙값) ──
elev = {sg: json.load(open(f"data/climate_2022_raw/{sg}.json", encoding="utf-8"))["elevation"]
        for sg in SG18}
val = pd.read_csv("data/validation_sigungu.csv", encoding="utf-8-sig")
er = dict(zip(val["GRNDS_SGG_NM"], val["er_km_med"]))

# ── 4) 216셀 뼈대 병합 (모든 시군×월 조합 보장) ──
base = pd.MultiIndex.from_product([SG18, range(1, 13)], names=["sigungu", "month"]).to_frame(index=False)
panel = (base
    .merge(wx_panel, on=["sigungu", "month"], how="left")
    .merge(acc_panel, on=["sigungu", "month"], how="left"))
panel[["acc_all", "acc_visitor"]] = panel[["acc_all", "acc_visitor"]].fillna(0).astype(int)
panel["elevation_m"] = panel["sigungu"].map(elev)
panel["er_km"] = panel["sigungu"].map(er)
panel["visitors"] = pd.NA  # ← offset, 방문자 API 승인 후 채움

panel.to_csv("data/calibration_panel.csv", index=False, encoding="utf-8-sig")

# ── 요약 출력 ──
print(f"패널 shape: {panel.shape}  (기대 216행)")
print(f"사고 총계(관광지판, 18시군): all={panel['acc_all'].sum()}, visitor={panel['acc_visitor'].sum()}")
print(f"외지인 비율: {panel['acc_visitor'].sum()/panel['acc_all'].sum():.1%}")
print(f"0-사고 셀: {(panel['acc_all']==0).sum()}/216 ({(panel['acc_all']==0).mean():.0%}) → 과대산포/영과잉 점검 필요")
print("\n[월별 사고 계절성]")
print(panel.groupby("month")["acc_all"].sum().to_string())
print("\n[시군별 사고 상위 5]")
print(panel.groupby("sigungu")["acc_all"].sum().sort_values(ascending=False).head().to_string())
print("\n[패널 미리보기]")
print(panel.head(3).to_string(index=False))
print("\n저장: data/calibration_panel.csv (visitors 컬럼=offset 대기)")
