import { describe, expect, it } from "vitest";
import { CAPTION_EYEBROW, drawCaption, fitCaption } from "../../src/render/caption";
import { FakeCtx } from "../helpers/fake-canvas";

const WIDTH = 1800;
const HEIGHT = 2545;

function render(text: string, ctx = new FakeCtx()): FakeCtx {
  drawCaption(ctx, { width: WIDTH, height: HEIGHT, backgroundHex: "#0a0908", text });
  return ctx;
}

describe("fitCaption", () => {
  it("keeps the base size when the text already fits", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 5;
    const fitted = fitCaption(ctx, "Hotta", 50, 1000, (size) => `${size}px serif`);
    expect(fitted.fontSize).toBe(50);
    expect(fitted.text).toBe("Hotta");
  });

  it("shrinks the font before truncating (FR-007.5)", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 1;
    const text = "A very long signature line";
    const fitted = fitCaption(ctx, text, 50, 100, (size) => `${size}px serif`);
    expect(fitted.fontSize).toBeLessThan(50);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(50 * 0.55);
    expect(fitted.text).toBe(text);
  });

  it("does not shrink below 55% of the base size", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 400;
    const fitted = fitCaption(ctx, "wide", 50, 100, (size) => `${size}px serif`);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(50 * 0.55);
  });

  it("truncates with an ellipsis once the minimum size still overflows (E-07)", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 100;
    const fitted = fitCaption(ctx, "abcdefghij", 50, 300, (size) => `${size}px serif`);
    expect(fitted.text.endsWith("…")).toBe(true);
    expect(fitted.text.length).toBeLessThan("abcdefghij".length);
  });

  it("never returns an empty string for non-empty input", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 10_000;
    const fitted = fitCaption(ctx, "abcdef", 50, 10, (size) => `${size}px serif`);
    expect(fitted.text.length).toBeGreaterThan(0);
  });

  it("restores nothing it did not change: leaves the font it measured with", () => {
    const ctx = new FakeCtx();
    ctx.charWidth = 5;
    fitCaption(ctx, "Hotta", 50, 1000, (size) => `${size}px serif`);
    expect(ctx.font).toBe("50px serif");
  });
});

describe("drawCaption", () => {
  it("draws nothing at all for empty text (FR-007.4)", () => {
    const ctx = render("");
    expect(ctx.calls).toHaveLength(0);
  });

  it("draws nothing for whitespace-only text", () => {
    const ctx = render("   \t ");
    expect(ctx.calls).toHaveLength(0);
  });

  it("lays a background-coloured scrim across the bottom of the poster", () => {
    const ctx = render("Hotta / 2026");
    const gradient = ctx.ops("createLinearGradient")[0]!;
    expect(gradient.args[1] as number).toBeGreaterThan(HEIGHT * 0.7);
    expect(gradient.args[3]).toBe(HEIGHT);

    const fill = ctx.ops("fillRect")[0]!;
    expect(fill.args[2]).toBe(WIDTH);
  });

  it("draws the gold hairline rule", () => {
    const ctx = render("Hotta / 2026");
    const stroke = ctx.ops("stroke")[0]!;
    expect(String(stroke.state.strokeStyle)).toContain("201, 162, 75");
    expect(stroke.state.lineWidth as number).toBeGreaterThan(0);
  });

  it("prints the SIGNED eyebrow above the signature line", () => {
    const ctx = render("Hotta / 2026");
    const texts = ctx.ops("fillText");
    expect(texts[0]!.args[0]).toBe(CAPTION_EYEBROW);
    expect(texts[1]!.args[0]).toBe("Hotta / 2026");
    expect(texts[0]!.args[2] as number).toBeLessThan(texts[1]!.args[2] as number);
  });

  it("centres both lines horizontally", () => {
    const ctx = render("Hotta / 2026");
    for (const text of ctx.ops("fillText")) {
      expect(text.args[1]).toBe(WIDTH / 2);
      expect(text.state.textAlign).toBe("center");
    }
  });

  it("trims surrounding whitespace from the signature line", () => {
    const ctx = render("  Hotta  ");
    expect(ctx.ops("fillText")[1]!.args[0]).toBe("Hotta");
  });

  it("uses the serif display face in italic for the signature line", () => {
    const ctx = render("Hotta / 2026");
    expect(String(ctx.ops("fillText")[1]!.state.font)).toMatch(/italic/);
    expect(String(ctx.ops("fillText")[1]!.state.font)).toContain("Playfair Display");
  });

  it("scales every measurement with the poster width so all resolutions match (FR-010.3)", () => {
    const small = new FakeCtx();
    drawCaption(small, {
      width: WIDTH / 2,
      height: HEIGHT / 2,
      backgroundHex: "#0a0908",
      text: "Hotta",
    });
    const large = render("Hotta");

    const smallY = small.ops("fillText")[1]!.args[2] as number;
    const largeY = large.ops("fillText")[1]!.args[2] as number;
    expect(largeY / smallY).toBeCloseTo(2, 5);
  });

  it("resets the composite operation so the caption is never additive", () => {
    const ctx = new FakeCtx();
    ctx.globalCompositeOperation = "lighter";
    render("Hotta", ctx);
    expect(ctx.ops("fillRect")[0]!.state.globalCompositeOperation).toBe("source-over");
  });
});
