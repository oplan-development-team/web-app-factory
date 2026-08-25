import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs in a jsdom environment", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement("canvas").getContext("2d")).toBeNull();
  });

  it("provides PointerEvent", () => {
    const event = new PointerEvent("pointerdown", { pointerId: 7 });
    expect(event.pointerId).toBe(7);
  });
});
