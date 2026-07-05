"use client";

import { useState } from "react";
import type { RegionSummary } from "@/lib/risk/region-summary";
import { GRADE_LABEL, type RiskLevel } from "@/lib/safety/types";
import { gradeGradient } from "@/lib/risk/map-colors";
import RegionRiskMap from "@/components/RegionRiskMap";
import RegionPanel from "@/components/RegionPanel";

const GRADES: RiskLevel[] = ["low", "moderate", "high"];

/** 홈 대시보드 — 좌측 강원 지도 + 우측 시군 패널, 선택 상태 공유 */
export default function RegionDashboard({
  regions,
}: {
  regions: RegionSummary[];
}) {
  const [selectedCode, setSelectedCode] = useState<number | null>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <RegionRiskMap
          regions={regions}
          selectedCode={selectedCode}
          onSelectRegion={setSelectedCode}
        />
        <ul
          aria-label="안전점수 색 범례"
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-600"
        >
          {GRADES.map((grade) => (
            <li key={grade} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 w-12 rounded-full ring-1 ring-slate-200"
                style={{ background: gradeGradient(grade) }}
              />
              {GRADE_LABEL[grade]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full bg-slate-400"
            />
            데이터 없음
          </li>
        </ul>
        <p className="mt-1.5 text-xs text-slate-400">
          막대는 왼쪽(연함)이 낮은 점수, 오른쪽(진함)이 높은 점수 —{" "}
          <span className="font-semibold text-slate-500">
            진할수록 안전점수가 높아요
          </span>
          .
        </p>
      </div>
      <RegionPanel
        regions={regions}
        selectedCode={selectedCode}
        onSelect={setSelectedCode}
        onClear={() => setSelectedCode(null)}
      />
    </div>
  );
}
