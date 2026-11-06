// Local illustration only. Never sends requests, reserves time or persists data.
const bench = document.querySelector('#workbench');
const run = document.querySelector('#run');
const sample = document.querySelector('#sample-start');
const label = document.querySelector('#run-label');
const announcement = document.querySelector('#sequence-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const websiteState = document.querySelector('#website-state');
const bookingState = document.querySelector('#booking-state');
const bookingDetail = document.querySelector('#booking-detail');
const automationState = document.querySelector('#automation-state');
const visualStatus = document.querySelector('#visual-status');
const tasks = [...document.querySelectorAll('.task-list li')];
let timers = [];
let running = false;
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function reset() {
  clearTimers(); running = false;
  bench.dataset.stage = 'idle'; bench.dataset.flow = 'idle';
  run.disabled = false; sample.disabled = false;
  label.textContent = 'Run the signal';
  websiteState.textContent = 'Give curiosity somewhere to go.';
  bookingState.textContent = 'A clear next step.';
  bookingDetail.textContent = 'Fictional slots. No real reservation.';
  automationState.textContent = 'Waiting for the signal';
  visualStatus.textContent = 'EXPLORE THE JOURNEY';
  tasks.forEach(task => task.classList.remove('done'));
}
function website() {
  bench.dataset.stage = 'website';
  websiteState.textContent = 'Sample visitor chooses “Find a time”.';
  visualStatus.textContent = '01 / WEBSITE INTERACTION';
  label.textContent = 'Signal running';
}
function booking() {
  bench.dataset.stage = 'booking';
  bookingState.textContent = 'Sample session selected.';
  bookingDetail.textContent = 'Wednesday · 11:30 · 30 minutes';
  visualStatus.textContent = '02 / SAMPLE BOOKING SELECTED';
}
function automation() {
  bench.dataset.stage = 'automation';
  automationState.textContent = 'Processing the sample workflow';
  visualStatus.textContent = '03 / AUTOMATION IN SEQUENCE';
}
function complete() {
  bench.dataset.stage = 'complete'; bench.dataset.flow = 'complete';
  tasks.forEach(task => task.classList.add('done'));
  automationState.textContent = 'Sample workflow complete';
  visualStatus.textContent = 'ONE CONNECTED JOURNEY / COMPLETE';
  label.textContent = 'Replay signal';
  run.disabled = false; sample.disabled = false; running = false;
  clearTimers();
  announcement.textContent = 'Sample journey complete: website interaction, booking selection, details captured, team notified and follow-up prepared. This was an illustration. No real booking, message or data was sent.';
}
function start() {
  if (running) return;
  reset();
  measureConnections();
  if (motion.matches) { website(); booking(); automation(); complete(); return; }
  running = true; run.disabled = true; sample.disabled = true;
  announcement.textContent = 'Illustrative journey started. No real booking or notification will be created.';
  website();
  timers.push(setTimeout(() => { bench.dataset.flow = 'booking'; }, 700));
  timers.push(setTimeout(booking, 1750));
  timers.push(setTimeout(() => { bench.dataset.flow = 'automation'; }, 2100));
  timers.push(setTimeout(automation, 3150));
  // The connector arrives before each downstream operation changes state.
  timers.push(setTimeout(() => tasks[0].classList.add('done'), 3250));
  timers.push(setTimeout(() => tasks[1].classList.add('done'), 3800));
  timers.push(setTimeout(() => tasks[2].classList.add('done'), 4350));
  timers.push(setTimeout(() => { bench.dataset.flow = 'complete'; }, 4500));
  timers.push(setTimeout(complete, 5550));
}
function measureConnections() {
  const rail = document.querySelector('.signal-track').getBoundingClientRect();
  const vertical = matchMedia('(max-width:600px)').matches;
  for (const name of ['booking', 'automation']) {
    const node = document.querySelector(`.${name} .index`).getBoundingClientRect();
    const position = vertical ? (node.y + node.height / 2 - rail.y) / rail.height : (node.x + node.width / 2 - rail.x) / rail.width;
    bench.style.setProperty(`--${name}-progress`, String(Math.max(0, Math.min(1, position))));
  }
}
new ResizeObserver(measureConnections).observe(document.querySelector('.journey'));
run.hidden = false; sample.hidden = false; document.documentElement.classList.add('js-ready');
run.addEventListener('click', start); sample.addEventListener('click', start);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) { reset(); announcement.textContent = 'Illustration paused. Run the signal to restart.'; }
});
motion.addEventListener('change', () => { if (running) { clearTimers(); website(); booking(); automation(); complete(); } });
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting && running) { reset(); announcement.textContent = 'Illustration paused. Run the signal to restart.'; }
}).observe(bench);
