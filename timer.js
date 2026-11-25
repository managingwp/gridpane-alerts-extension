// The offscreen document exists only while the check interval is under a
// minute. It owns no schedule of its own: the worker ticks, this page forwards
// the tick to the service worker, and the service worker runs the same sync an
// alarm would. The document has the runtime API only, so a message is the one
// way to reach the rest of the extension.
const worker = new Worker('timer-worker.js');

worker.onmessage = () => {
  chrome.runtime.sendMessage({ type: 'tick' }).catch(() => {});
};

chrome.runtime.sendMessage({ type: 'timerConfig' })
  .then((reply) => { if (reply?.seconds) worker.postMessage({ seconds: reply.seconds }); })
  .catch(() => {});
