import { getRiskType, RISK_TYPE_META } from "@/lib/tour/risk-types";

interface Props {
  contentId: number;
}

/** 데이터 기반 위험 유형 배지 — general(기본 유형)이거나 목록에 없으면 렌더링하지 않는다 */
export default function RiskTypeBadge({ contentId }: Props) {
  const type = getRiskType(contentId);
  if (!type || type === "general") return null;
  const meta = RISK_TYPE_META[type];

  return (
    <span
      title={meta.caution}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.pill}`}
    >
      <span aria-hidden="true">{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
