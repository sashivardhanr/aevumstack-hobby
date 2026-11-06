// One intentional, local-only illustration. No requests, persistence or real bookings.
const system = document.querySelector('.system');
const button = document.querySelector('#run');
const label = document.querySelector('#run-label');
const status = document.querySelector('#sequence-status');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let timers = [];
const events = ['website', 'booking', 'automation'].map(name => document.querySelector(`[data-event="${name}"]`));
const original = events.map(element => element.textContent);
function cancel() {
  timers.forEach(clearTimeout);
  timers = [];
  system.dataset.step = '0';
  button.disabled = false;
  label.textContent = 'Run the sequence';
  events.forEach((element, index) => { element.textContent = original[index]; });
}
function stage(step) {
  system.dataset.step = String(step);
  const labels = ['','Website interaction','Booking selected','Workflow illustrated'];
  label.textContent = labels[step];
  const messages = ['Sample visit detected', 'Sample booking selected', 'Sample workflow complete'];
  events.forEach((element, index) => { if (index < step) element.textContent = messages[index]; });
}
button.hidden = false;
button.addEventListener('click', () => {
  cancel();
  if (reduced.matches) {
    stage(3);
    label.textContent = 'Sequence complete';
    status.textContent = 'Illustration: a website visit leads to a booking, then a team notification and follow-up. Nothing was sent.';
    return;
  }
  button.disabled = true;
  stage(1);
  timers.push(setTimeout(() => stage(2), 1600));
  timers.push(setTimeout(() => stage(3), 3200));
  timers.push(setTimeout(() => {
    button.disabled = false;
    label.textContent = 'Replay the sequence';
    status.textContent = 'Illustration complete. Website interaction, booking selection and automation. No real booking or notification was created.';
    timers = [];
  }, 4800));
});
document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
reduced.addEventListener('change', cancel);
new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) cancel(); }).observe(system);
