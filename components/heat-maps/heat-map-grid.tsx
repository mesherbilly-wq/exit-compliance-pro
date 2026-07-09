"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { HeatMapCell, HeatMapGrid } from "@/lib/analytics/heat-maps";
import {
  formatDurationLabel,
  formatDurationReadable,
} from "@/lib/reports/held-open-detection";

type HeatMapGridProps = {
  grid: HeatMapGrid;
  compact?: boolean;
};

function formatCellValue(
  value: number,
  valueUnit: HeatMapGrid["valueUnit"],
  compact: boolean,
): string {
  if (valueUnit === "seconds") {
    return compact ? formatDurationLabel(value) : formatDurationReadable(value);
  }

  if (valueUnit === "incidents") {
    return value.toLocaleString();
  }

  return value.toLocaleString();
}

function heatCellStyle(intensity: number): CSSProperties {
  if (intensity <= 0) {
    return {
      backgroundColor: "rgb(15 23 42)",
      borderColor: "rgb(51 65 85)",
    };
  }

  const red = Math.round(120 + intensity * 135);
  const green = Math.round(40 + (1 - intensity) * 120);
  const blue = Math.round(80 + (1 - intensity) * 100);
  const alpha = 0.35 + intensity * 0.55;

  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
    borderColor:
      intensity > 0.65
        ? "rgba(248, 113, 113, 0.6)"
        : intensity > 0.3
          ? "rgba(251, 191, 36, 0.45)"
          : "rgba(34, 211, 238, 0.35)",
  };
}

export function HeatMapGridView({ grid, compact = false }: HeatMapGridProps) {
  const [activeCell, setActiveCell] = useState<HeatMapCell | null>(null);
  const isSingleRow = grid.cells.length === 1;
  const hasManyRows = grid.rowLabels.length > 1;

  const columnTemplate = useMemo(() => {
    if (isSingleRow) {
      return `repeat(${grid.colLabels.length}, minmax(${compact ? "2.5rem" : "3rem"}, 1fr))`;
    }

    return `minmax(${compact ? "7rem" : "9rem"}, 1.4fr) repeat(${grid.colLabels.length}, minmax(${compact ? "2rem" : "2.5rem"}, 1fr))`;
  }, [compact, grid.colLabels.length, isSingleRow]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{grid.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{grid.description}</p>
        </div>
        {activeCell && (
          <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <p className="font-medium text-cyan-400">{activeCell.tooltip}</p>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        <div
          className="inline-grid min-w-full gap-1"
          style={{ gridTemplateColumns: columnTemplate }}
        >
          {!isSingleRow && (
            <div className="sticky left-0 z-10 bg-slate-900 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Door
            </div>
          )}
          {grid.colLabels.map((label) => (
            <div
              key={label}
              className={`text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${isSingleRow ? "pb-1" : ""}`}
            >
              {label}
            </div>
          ))}

          {grid.cells.map((row, rowIndex) => (
            <div key={grid.rowLabels[rowIndex] ?? rowIndex} className="contents">
              {!isSingleRow && (
                <div
                  className="sticky left-0 z-10 truncate bg-slate-900 py-2 pr-2 text-xs font-medium text-slate-300"
                  title={grid.rowLabels[rowIndex]}
                >
                  {grid.rowLabels[rowIndex]}
                </div>
              )}
              {row.map((cell) => (
                <button
                  key={`${cell.row}-${cell.col}`}
                  type="button"
                  className={`rounded-md border transition hover:scale-[1.03] hover:ring-1 hover:ring-cyan-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSingleRow
                      ? compact
                        ? "min-h-10 px-1 py-2"
                        : "min-h-14 px-1 py-3"
                      : compact
                        ? "min-h-8"
                        : "min-h-10"
                  } ${activeCell === cell ? "ring-2 ring-cyan-400" : ""}`}
                  style={heatCellStyle(cell.intensity)}
                  title={cell.tooltip}
                  aria-label={cell.tooltip}
                  onMouseEnter={() => setActiveCell(cell)}
                  onFocus={() => setActiveCell(cell)}
                  onMouseLeave={() => setActiveCell(null)}
                  onBlur={() => setActiveCell(null)}
                  onClick={() =>
                    setActiveCell((current) => (current === cell ? null : cell))
                  }
                >
                  {cell.value > 0 && (
                    <span
                      className={`block text-center font-medium leading-tight ${
                        cell.intensity > 0.5 ? "text-white" : "text-slate-200"
                      } ${
                        grid.valueUnit === "seconds"
                          ? "px-0.5 text-[9px]"
                          : hasManyRows || isSingleRow
                            ? "text-[10px] font-semibold"
                            : "text-xs font-semibold"
                      }`}
                    >
                      {formatCellValue(cell.value, grid.valueUnit, compact)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
        <span>Low</span>
        <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-slate-800 via-cyan-700 via-40% via-amber-600 via-70% to-red-500" />
        <span>High</span>
        {grid.maxValue > 0 && (
          <span className="ml-2 text-slate-500">
            Peak:{" "}
            {grid.valueUnit === "seconds"
              ? formatDurationReadable(grid.maxValue)
              : grid.maxValue.toLocaleString()}
          </span>
        )}
      </div>
    </section>
  );
}
