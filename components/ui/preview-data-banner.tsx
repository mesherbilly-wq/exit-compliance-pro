import { PREVIEW_DATA_WARNING } from "@/lib/imports/types";

export function PreviewDataBanner() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      {PREVIEW_DATA_WARNING}
    </div>
  );
}
