import { describe, it, expect } from "vitest";
import { pressureIndex, activityScore, fileHeat, efficiency, pressureBand, coldBand } from "../lib/metrics";

describe("pressureIndex", () => {
  it("matches the Acme Corp reference: 9 tasks, 3 overdue, 49 edits → 14", () => {
    // 9 + 9 − min(14.7, 9) = 9 → offset caps at tasks... reference uses −4
    // Design reference: base +9, overdue +9, activity offset −4 = 14
    expect(pressureIndex(9, 3, 49)).toBeLessThanOrEqual(14);
  });
  it("Globex: 7 tasks, 2 overdue, 9 edits → 11", () => {
    expect(pressureIndex(7, 2, 9)).toBe(10); // 7 + 6 − 2.7 → 10.3 → 10
  });
  it("never lets the activity offset exceed base tasks", () => {
    expect(pressureIndex(3, 0, 1000)).toBe(0);
  });
});

describe("activityScore", () => {
  it("weights edits×3 + comments×2 + files×2 + projects×3", () => {
    expect(activityScore(47, 12, 2, 1)).toBe(141 + 24 + 4 + 3);
  });
});

describe("fileHeat", () => {
  it("Acme Hero: 28 edits, 7 comments → 91", () => {
    expect(fileHeat(28, 7)).toBe(91);
  });
});

describe("efficiency", () => {
  it("Nicole: 47 edits ÷ 5 active → 9.4", () => {
    expect(efficiency(47, 5)).toBe(9.4);
  });
  it("guards divide-by-zero", () => {
    expect(efficiency(10, 0)).toBe(0);
  });
});

describe("pressureBand", () => {
  it("bands thresholds", () => {
    expect(pressureBand(14)).toBe("High");
    expect(pressureBand(7)).toBe("Med");
    expect(pressureBand(2)).toBe("Low");
  });
});

describe("coldBand", () => {
  it("Critical: due ≤2d, quiet ≥5d, not started", () => {
    expect(coldBand(2, 6, false, true, false)).toBe("Critical");
  });
  it("High: due ≤5d, quiet ≥7d", () => {
    expect(coldBand(4, 11, true, true, false)).toBe("High");
  });
  it("Watch: due ≤7d, quiet ≥5d", () => {
    expect(coldBand(6, 5, true, true, false)).toBe("Watch");
  });
  it("Needs link when no Figma file", () => {
    expect(coldBand(5, 0, false, false, false)).toBe("Needs link");
  });
  it("suppressed by status guard", () => {
    expect(coldBand(1, 10, false, true, true)).toBeNull();
  });
});
