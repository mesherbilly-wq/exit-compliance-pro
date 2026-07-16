type PacificLogoProps = {
  className?: string;
  height?: number;
};

export function PacificLogo({ className = "", height = 36 }: PacificLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/pacific-logo.png"
      alt="Pacific Fire & Security"
      height={height}
      className={`w-auto object-contain ${className}`}
      style={{ height }}
    />
  );
}
