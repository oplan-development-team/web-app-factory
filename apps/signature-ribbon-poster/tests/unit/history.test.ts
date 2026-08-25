import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, History } from "../../src/core/history";

describe("History", () => {
  it("starts at the initial state with nothing to undo or redo", () => {
    const history = new History<number[]>([]);
    expect(history.present).toEqual([]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  it("moves to a pushed state", () => {
    const history = new History<number[]>([]);
    history.push([1]);
    expect(history.present).toEqual([1]);
    expect(history.canUndo).toBe(true);
  });

  it("undoes back to the previous state", () => {
    const history = new History<number[]>([]);
    history.push([1]);
    history.push([1, 2]);
    expect(history.undo()).toEqual([1]);
    expect(history.present).toEqual([1]);
    expect(history.canRedo).toBe(true);
  });

  it("redoes the undone state", () => {
    const history = new History<number[]>([]);
    history.push([1]);
    history.undo();
    expect(history.redo()).toEqual([1]);
    expect(history.present).toEqual([1]);
  });

  it("returns null and stays put when there is nothing to undo", () => {
    const history = new History<number[]>([7]);
    expect(history.undo()).toBeNull();
    expect(history.present).toEqual([7]);
  });

  it("returns null and stays put when there is nothing to redo", () => {
    const history = new History<number[]>([7]);
    expect(history.redo()).toBeNull();
  });

  it("discards the redo branch when a new state is pushed (FR-008.3)", () => {
    const history = new History<number[]>([]);
    history.push([1]);
    history.push([1, 2]);
    history.undo();
    expect(history.canRedo).toBe(true);
    history.push([1, 9]);
    expect(history.canRedo).toBe(false);
    expect(history.present).toEqual([1, 9]);
  });

  it("supports undoing a clear because clear is pushed like any other state", () => {
    const history = new History<number[]>([]);
    history.push([1, 2, 3]);
    history.push([]);
    expect(history.present).toEqual([]);
    expect(history.undo()).toEqual([1, 2, 3]);
  });

  it("caps the undo depth at the history limit", () => {
    const history = new History<number[]>([]);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      history.push([i]);
    }
    let steps = 0;
    while (history.canUndo) {
      history.undo();
      steps++;
    }
    expect(steps).toBe(HISTORY_LIMIT);
  });

  it("uses a 50-step limit", () => {
    expect(HISTORY_LIMIT).toBe(50);
  });

  it("resets to a fresh baseline, dropping both stacks", () => {
    const history = new History<number[]>([]);
    history.push([1]);
    history.undo();
    history.reset([5]);
    expect(history.present).toEqual([5]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});
