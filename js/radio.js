document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('radio-toggle');
  const panel  = document.getElementById('radio-panel');
  if (!toggle || !panel) return;

  const frame = panel.querySelector('iframe');
  const isOpen = () => panel.classList.contains('open');

  function openPlayer() {
    if (isOpen()) return;
    // Setting src inside the click handler lets autoplay run
    frame.src = frame.dataset.src;
    panel.classList.add('open');
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close radio player');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closePlayer() {
    if (!isOpen()) return;
    // Blank the iframe so the stream stops
    frame.src = 'about:blank';
    panel.classList.remove('open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open radio player');
    panel.setAttribute('aria-hidden', 'true');
  }

  // Floating headphones button toggles
  toggle.addEventListener('click', () => {
    isOpen() ? closePlayer() : openPlayer();
  });

  // Any "Listen Now" link/button opens (never closes)
  document.querySelectorAll('.open-radio').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openPlayer();
    });
  });

  // Escape closes
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePlayer();
  });
});