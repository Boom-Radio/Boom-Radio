document.querySelectorAll("[data-carousel-autoplay]").forEach((carousel) => {
  const track = carousel.querySelector(".carousel__track");
  const prevBtn = carousel.querySelector(".carousel__control--prev");
  const nextBtn = carousel.querySelector(".carousel__control--next");
  const toggleBtn = carousel.querySelector(".carousel-autoplay-toggle");
  const status = carousel.querySelector(".carousel__status");

  // Same defensive pattern as carousel-arrow-addon.js: a carousel
  // missing any required piece is left exactly as that script (or the
  // plain base carousel) leaves it, rather than half-wiring autoplay
  // on top of controls that don't fully exist. toggleBtn is required,
  // not optional: WCAG 2.2.2 needs a way to stop auto-advancing
  // content indefinitely, and the WAI-ARIA carousel pattern requires
  // it to live inside the carousel as the first tab stop - a carousel
  // missing it never starts autoplay at all rather than shipping a
  // non-compliant one. data-carousel-autoplay (checked implicitly by
  // querySelectorAll above) makes this opt-in per instance, since
  // .carousel alone is also used by carousels that were never meant
  // to move on their own.
  if (!track || !prevBtn || !nextBtn || !toggleBtn) return;

  // Only start once carousel-arrow-addon.js has actually enhanced
  // THIS carousel - if that script never ran (missing file, or this
  // instance failed its own validation), calling nextBtn.click() on
  // an interval would tick forever against a button with no working
  // handler behind it, going nowhere silently. toggleBtn stays
  // hidden (see markup) in that case too, exactly like it does under
  // reduced motion below - nothing to show a control for.
  if (!carousel.classList.contains("carousel--enhanced")) return;

  // A user who has asked for reduced motion doesn't get anything
  // moving on its own, full stop - not even once. Nothing to toggle
  // in that case, so the control stays hidden rather than shown for a
  // slideshow that was never going to move.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const ADVANCE_INTERVAL = 5000; // how often it advances while playing

  // WAI-ARIA APG's carousel pattern (https://www.w3.org/WAI/ARIA/apg/patterns/carousel/):
  // rotation stops when focus enters the carousel or the pointer
  // hovers it, and stays stopped - no auto-resume timer. Both are
  // transient, not a change to whether the user has asked for
  // rotation at all (playing) - hover reverses on its own when the
  // pointer leaves, focus reverses on its own when focus leaves the
  // carousel entirely, and neither should overrule an explicit click
  // on the toggle, which is why they're tracked separately from
  // playing rather than folded into it.
  let playing = true;
  let advanceTimer = null;
  let hoverPaused = false;
  let focusPaused = false;

  // track.scrollTo() (called by carousel-arrow-addon.js's move(), which
  // nextBtn.click() below triggers) fires real, isTrusted: true scroll
  // events - scrolling is genuine browser machinery even when a script
  // started it, unlike .click() itself, which stays reliably
  // untrusted. So isTrusted can filter our own synthetic clicks but
  // not the scroll they cause, and without this flag every autoplay
  // tick would look identical to a real drag and permanently stop
  // itself the moment it started. Also covers focus: some engines
  // shift focus to a button as part of .click()'s default action even
  // when script-triggered, which would otherwise make every tick
  // look like a focus-driven pause too.
  let ownActionSettleTimer = null;
  let isOwnAction = false;
  const markOwnActionStart = () => {
    isOwnAction = true;
    clearTimeout(ownActionSettleTimer);
    ownActionSettleTimer = setTimeout(() => { isOwnAction = false; }, 150);
  };

  const setStatusLive = () => {
    if (status) status.setAttribute("aria-live", playing && !hoverPaused && !focusPaused ? "off" : "polite");
  };

  const setToggleLabel = () => {
    toggleBtn.textContent = playing ? "Stop Auto-play" : "Resume Auto-play";
  };

  const stopAdvancing = () => {
    clearInterval(advanceTimer);
    advanceTimer = null;
  };

  const startAdvancing = () => {
    stopAdvancing();
    advanceTimer = setInterval(() => {
      markOwnActionStart();
      nextBtn.click();
    }, ADVANCE_INTERVAL);
  };

  // Single source of truth for "should the timer be running right
  // now," called after ANY change to playing/hoverPaused/focusPaused
  // instead of each handler deciding start vs. stop for itself. Two
  // independent transient flags (hover, focus) can both be true at
  // once, and each one's own "leave" event only knows about clearing
  // ITSELF - calling startAdvancing() directly from, say, mouseleave
  // would restart rotation even while focusPaused is still true,
  // because that handler never checks the OTHER flag. Recomputing the
  // full condition here every time closes that gap, and folds in
  // setStatusLive() too so aria-live can never drift out of sync with
  // whether the timer is actually running.
  const syncAdvancing = () => {
    if (playing && !hoverPaused && !focusPaused) {
      startAdvancing();
    } else {
      stopAdvancing();
    }
    setStatusLive();
  };

  // Any real interaction (arrow click, drag/swipe/wheel scroll) stops
  // rotation for good - per the APG pattern, this does not schedule
  // an automatic resume. Only the toggle restarts it.
  const onUserInteraction = (e) => {
    if (e && e.isTrusted === false) return;
    if (!playing) return;
    playing = false;
    stopAdvancing();
    setToggleLabel();
    setStatusLive();
  };

  toggleBtn.addEventListener("click", () => {
    playing = !playing;
    // Explicitly activating the toggle overrides whatever transient
    // pause state got there first - WAI's pattern calls this out
    // directly: clicking "Start" restarts rotation even while focus
    // remains on the toggle itself, which would otherwise still read
    // as focusPaused from the focusin that just fired when it was
    // tabbed to. Same reasoning already applied to hoverPaused below:
    // reaching the toggle with a real pointer already counts as
    // "hovering the carousel" (mouseenter/mouseleave fire for the
    // whole box, the toggle included, with no bubbling-based way to
    // exclude just it the way focusin allows), so a stale true here
    // needs the same explicit reset.
    hoverPaused = false;
    focusPaused = false;
    setToggleLabel();
    syncAdvancing();
  });

  prevBtn.addEventListener("click", onUserInteraction);
  nextBtn.addEventListener("click", onUserInteraction);
  track.addEventListener("scroll", () => {
    if (isOwnAction) {
      markOwnActionStart(); // still our own scroll animation settling - keep extending, don't treat as manual
      return;
    }
    onUserInteraction();
  }, { passive: true });

  // Focus entering ANYWHERE in the carousel - the toggle included -
  // pauses rotation, per the APG pattern's "first tab stop" guidance:
  // the toggle has to be reachable before the moving content, which
  // means it has to be one of the things that stops that movement,
  // not an exception to it. This is a transient pause (focusPaused),
  // not the same as clicking "Stop" (playing) - it reverses on its
  // own once focus actually leaves the carousel, same as hover below.
  carousel.addEventListener("focusin", () => {
    if (isOwnAction) return;
    if (!playing) return;
    focusPaused = true;
    syncAdvancing();
  });

  // Only resume once focus has left the carousel ENTIRELY, not just
  // moved from one focusable child to another (e.g. toggle -> prev
  // arrow) - relatedTarget is where focus is going.
  carousel.addEventListener("focusout", (e) => {
    if (!playing || !focusPaused) return;
    if (carousel.contains(e.relatedTarget)) return;
    focusPaused = false;
    syncAdvancing();
  });

  // Hover pauses transiently and resumes on its own - the one
  // exception the APG pattern makes to "stays stopped," since hover
  // is a continuous condition that already reverses itself the
  // instant the pointer leaves.
  carousel.addEventListener("mouseenter", () => {
    if (!playing) return;
    hoverPaused = true;
    syncAdvancing();
  });
  carousel.addEventListener("mouseleave", () => {
    if (!playing || !hoverPaused) return;
    hoverPaused = false;
    syncAdvancing();
  });

  toggleBtn.hidden = false;
  setToggleLabel();
  setStatusLive();
  startAdvancing();
});
