// A self-scheduling timeout, not setInterval: each tick is one message and the
// next one is only set after it, so a slow consumer cannot queue a burst. A
// worker timer also keeps its resolution while the browser is in the background,
// which a hidden tab's timers do not.
let timer = null;
let seconds = 0;

function schedule() {
  clearTimeout(timer);
  if (!seconds) return;
  timer = setTimeout(() => {
    postMessage({ type: 'tick' });
    schedule();
  }, seconds * 1000);
}

onmessage = (event) => {
  const next = Number(event.data?.seconds);
  if (!Number.isFinite(next) || next <= 0) return;
  seconds = next;
  schedule();
};
