# 사고 아웃컴 정제 + 기상 노출과 방향성 점검
# 목적: "야외 관광활동 사고"만 남겼을 때 날씨 위험과 양의 방향인지 실측 확인
import json, glob, os
import pandas as pd
import numpy as np

acc = pd.read_csv("data/accidents/안전사고_0000_관광지/안전사고_0000_관광지.csv",
                  encoding="utf-8-sig", dtype=str)
acc["month"] = acc["DCLR_MM"].astype(int)
SG18 = [os.path.splitext(os.path.basename(f))[0]
        for f in sorted(glob.glob("data/climate_2022_raw/*.json"))]
acc = acc[acc["GRNDS_SGG_NM"].isin(SG18)].copy()

PLC = acc["ACDNT_OCRN_PLC_NM"].fillna("")
CS  = acc["ACDNT_CS_NM"].fillna("")

# ── 정제 규칙 ──
# 야외 장소: 자연(바다/강/산/논밭) + 운동/오락문화(야외 레저 다수) + 도로외교통지역(등산로 등)
outdoor_plc = PLC.str.contains("바다|강|산|논밭|운동|오락|문화|도로외")
# 교통·실내생활 제외
indoor_traffic = PLC.str.contains("^도로$|집|집단거주|상업시설|학교|교육")
# 날씨/야외 민감 원인
weather_cs = CS.str.contains("낙상|추락|미끄|익수|수난|열상|동물|곤충|벌|탈진|온열|저체온|조난|실족")

acc["outdoor"] = outdoor_plc & ~indoor_traffic
acc["weather_sensitive"] = weather_cs

print(f"전체(18시군): {len(acc)}건")
print(f" ├ 야외 장소만: {acc['outdoor'].sum()}건")
print(f" ├ 날씨민감 원인만: {acc['weather_sensitive'].sum()}건")
refined = acc[acc["outdoor"] | acc["weather_sensitive"]]
strict  = acc[acc["outdoor"] & acc["weather_sensitive"]]
print(f" ├ 야외 OR 날씨민감: {len(refined)}건")
print(f" └ 야외 AND 날씨민감(엄격): {len(strict)}건")

def monthly_corr(sub, label):
    # 시군×월 사고수 집계
    y = sub.groupby(["GRNDS_SGG_NM","month"]).size().rename("acc")
    # 기상 노출 월별
    rows=[]
    for sg in SG18:
        d=json.load(open(f"data/climate_2022_raw/{sg}.json",encoding="utf-8"))["daily"]
        df=pd.DataFrame({"tmax":d["temperature_2m_max"],"precip":d["precipitation_sum"],
                         "date":pd.to_datetime(d["time"])})
        df["month"]=df["date"].dt.month
        for m,s in df.groupby("month"):
            rows.append({"GRNDS_SGG_NM":sg,"month":int(m),
                         "tmax_mean":s["tmax"].mean(),"precip_sum":s["precip"].sum(),
                         "hot":(s["tmax"]>=30).sum()})
    wx=pd.DataFrame(rows).set_index(["GRNDS_SGG_NM","month"])
    panel=wx.join(y).fillna({"acc":0})
    print(f"\n[{label}] (n={len(panel)}셀, 총사고 {int(panel['acc'].sum())})")
    for col in ["tmax_mean","hot","precip_sum"]:
        r=panel["acc"].corr(panel[col], method="spearman")
        print(f"  사고 vs {col:10s}: Spearman r = {r:+.3f}")

monthly_corr(acc, "전체(정제 전)")
monthly_corr(refined, "정제(야외 OR 날씨민감)")
monthly_corr(strict, "엄격(야외 AND 날씨민감)")
