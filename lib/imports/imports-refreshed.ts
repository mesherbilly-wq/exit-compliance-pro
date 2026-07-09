"use client";

import { useEffect } from "react";

export const IMPORTS_REFRESHED_EVENT = "exit-compliance-pro:imports-refreshed";

export function dispatchImportsRefreshed(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(IMPORTS_REFRESHED_EVENT));
  }
}

export function useImportsRefreshed(onRefresh: () => void): void {
  useEffect(() => {
    const handler = () => onRefresh();
    window.addEventListener(IMPORTS_REFRESHED_EVENT, handler);
    return () => window.removeEventListener(IMPORTS_REFRESHED_EVENT, handler);
  }, [onRefresh]);
}
