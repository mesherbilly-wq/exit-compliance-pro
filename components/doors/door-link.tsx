import Link from "next/link";
import { getDoorProfileHref } from "@/lib/doors/door-routes";

type DoorLinkProps = {
  door: string;
  className?: string;
};

export function DoorLink({ door, className = "" }: DoorLinkProps) {
  return (
    <Link
      href={getDoorProfileHref(door)}
      className={`font-medium text-white transition-colors hover:text-cyan-300 hover:underline ${className}`}
    >
      {door}
    </Link>
  );
}
