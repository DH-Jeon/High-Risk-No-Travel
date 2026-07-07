# -*- coding: utf-8 -*-
# safety_engine.py — harinote 안전 점수 엔진의 Python 포팅
# 원본: harinote/src/lib/safety/{weights.ts,score.ts} — 산식·상수 동일하게 유지할 것
# 검증: 05_verify_engine.py가 원본 vitest의 경계 속성들을 재현해 확인한다

HEAT = {"RAMP_START_C": 28, "ADVISORY_C": 33, "WARNING_C": 35, "MAX": 25}
RAIN_WIND = {"PROB_LOW": 30, "PROB_MID": 60, "PROB_HIGH": 80,
             "MODERATE_MM": 30, "HEAVY_MM": 60,
             "WIND_CAUTION": 9, "WIND_ADVISORY": 14, "MAX": 20}
PM25 = {"GOOD": 15, "MODERATE": 35, "BAD": 75, "MAX": 15}
FIRE_POINTS = {1: 0, 2: 6, 3: 12, 4: 20}
FIRE_MAX = 20
MEDICAL = {"NEAR": 10, "MID": 20, "FAR": 30, "MAX": 10}
SHELTER = {"WALKABLE": 1, "NEAR": 3, "MID": 5, "MAX": 10}
ROAD_MAX = 10

ENV_WEIGHT = {
    "indoor":           {"heat": 0.3, "rain": 0.3, "wind": 0.3, "pm": 0.3, "fire": 1.0},
    "outdoor_water":    {"heat": 1.0, "rain": 1.5, "wind": 1.0, "pm": 1.0, "fire": 1.0},
    "outdoor_mountain": {"heat": 1.0, "rain": 1.0, "wind": 1.3, "pm": 1.0, "fire": 1.3},
    "outdoor_coast":    {"heat": 1.0, "rain": 1.0, "wind": 1.5, "pm": 1.0, "fire": 1.0},
    "outdoor_general":  {"heat": 1.0, "rain": 1.0, "wind": 1.0, "pm": 1.0, "fire": 1.0},
}
PROFILE_WEIGHT = {
    "default":      {"heat": 1.0, "pm": 1.0, "medical": 1.0, "road": 1.0},
    "with_kids":    {"heat": 1.3, "pm": 1.3, "medical": 1.0, "road": 1.0},
    "with_seniors": {"heat": 1.0, "pm": 1.0, "medical": 1.5, "road": 1.0},
    "own_car":      {"heat": 1.0, "pm": 1.0, "medical": 1.0, "road": 1.5},
}


def heat_points(temp_c):
    if temp_c < HEAT["RAMP_START_C"]:
        return 0.0
    if temp_c < HEAT["ADVISORY_C"]:
        return (temp_c - HEAT["RAMP_START_C"]) / (HEAT["ADVISORY_C"] - HEAT["RAMP_START_C"]) * 8
    if temp_c < HEAT["WARNING_C"]:
        return 12 + (temp_c - HEAT["ADVISORY_C"]) * 5
    return min(HEAT["MAX"], 22 + (temp_c - HEAT["WARNING_C"]) * 1.5)


def rain_points(prob_pct, rain_mm=None):
    pts = 0
    if prob_pct >= RAIN_WIND["PROB_HIGH"]: pts = 12
    elif prob_pct >= RAIN_WIND["PROB_MID"]: pts = 8
    elif prob_pct >= RAIN_WIND["PROB_LOW"]: pts = 4
    if rain_mm is not None:
        if rain_mm >= RAIN_WIND["HEAVY_MM"]: pts += 6
        elif rain_mm >= RAIN_WIND["MODERATE_MM"]: pts += 3
    return pts


def wind_points(wind_ms):
    if wind_ms >= RAIN_WIND["WIND_ADVISORY"]: return 8
    if wind_ms >= RAIN_WIND["WIND_CAUTION"]: return 4
    return 0


def pm_points(pm25):
    if pm25 <= PM25["GOOD"]: return 0
    if pm25 <= PM25["MODERATE"]: return 3
    if pm25 <= PM25["BAD"]: return 8
    return PM25["MAX"]


def fire_points(level):
    n = min(4, max(1, round(level)))
    return FIRE_POINTS[n]


def medical_points(km):
    if km >= MEDICAL["FAR"]: return float(MEDICAL["MAX"])
    if km > MEDICAL["MID"]:
        return 5 + (km - MEDICAL["MID"]) / (MEDICAL["FAR"] - MEDICAL["MID"]) * 5
    if km > MEDICAL["NEAR"]:
        return 2 + (km - MEDICAL["NEAR"]) / (MEDICAL["MID"] - MEDICAL["NEAR"]) * 3
    return km / MEDICAL["NEAR"] * 2


def shelter_points(km):
    if km <= SHELTER["WALKABLE"]: return 0
    if km <= SHELTER["NEAR"]: return 3
    if km <= SHELTER["MID"]: return 6
    return SHELTER["MAX"]


def _finalize(base, weight, max_points):
    return round(min(max_points, max(0.0, base * weight)))


def compute_safety_score(inp, env_type, profile="default"):
    """inp: dict(tempC, rainProbPct, rainMm?, windMs, pm25, forestFireLevel,
    emergencyRoomKm, shelterKm?, roadRisk?) → dict(score, factors 감점)"""
    env, prof = ENV_WEIGHT[env_type], PROFILE_WEIGHT[profile]

    heat = _finalize(heat_points(inp["tempC"]), env["heat"] * prof["heat"], HEAT["MAX"])
    rain_wind_raw = (rain_points(inp["rainProbPct"], inp.get("rainMm")) * env["rain"]
                     + wind_points(inp["windMs"]) * env["wind"])
    rain_wind = _finalize(rain_wind_raw, 1, RAIN_WIND["MAX"])
    pm = _finalize(pm_points(inp["pm25"]), env["pm"] * prof["pm"], PM25["MAX"])
    fire = _finalize(fire_points(inp["forestFireLevel"]), env["fire"], FIRE_MAX)
    medical = _finalize(medical_points(inp["emergencyRoomKm"]), prof["medical"], MEDICAL["MAX"])
    shelter = _finalize(shelter_points(inp["shelterKm"]), 1, SHELTER["MAX"]) if "shelterKm" in inp else 0
    road = _finalize(min(1, max(0, inp["roadRisk"])) * ROAD_MAX, prof["road"], ROAD_MAX) if "roadRisk" in inp else 0

    total = heat + rain_wind + pm + fire + medical + shelter + road
    return {
        "score": max(0, min(100, 100 - total)),
        "heat": heat, "rain_wind": rain_wind, "pm": pm, "fire": fire,
        "medical": medical, "shelter": shelter, "road": road,
    }
