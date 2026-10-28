document.querySelectorAll(".carousel").forEach((carousel) => {
  const track = carousel.querySelector(".carousel__track");
  const prevBtn = carousel.querySelector(".carousel__control--prev");
  const nextBtn = carousel.querySelector(".carousel__control--next");
  const status = carousel.querySelector(".carousel__status");
  const slides = Array.from(carousel.querySelectorAll(".carousel__slide"));

  if (!track || !prevBtn || !nextBtn || !slides.length) return;

  // Only now, after every required element is confirmed present, does
  // this specific carousel get marked enhanced - see
  // carousel-arrow-addon.css, which gates the hidden-scrollbar/visible-
  // arrows styling on this exact class rather than on .js alone, so a
  // carousel whose markup is missing a piece never ends up with a
  // native scrollbar hidden behind arrows that were never wired up.
  carousel.classList.add("carousel--enhanced");

  // Known limitation: LTR only. The clamp below assumes scrollLeft
  // ranges from 0 (start) to a positive maxScroll (end), which is the
  // left-to-right convention. RTL horizontal scroll containers use a
  // different scrollLeft coordinate convention (it varies by browser),
  // so this math would need adapting before this carousel could support
  // dir="rtl" content. Not fixed here since RTL isn't in scope yet.
  //
  // Finds whichever slide's own centre-aligning scroll position is
  // closest to where the track is actually scrolled - matches
  // .carousel__slide's scroll-snap-align: center, so "current" means
  // the same thing to the CSS and the JS.
  //
  // Deliberately compares scrollLeft TARGETS, not rendered positions.
  // Comparing rendered centres directly ties at the start/end of the
  // track: every slide shares the same one scrollLeft, so once that
  // value is clamped to [0, maxScroll] - which happens for the first
  // or last slide whenever centering it would need to scroll past the
  // edge of the content - two neighbouring slides can render equally
  // close to the track's centre even though only one is truly
  // reachable. Comparing each slide's own scrollLeft target (clamped
  // the same way getTargetScrollLeft clamps it) instead gives the edge
  // slide an exact-match distance of 0, breaking the tie correctly.
  const getCurrentIndex = () => {
    const trackRect = track.getBoundingClientRect();
    const maxScroll = track.scrollWidth - track.clientWidth;
    let closest = 0;
    let closestDist = Infinity;
    slides.forEach((slide, i) => {
      const slideRect = slide.getBoundingClientRect();
      const idealScrollLeft =
        track.scrollLeft +
        (slideRect.left - trackRect.left) +
        slideRect.width / 2 -
        trackRect.width / 2;
      const clampedScrollLeft = Math.max(0, Math.min(maxScroll, idealScrollLeft));
      const dist = Math.abs(track.scrollLeft - clampedScrollLeft);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    return closest;
  };

  // The scrollLeft the track itself needs to center a given slide,
  // clamped to the track's real scrollable range.
  const getTargetScrollLeft = (slide) => {
    const trackRect = track.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const maxScroll = track.scrollWidth - track.clientWidth;
    const target =
      track.scrollLeft +
      (slideRect.left - trackRect.left) +
      slideRect.width / 2 -
      trackRect.width / 2;
    return Math.max(0, Math.min(maxScroll, target));
  };

  // Scrolls only the track's own scrollLeft - never scrollIntoView().
  // scrollIntoView() is free to scroll ANY scrollable ancestor to bring
  // its target into view, the page included: a carousel positioned
  // below the fold could hijack the whole document's scroll position
  // on every arrow click or resize. Driving track.scrollTo() directly
  // touches only the one element that's actually supposed to move.
  const scrollToSlide = (index, behavior = "smooth") => {
    track.scrollTo({ left: getTargetScrollLeft(slides[index]), behavior });
  };

  // Tracked as state rather than recomputed on demand everywhere:
  // resize needs the slide that was current BEFORE the resize changed
  // the track's geometry, and recalculating getCurrentIndex() only
  // after the resize has already reshuffled every slide's position
  // can land on the wrong slide.
  let currentIndex = getCurrentIndex();

  const updateStatus = () => {
    if (!status) return;
    status.textContent = `Slide ${currentIndex + 1} of ${slides.length}`;
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const move = (dir) => {
    currentIndex = (currentIndex + dir + slides.length) % slides.length;
    scrollToSlide(currentIndex, prefersReducedMotion ? "instant" : "smooth");
  };

  prevBtn.addEventListener("click", () => move(-1));
  nextBtn.addEventListener("click", () => move(1));

  // The counter follows the track itself, not the arrows. move() used to
  // guess with setTimeout(updateStatus, 250), which meant a swipe or a
  // trackpad scroll left the label reading "Slide 1 of 3" on slide 3.
  // Reading the scroll position covers every way the track can move,
  // arrows included, so the arrows no longer report their own state.
  // This is also where currentIndex is kept in sync with drags/swipes/
  // trackpad scrolling that move() never sees.
  let scrollTimer;
  track.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      currentIndex = getCurrentIndex();
      updateStatus();
    }, 100);
  }, { passive: true });

  // The live region starts hidden (see the HTML) so a screen reader
  // never encounters a meaningless "Slide 1 of x" if this script fails
  // to load or throws before reaching this line. Only unhidden once
  // every check above has passed and there's a real number to report.
  if (status) status.hidden = false;
  updateStatus();

  // Re-aligns to whichever slide was current before the resize, since
  // a width change can leave the track sitting between two slides.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      scrollToSlide(currentIndex, "instant");
    }, 150);
  });
});