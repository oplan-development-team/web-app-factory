import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESPONSE,
  MAX_RIBBON_WIDTH,
  MIN_RIBBON_WIDTH,
  RESPONSE_LABELS,
  metricsForSpeed,
  responseLabel,
  responseToMaxSpeed,
} from "../../src/core/ribbon-metrics";

describe("responseToMaxSpeed", () => {
  it("maps the calm end to the widest speed range", () => {
    expect(responseToMaxSpeed(0)).toBeCloseTo(3.2);
  });

  it("maps the default to 2.0 px/ms", () => {
    expect(responseToMaxSpeed(50)).toBeCloseTo(2.0);
  });

  it("maps the volatile end to the narrowest speed range", () => {
    expect(responseToMaxSpeed(100)).toBeCloseTo(0.8);
  });

  it("clamps out-of-range response values", () => {
    expect(responseToMaxSpeed(-40)).toBeCloseTo(3.2);
    expect(responseToMaxSpeed(400)).toBeCloseTo(0.8);
  });

  it("is monotonically decreasing", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let response = 0; response <= 100; response += 10) {
      const value = responseToMaxSpeed(response);
      expect(value).toBeLessThan(previous);
      previous = value;
    }
  });

  it("defaults to the middle of the range", () => {
    expect(DEFAULT_RESPONSE).toBe(50);
  });
});

describe("responseLabel", () => {
  it("names the three zones", () => {
    expect(responseLabel(0)).toBe(RESPONSE_LABELS.calm);
    expect(responseLabel(50)).toBe(RESPONSE_LABELS.balanced);
    expect(responseLabel(100)).toBe(RESPONSE_LABELS.volatile);
  });

  it("keeps a wide balanced zone around the default", () => {
    expect(responseLabel(40)).toBe(RESPONSE_LABELS.balanced);
    expect(responseLabel(60)).toBe(RESPONSE_LABELS.balanced);
    expect(responseLabel(20)).toBe(RESPONSE_LABELS.calm);
    expect(responseLabel(80)).toBe(RESPONSE_LABELS.volatile);
  });
});

describe("metricsForSpeed", () => {
  const maxSpeed = responseToMaxSpeed(DEFAULT_RESPONSE);

  it("gives the widest, most opaque, brightest ribbon when the pointer is still", () => {
    const metrics = metricsForSpeed(0, maxSpeed);
    expect(metrics.width).toBeCloseTo(MAX_RIBBON_WIDTH);
    expect(metrics.alpha).toBeCloseTo(0.95);
    expect(metrics.glow).toBeCloseTo(1);
  });

  it("gives the thinnest, faintest ribbon at or beyond the saturation speed", () => {
    const metrics = metricsForSpeed(maxSpeed, maxSpeed);
    expect(metrics.width).toBeCloseTo(MIN_RIBBON_WIDTH);
    expect(metrics.alpha).toBeCloseTo(0.38);
    expect(metrics.glow).toBeCloseTo(0.35);
  });

  it("saturates rather than inverting past the maximum speed", () => {
    const beyond = metricsForSpeed(maxSpeed * 10, maxSpeed);
    expect(beyond.width).toBeCloseTo(MIN_RIBBON_WIDTH);
    expect(beyond.alpha).toBeCloseTo(0.38);
  });

  it("is monotonic: faster is always thinner and fainter", () => {
    let previous = metricsForSpeed(0, maxSpeed);
    for (let speed = 0.1; speed <= maxSpeed; speed += 0.1) {
      const current = metricsForSpeed(speed, maxSpeed);
      expect(current.width).toBeLessThan(previous.width);
      expect(current.alpha).toBeLessThan(previous.alpha);
      expect(current.glow).toBeLessThan(previous.glow);
      previous = current;
    }
  });

  it("reaches thinner strokes sooner at a high response setting", () => {
    const calm = metricsForSpeed(0.8, responseToMaxSpeed(0));
    const volatile = metricsForSpeed(0.8, responseToMaxSpeed(100));
    expect(volatile.width).toBeLessThan(calm.width);
  });

  it("never produces a non-positive width", () => {
    expect(metricsForSpeed(Number.POSITIVE_INFINITY, maxSpeed).width).toBeGreaterThan(0);
    expect(metricsForSpeed(Number.NaN, maxSpeed).width).toBeGreaterThan(0);
  });
});
