import { describe, expect, it } from "vitest";
import { activeTab } from "./nav-active";

describe("activeTab", () => {
  it.each([
    ["/", "map"],
    ["/map", "map"],
    ["/places", "places"],
    ["/places/12345", "places"],
    ["/places/12345/report", "places"],
    ["/courses", "courses"],
    ["/unknown", null],
  ] as const)("%s → %s", (pathname, expected) => {
    expect(activeTab(pathname)).toBe(expected);
  });
});
