// src/renderer/components/app/Sparkline.tsx
// Inline SVG sparkline component — no charting libraries (ADR mandate).
// React.memo + useMemo guard per ADR-006 render performance.
import React, { useMemo, useState } from 'react';
import {
  hasEnoughSparklineData,
  getSparklineBounds,
  type SparklinePoint,
} from '../../lib/sparkline-utils';
import { formatMonthLabel } from '../../lib/period-utils';
import { formatNumberValue } from '../../lib/format-utils';
import { useLocale } from '../../context/locale-context';
import { useI18n } from '../../hooks/useI18n';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';

const VIEW_W = 200;
const VIEW_H = 48;

type SvgPoint = { x: number; y: number };

function toPointsString(pts: SvgPoint[]): string {
  return pts.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function monthKeyFromIso(iso: string): number {
  const year = Number(iso.substring(0, 4));
  const month = Number(iso.substring(5, 7)) - 1; // convert to 0-indexed
  return year * 12 + month;
}

export interface SparklineProps {
  points: SparklinePoint[];
  activeFrom: string | null;
  activeTo: string | null;
  onMonthClick: (point: SparklinePoint) => void;
}

export const Sparkline = React.memo(function Sparkline({
  points,
  activeFrom,
  activeTo,
  onMonthClick,
}: SparklineProps) {
  const t = useI18n();
  const locale = useLocale();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Memoize all SVG coordinate maths — recalculated only when `points` changes (ADR-006).
  const svgData = useMemo(() => {
    if (!hasEnoughSparklineData(points)) {
      return null;
    }

    const bounds = getSparklineBounds(points);
    const yRange = bounds.max - bounds.min;
    const n = points.length;

    const svgPts: SvgPoint[] = points.map((p, i) => ({
      x: (i / (n - 1)) * VIEW_W,
      y: VIEW_H - ((p.net - bounds.min) / yRange) * VIEW_H,
    }));

    const polylineStr = toPointsString(svgPts);

    // Zero line: only render when data spans both positive and negative values
    const showZeroLine = bounds.min < 0 && bounds.max > 0;
    const yZero = showZeroLine
      ? VIEW_H - ((0 - bounds.min) / yRange) * VIEW_H
      : null;

    return { bounds, svgPts, polylineStr, showZeroLine, yZero };
  }, [points]);

  // Memoize active range polygon — recalculated only when svgData, activeFrom, activeTo change.
  const activeHighlightPolygon = useMemo(() => {
    if (!svgData || !activeFrom || !activeTo) {
      return null;
    }

    const fromKey = monthKeyFromIso(activeFrom);
    const toKey = monthKeyFromIso(activeTo);
    const activeIndices = points
      .map((p, i) => ({ key: p.year * 12 + p.month, i }))
      .filter(({ key }) => key >= fromKey && key <= toKey)
      .map(({ i }) => i);

    if (activeIndices.length === 0) {
      return null;
    }

    const { svgPts, showZeroLine, yZero } = svgData;
    const baselineY = showZeroLine && yZero !== null ? yZero : VIEW_H;

    const firstIdx = activeIndices[0];
    const lastIdx = activeIndices[activeIndices.length - 1];
    const polygon: SvgPoint[] = [
      ...activeIndices.map((i) => svgPts[i]),
      { x: svgPts[lastIdx].x, y: baselineY },
      { x: svgPts[firstIdx].x, y: baselineY },
    ];

    return toPointsString(polygon);
  }, [svgData, activeFrom, activeTo, points]);

  if (!svgData) {
    return (
      <p className="text-xs text-muted-foreground px-4 py-2">
        {t('report.sparkline.notEnoughData')}
      </p>
    );
  }

  const { svgPts, polylineStr, showZeroLine, yZero } = svgData;

  return (
    <svg
      width="100%"
      height={VIEW_H}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={t('report.sparkline.ariaLabel')}
      className="overflow-visible"
    >
      {/* Zero baseline — only when data spans both sides of zero */}
      {showZeroLine && yZero !== null && (
        <line
          x1={0}
          y1={yZero}
          x2={VIEW_W}
          y2={yZero}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.15}
        />
      )}

      {/* Active period highlight — filled polygon under the selected segment */}
      {activeHighlightPolygon && (
        <polygon
          points={activeHighlightPolygon}
          fill="currentColor"
          className="text-primary"
          opacity={0.2}
        />
      )}

      {/* Main sparkline polyline */}
      <polyline
        points={polylineStr}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        className="text-primary"
      />

      {/* Per-point hit targets, hover indicators, and tooltips */}
      {points.map((p, i) => {
        const { x, y } = svgPts[i];
        const monthLabel = formatMonthLabel(p.year, p.month, locale);
        const sign = p.net >= 0 ? '+' : '';
        const formattedNet = `${sign}${formatNumberValue(p.net, locale.numberFormat)}`;

        return (
          <g key={`${p.year}-${p.month}`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="transparent"
                  className="cursor-pointer focus:outline-none"
                  role="button"
                  aria-label={`${monthLabel}: ${formattedNet}`}
                  tabIndex={0}
                  onClick={() => onMonthClick(p)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onKeyDown={(e: React.KeyboardEvent<SVGCircleElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMonthClick(p);
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{monthLabel}</p>
                <p>{formattedNet}</p>
              </TooltipContent>
            </Tooltip>

            {/* Visible indicator circle shown on hover */}
            {hoveredIndex === i && (
              <circle
                cx={x}
                cy={y}
                r={3}
                fill="currentColor"
                className="text-primary pointer-events-none"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
});
