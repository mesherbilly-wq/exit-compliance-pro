import { PacificLogo } from "./pacific-logo";

type BrandMarkProps = {
  logoHeight?: number;
  compact?: boolean;
  className?: string;
};

export function BrandMark({
  logoHeight = 40,
  compact = false,
  className = "",
}: BrandMarkProps) {
  return (
    <div className={className}>
      <PacificLogo height={logoHeight} />
      {compact ? (
        <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-cyan-400">
          Fire Exit Intelligence
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Fire Exit Intelligence
          </p>
          <p className="mt-0.5 text-lg font-bold text-white">Platform</p>
        </>
      )}
    </div>
  );
}
