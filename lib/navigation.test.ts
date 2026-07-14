import { describe, expect, it } from "vitest";
import {
  getPageTitle,
  isDoorsSectionPath,
  isNavActive,
  navItems,
} from "./navigation";

describe("navItems", () => {
  it("lists the simplified top-level navigation order", () => {
    expect(navItems.map((item) => item.label)).toEqual([
      "Dashboard",
      "Attention Centre",
      "Doors",
      "Trends",
      "Reports",
      "Imports",
      "Settings",
    ]);
  });
});

describe("isNavActive", () => {
  const dashboard = navItems[0];
  const doors = navItems[2];
  const reports = navItems[4];

  it("highlights Dashboard for / and /compliance", () => {
    expect(isNavActive("/", dashboard)).toBe(true);
    expect(isNavActive("/compliance", dashboard)).toBe(true);
    expect(isNavActive("/attention", dashboard)).toBe(false);
  });

  it("highlights Doors for /doors, door profiles, and /heat-maps", () => {
    expect(isNavActive("/doors", doors)).toBe(true);
    expect(isNavActive("/doors/Exit-A", doors)).toBe(true);
    expect(isNavActive("/heat-maps", doors)).toBe(true);
    expect(isNavActive("/trends", doors)).toBe(false);
  });

  it("highlights Reports for /executive-reports", () => {
    expect(isNavActive("/executive-reports", reports)).toBe(true);
    expect(isNavActive("/imports", reports)).toBe(false);
  });
});

describe("isDoorsSectionPath", () => {
  it("matches door register, profiles, and heat maps", () => {
    expect(isDoorsSectionPath("/doors")).toBe(true);
    expect(isDoorsSectionPath("/doors/Exit-A")).toBe(true);
    expect(isDoorsSectionPath("/heat-maps")).toBe(true);
    expect(isDoorsSectionPath("/trends")).toBe(false);
  });
});

describe("getPageTitle", () => {
  it("returns section titles for reorganised routes", () => {
    expect(getPageTitle("/")).toBe("Dashboard");
    expect(getPageTitle("/compliance")).toBe("Dashboard");
    expect(getPageTitle("/executive-reports")).toBe("Management Review");
    expect(getPageTitle("/doors")).toBe("Doors");
    expect(getPageTitle("/heat-maps")).toBe("Heat Maps");
  });
});
