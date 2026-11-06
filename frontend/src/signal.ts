// The approved hero illustration is isolated from the Booking Desk and contact module.
function setupSignal(root: HTMLElement): void {
 const get = <T extends HTMLElement = HTMLElement>(selector: string): T => {
   const element = root.querySelector<T>(selector);
   if (!element) throw new Error('Incomplete signal illustration');
   return element;
 };
// Local illustration only. Never sends requests, reserves time or persists data.
const bench = get('#signal-workbench');
const run = get<HTMLButtonElement>('#signal-run');
const sample = get<HTMLButtonElement>('#signal-sample-start');
const label = get('#signal-run-label');
const announcement = get('#signal-sequence-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const websiteState = get('#signal-website-state');
const bookingState = get('#signal-booking-state');
const bookingDetail = get('#signal-booking-detail');
const automationState = get('#signal-automation-state');
const visualStatus = get('#signal-visual-status');
const tasks = [...root.querySelectorAll<HTMLElement>('.task-list li')];
let timers: number[] = [];
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
  timers.push(window.setTimeout(() => { bench.dataset.flow = 'booking'; }, 700));
  timers.push(window.setTimeout(booking, 1750));
  timers.push(window.setTimeout(() => { bench.dataset.flow = 'automation'; }, 2100));
  timers.push(window.setTimeout(automation, 3150));
  // The connector arrives before each downstream operation changes state.
  timers.push(window.setTimeout(() => tasks[0].classList.add('done'), 3250));
  timers.push(window.setTimeout(() => tasks[1].classList.add('done'), 3800));
  timers.push(window.setTimeout(() => tasks[2].classList.add('done'), 4350));
  timers.push(window.setTimeout(() => { bench.dataset.flow = 'complete'; }, 4500));
  timers.push(window.setTimeout(complete, 5550));
}
function measureConnections() {
  const rail = get('.signal-track').getBoundingClientRect();
  const vertical = matchMedia('(max-width:600px)').matches;
  if (matchMedia('(min-width:601px) and (max-width:800px)').matches) {
    const area = get('.journey').getBoundingClientRect();
    const from = get('.booking .index').getBoundingClientRect();
    const to = get('.automation .index').getBoundingClientRect();
    const x1 = from.x + from.width / 2 - area.x;
    const y1 = from.y + from.height / 2 - area.y;
    const x2 = to.x + to.width / 2 - area.x;
    const y2 = to.y + to.height / 2 - area.y;
    root.querySelectorAll('.tablet-connection path').forEach(path => {
      path.setAttribute('d', `M${x1} ${y1} H${area.width + 12} V${y2} H${x2}`);
    });
  }
  for (const name of ['booking', 'automation']) {
    const node = get(`.${name} .index`).getBoundingClientRect();
    const position = vertical ? (node.y + node.height / 2 - rail.y) / rail.height : (node.x + node.width / 2 - rail.x) / rail.width;
    bench.style.setProperty(`--${name}-progress`, String(Math.max(0, Math.min(1, position))));
  }
}
new ResizeObserver(measureConnections).observe(get('.journey'));
run.hidden = false; sample.hidden = false; root.classList.add('signal-ready');
run.addEventListener('click', start); sample.addEventListener('click', start);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) { reset(); announcement.textContent = 'Illustration paused. Run the signal to restart.'; }
});
motion.addEventListener('change', () => { if (running) { clearTimers(); website(); booking(); automation(); complete(); } });
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting && running) { reset(); announcement.textContent = 'Illustration paused. Run the signal to restart.'; }
}).observe(bench);

}
const hero = document.querySelector<HTMLElement>('.signal-hero');
if (hero) setupSignal(hero);
export {};
