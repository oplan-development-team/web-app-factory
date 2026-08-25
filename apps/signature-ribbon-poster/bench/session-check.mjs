// Session-accumulation check: does DraftSync's autosave cost grow across a
// session as more strokes pile up in history.present (never trimmed except by
// undo/clear)? Pure Node, no browser needed — this is a serialization/storage
// question, not a canvas one.

function round(n, decimals) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function serializeDraft(snapshot) {
  return {
    version: 1,
    backgroundId: snapshot.backgroundId,
    hueId: snapshot.hueId,
    response: snapshot.response,
    resolutionId: snapshot.resolutionId,
    caption: snapshot.caption,
    strokes: snapshot.strokes.map((stroke) => {
      const origin = stroke.points[0]?.t ?? 0;
      const flat = [];
      for (const point of stroke.points) {
        flat.push(round(point.x, 1), round(point.y, 1), round(point.t - origin, 1), round(point.speed, 4));
      }
      return { c: stroke.colorId, p: flat };
    }),
  };
}

function makeStroke(pointCount) {
  const points = [];
  let t = 0;
  for (let i = 0; i < pointCount; i++) {
    t += 8;
    points.push({ x: 100 + i, y: 200 + Math.sin(i) * 50, t, speed: 0.5 + Math.random() });
  }
  return { colorId: "gold", points };
}

// A mock localStorage that times setItem exactly like the real thing does
// (synchronous string write), without needing a browser.
const store = new Map();
const mockStorage = {
  setItem(key, value) {
    store.set(key, value); // Node Map set is O(1); the real cost we're timing is JSON.stringify + the string itself existing.
  },
};

const STROKES_PER_CHECKPOINT = 20;
const POINTS_PER_STROKE = 150; // typical signature-length stroke
const CHECKPOINTS = 10; // up to 200 strokes drawn over a "session"

let strokes = [];
console.log("total strokes | total points | stringify+setItem ms | payload KB");
for (let checkpoint = 1; checkpoint <= CHECKPOINTS; checkpoint++) {
  for (let i = 0; i < STROKES_PER_CHECKPOINT; i++) {
    strokes.push(makeStroke(POINTS_PER_STROKE));
  }

  const snapshot = {
    backgroundId: "onyx",
    hueId: "gold",
    response: 50,
    resolutionId: "edition",
    caption: "",
    strokes,
  };

  const t0 = performance.now();
  const json = JSON.stringify(serializeDraft(snapshot));
  mockStorage.setItem("draft", json);
  const elapsed = performance.now() - t0;

  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0);
  console.log(
    `${String(strokes.length).padStart(13)} | ${String(totalPoints).padStart(12)} | ${elapsed.toFixed(3).padStart(20)} | ${(json.length / 1024).toFixed(1).padStart(10)}`
  );
}
