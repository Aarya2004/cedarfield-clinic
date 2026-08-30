// Served at /probe/camera — answers whether ChatGPT desktop's built-in browser grants getUserMedia
// and can run MediaPipe tasks-vision in-page (the load-bearing unknown for a gesture-confirm channel).
export const CAMERA_PROBE_HTML = String.raw`<!doctype html><meta charset="utf-8"><title>camera + gesture probe</title>
<body style="font:16px system-ui;padding:2rem;max-width:40rem">
<h1>Camera & gesture probe</h1>
<p>Answers one question: inside THIS browser (ChatGPT desktop / Chrome), can a page get webcam frames and run an in-page gesture model?</p>
<button id="go" style="font-size:1.2rem;padding:.5rem 1rem">Run probe</button>
<pre id="log" style="background:#f4f4f0;padding:1rem;white-space:pre-wrap"></pre>
<video id="v" width="320" autoplay muted playsinline style="display:block;border:1px solid #ccc"></video>
<script type="module">
const log = (m) => { document.getElementById("log").textContent += m + "\n"; };
log("ua: " + navigator.userAgent.slice(0, 120));
log("modelContext: " + (typeof document.modelContext) + " / navigator alias: " + (typeof navigator.modelContext));
log("mediaDevices: " + (typeof navigator.mediaDevices) + "  getUserMedia: " + (typeof navigator.mediaDevices?.getUserMedia));
document.getElementById("go").onclick = async () => {
  const t0 = performance.now();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640 } });
    log("getUserMedia OK in " + Math.round(performance.now() - t0) + " ms; tracks: " + stream.getVideoTracks().map((t) => t.label).join(","));
    document.getElementById("v").srcObject = stream;
    const t1 = performance.now();
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs");
    log("tasks-vision module loaded in " + Math.round(performance.now() - t1) + " ms");
    const t2 = performance.now();
    const files = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm");
    const rec = await vision.GestureRecognizer.createFromOptions(files, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task" }, runningMode: "VIDEO", numHands: 1 });
    log("gesture recognizer ready in " + Math.round(performance.now() - t2) + " ms — show a thumbs-up");
    const v = document.getElementById("v");
    let frames = 0; const t3 = performance.now();
    const tick = () => {
      if (v.readyState >= 2) {
        const r = rec.recognizeForVideo(v, performance.now());
        frames++;
        const g = r.gestures?.[0]?.[0];
        if (g && g.categoryName !== "None" && g.score > 0.6) { log("GESTURE: " + g.categoryName + " (" + g.score.toFixed(2) + ") — " + (frames / ((performance.now() - t3) / 1000)).toFixed(0) + " fps"); frames = 0; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  } catch (e) { log("FAILED: " + (e && e.name) + " — " + (e && e.message)); }
};
</script>`;
