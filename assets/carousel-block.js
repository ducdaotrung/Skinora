import { EffectFade, Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

const instances = new WeakMap();
const desktopBreakpoint = 768;

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLoopIndex = (index, slideCount) => {
  const numericIndex = number(index, 0);
  if (slideCount < 1) return 0;
  return ((numericIndex % slideCount) + slideCount) % slideCount;
};

const createCarouselSlideClone = (slide, sourceIndex, position) => {
  const clone = slide.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('data-product-callout');
  clone.removeAttribute('data-product-callout-carousel');
  clone.removeAttribute('data-carousel-slide-label');
  clone.removeAttribute('data-shopify-editor-block');
  clone.removeAttribute('data-shopify-editor-block-id');
  clone.removeAttribute('data-shopify-editor-block-type');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('data-carousel-loop-clone', position);
  clone.setAttribute('data-carousel-loop-source', String(sourceIndex));
  clone.classList.remove('swiper-slide-active', 'swiper-slide-next', 'swiper-slide-prev', 'swiper-slide-visible', 'swiper-slide-fully-visible');
  clone.classList.add('swiper-slide-clone');
  clone.querySelectorAll('[id], [data-shopify-editor-block], [data-shopify-editor-block-id], [data-shopify-editor-block-type]').forEach((element) => {
    element.removeAttribute('id');
    element.removeAttribute('data-shopify-editor-block');
    element.removeAttribute('data-shopify-editor-block-id');
    element.removeAttribute('data-shopify-editor-block-type');
  });
  clone.querySelectorAll('a, button, input, select, textarea, summary, video').forEach((element) => {
    element.setAttribute('tabindex', '-1');
    element.setAttribute('aria-hidden', 'true');
  });
  if ('inert' in clone) clone.inert = true;
  return clone;
};

const createManualLoop = (viewport) => {
  const wrapper = viewport.querySelector('.swiper-wrapper');
  const slides = wrapper ? [...wrapper.querySelectorAll(':scope > .swiper-slide')] : [];
  const slideCount = slides.length;
  if (!wrapper || slideCount < 2) return null;

  // Keep a complete cycle at both ends: A' B' C' | A B C | A' B' C'.
  // This mirrors Slideshow's page-width preview loop and prevents a blank
  // viewport while Swiper crosses either edge of the real slide set.
  const before = slides.map((slide, index) => createCarouselSlideClone(slide, index, 'previous'));
  const after = slides.map((slide, index) => createCarouselSlideClone(slide, index, 'next'));
  wrapper.prepend(...before);
  wrapper.append(...after);
  let resetSlide = null;

  return {
    slideCount,
    initialSlide: slideCount,
    logicalIndex: (activeIndex) => normalizeLoopIndex(activeIndex, slideCount),
    originalIndex: (logicalIndex) => normalizeLoopIndex(logicalIndex, slideCount) + slideCount,
    restore(swiper) {
      if (swiper.destroyed) return;

      const activeIndex = swiper.activeIndex;
      if (activeIndex >= slideCount && activeIndex < slideCount * 2) return;

      const targetIndex = slideCount + normalizeLoopIndex(activeIndex, slideCount);
      resetSlide = swiper.slides[targetIndex];
      resetSlide?.classList.add('carousel-slide--loop-reset');
      swiper.slideTo(targetIndex, 0, false);
    },
    clearReset() {
      if (resetSlide?.classList.contains('swiper-slide-active')) return;
      resetSlide?.classList.remove('carousel-slide--loop-reset');
      resetSlide = null;
    },
    destroy() {
      resetSlide?.classList.remove('carousel-slide--loop-reset');
      [...before, ...after].forEach((clone) => clone.remove());
    },
  };
};

const createManualPagination = (pagination, swiper, manualLoop) => {
  if (!pagination || !manualLoop) return null;

  const type = pagination.dataset.paginationType;
  if (type !== 'bullets' && type !== 'progress_bar') return null;

  const controller = new AbortController();
  const controlsId = swiper.el.id;
  const getCurrentIndex = () => manualLoop.logicalIndex(swiper.activeIndex);
  const update = () => {
    if (swiper.destroyed) return;

    const currentIndex = getCurrentIndex();
    if (type === 'progress_bar') {
      const fill = pagination.querySelector('.swiper-pagination-progressbar-fill');
      if (fill) fill.style.transform = `scaleX(${(currentIndex + 1) / manualLoop.slideCount})`;
      return;
    }

    pagination.querySelectorAll('[data-carousel-pagination-index]').forEach((bullet) => {
      const isCurrent = Number(bullet.dataset.carouselPaginationIndex) === currentIndex;
      bullet.classList.toggle('swiper-pagination-bullet-active', isCurrent);
      bullet.setAttribute('aria-current', String(isCurrent));
    });
  };

  if (type === 'progress_bar') {
    pagination.classList.add('swiper-pagination-progressbar', 'swiper-pagination-horizontal');
    const fill = document.createElement('span');
    fill.className = 'swiper-pagination-progressbar-fill';
    fill.setAttribute('aria-hidden', 'true');
    pagination.replaceChildren(fill);
  } else {
    pagination.classList.add('swiper-pagination-bullets', 'swiper-pagination-horizontal', 'swiper-pagination-clickable');
    const message = swiper.params.a11y?.paginationBulletMessage || 'Go to slide {{index}}';
    const bullets = Array.from({ length: manualLoop.slideCount }, (_, index) => {
      const bullet = document.createElement('button');
      bullet.className = 'swiper-pagination-bullet';
      bullet.type = 'button';
      bullet.dataset.carouselPaginationIndex = String(index);
      bullet.setAttribute('aria-label', message.replace('{{index}}', String(index + 1)));
      if (controlsId) bullet.setAttribute('aria-controls', controlsId);
      return bullet;
    });
    pagination.replaceChildren(...bullets);
    pagination.addEventListener('click', (event) => {
      const bullet = event.target.closest('[data-carousel-pagination-index]');
      if (!bullet || !pagination.contains(bullet)) return;
      event.preventDefault();
      if (swiper.destroyed || swiper.animating) return;
      swiper.slideTo(manualLoop.originalIndex(bullet.dataset.carouselPaginationIndex), swiper.params.speed);
    }, { signal: controller.signal });
  }

  swiper.on('activeIndexChange slideChangeTransitionEnd', update);
  update();

  return () => {
    controller.abort();
    swiper.off('activeIndexChange slideChangeTransitionEnd', update);
    pagination.classList.remove('swiper-pagination-progressbar', 'swiper-pagination-horizontal', 'swiper-pagination-bullets', 'swiper-pagination-clickable');
    pagination.replaceChildren();
  };
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const bindCarouselAutoplay = (swiper, root, delay, pauseOnHover) => {
  if (!swiper || swiper.destroyed || prefersReducedMotion()) return () => {};

  const interval = window.setInterval(() => {
    if (
      document.hidden ||
      swiper.destroyed ||
      swiper.isLocked ||
      (pauseOnHover && swiper.wrapperEl?.matches(':hover')) ||
      root.contains(document.activeElement)
    ) return;

    swiper.isEnd ? swiper.slideTo(0) : swiper.slideNext();
  }, Math.min(60000, Math.max(1000, number(delay, 4000))));

  return () => window.clearInterval(interval);
};

const bindRevealAutoplay = (state, root, delay, pauseOnHover) => {
  if (!state || prefersReducedMotion()) return () => {};

  const interval = window.setInterval(() => {
    if (
      document.hidden ||
      (pauseOnHover && root.matches(':hover')) ||
      root.contains(document.activeElement)
    ) return;

    state.goTo(state.currentIndex + 1);
  }, Math.min(60000, Math.max(1000, number(delay, 4000))));

  return () => window.clearInterval(interval);
};

const initializeReveal = (root) => {
  const slides = Array.from(root.querySelectorAll('[data-carousel-slide]'));
  if (!slides.length) return;

  const buttons = Array.from(root.querySelectorAll('[data-carousel-pagination-button]'));
  const wrapper = root.querySelector('.reveal-carousel__wrapper');
  const controller = new AbortController();
  let dragSession = null;
  const state = {
    reveal: true,
    slides,
    buttons,
    currentIndex: 0,
    visibleIndex: 0,
    isAnimating: false,
    queuedIndex: null,
    destroyed: false,
    slideAnimation: null,
    suppressClick: false,
    goTo: () => {},
    revealCleanup: () => {
      state.destroyed = true;
      state.queuedIndex = null;
      resetDrag();
      state.suppressClick = false;
      controller.abort();
      state.slideAnimation?.cancel();
      state.slideAnimation = null;
    }
  };

  buttons.forEach((button, buttonIndex) => {
    const slide = slides[buttonIndex];
    const template = slide?.querySelector('[data-carousel-pagination-template]');
    if (template && !button.querySelector('.press-quotes__pagination-media')) {
      button.append(template.content.cloneNode(true));
    }

    const media = button.querySelector('.press-quotes__pagination-media');
    const imageRatio = slide?.dataset.pressImageRatio;
    const imageRadius = slide?.dataset.pressImageRadius;
    if (media && imageRatio) media.style.setProperty('--press-quotes-image-ratio', imageRatio);
    if (media && imageRadius) media.style.setProperty('--press-quotes-image-radius', imageRadius);

    const desktopWidth = slide?.dataset.pressImageWidthDesktop;
    const mobileWidth = slide?.dataset.pressImageWidthMobile;
    if (desktopWidth) button.style.setProperty('--press-quotes-image-width', `${desktopWidth}px`);
    if (mobileWidth) button.style.setProperty('--press-quotes-image-width-mobile', `${mobileWidth}px`);
  });

  const normalizeIndex = (index) => {
    const nextIndex = number(index, 0);
    return ((nextIndex % slides.length) + slides.length) % slides.length;
  };

  const updatePagination = (index) => {
    buttons.forEach((button, buttonIndex) => {
      const isSelected = buttonIndex === index;
      button.setAttribute('aria-current', String(isSelected));
      button.classList.toggle('is-selected', isSelected);
    });
  };

  const centerPaginationButton = (index, behavior = 'smooth') => {
    const button = buttons[index];
    const pagination = button?.closest('.reveal-carousel__pagination, .press-quotes__pagination');
    if (!button || !pagination || pagination.scrollWidth <= pagination.clientWidth) return;

    window.requestAnimationFrame(() => {
      if (state.currentIndex !== index) return;
      const paginationRect = pagination.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const targetLeft = pagination.scrollLeft
        + buttonRect.left
        - paginationRect.left
        - (pagination.clientWidth - buttonRect.width) / 2;
      const maxScrollLeft = pagination.scrollWidth - pagination.clientWidth;
      const left = Math.min(maxScrollLeft, Math.max(0, targetLeft));

      if (typeof pagination.scrollTo === 'function') {
        pagination.scrollTo({ left, behavior });
      } else {
        pagination.scrollLeft = left;
      }
    });
  };

  const resetDrag = () => {
    wrapper?.classList.remove('is-dragging');
    root.classList.remove('reveal-carousel--dragging');
    dragSession = null;
  };

  const clearSlideStyles = (slide) => {
    slide?.style.removeProperty('opacity');
    slide?.style.removeProperty('transform');
  };

  const cancelSlideAnimation = () => {
    state.slideAnimation?.cancel();
    state.slideAnimation = null;
  };

  const updateLayout = (index, { alignPagination = true, behavior = 'smooth' } = {}) => {
    const previousIndex = state.currentIndex;
    state.currentIndex = index;
    state.visibleIndex = index;

    slides.forEach((slide, slideIndex) => {
      const isSelected = slideIndex === index;
      slide.classList.toggle('is-selected', isSelected);
      slide.setAttribute('aria-hidden', String(!isSelected));
    });
    updatePagination(index);
    root.classList.add('reveal-initialized');
    if (alignPagination) centerPaginationButton(index, behavior);

    root.dispatchEvent(new CustomEvent('reveal-carousel:select', {
      detail: { index, cell: slides[index] }
    }));
    root.dispatchEvent(new CustomEvent('reveal-carousel:change', {
      detail: {
        index,
        cell: slides[index],
        direction: index > previousIndex ? 'next' : 'previous'
      }
    }));
  };

  const animateElement = async (slide, keyframes, options) => {
    const animation = slide.animate(keyframes, options);
    state.slideAnimation = animation;

    try {
      await animation.finished;
      return true;
    } catch {
      return false;
    } finally {
      if (state.slideAnimation === animation) state.slideAnimation = null;
    }
  };

  const animateSlideTransition = async (
    nextIndex,
    { immediate = false, alignPagination = true } = {}
  ) => {
    const currentSlide = slides[state.visibleIndex];
    const nextSlide = slides[nextIndex];

    if (!currentSlide || !nextSlide || currentSlide === nextSlide) {
      updateLayout(nextIndex, {
        alignPagination,
        behavior: immediate || prefersReducedMotion() ? 'auto' : 'smooth'
      });
      return;
    }

    if (
      immediate ||
      prefersReducedMotion() ||
      slides.length < 2 ||
      typeof currentSlide.animate !== 'function' ||
      typeof nextSlide.animate !== 'function'
    ) {
      cancelSlideAnimation();
      clearSlideStyles(currentSlide);
      clearSlideStyles(nextSlide);
      updateLayout(nextIndex, { alignPagination, behavior: 'auto' });
      return;
    }

    state.isAnimating = true;

    try {
      const didExit = await animateElement(
        currentSlide,
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: 'translateY(-10px)' }
        ],
        {
          duration: 250,
          easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
          fill: 'forwards'
        }
      );

      if (!didExit || state.destroyed) return;

      updateLayout(nextIndex, { alignPagination, behavior: 'smooth' });
      clearSlideStyles(currentSlide);

      const didEnter = await animateElement(
        nextSlide,
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        {
          duration: 400,
          easing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
          fill: 'forwards'
        }
      );

      if (!didEnter || state.destroyed) return;
      clearSlideStyles(nextSlide);
    } finally {
      state.isAnimating = false;

      if (!state.destroyed && state.queuedIndex !== null && state.queuedIndex !== state.currentIndex) {
        const queuedIndex = state.queuedIndex;
        state.queuedIndex = null;
        await animateSlideTransition(queuedIndex);
      } else {
        state.queuedIndex = null;
      }
    }

    if (!state.destroyed) {
      root.dispatchEvent(new CustomEvent('reveal-carousel:settle', {
        detail: { index: nextIndex, cell: nextSlide }
      }));
    }
  };

  state.goTo = (index, options = {}) => {
    const nextIndex = normalizeIndex(index);
    if (state.isAnimating) {
      state.queuedIndex = nextIndex;
      return;
    }

    return animateSlideTransition(nextIndex, options);
  };

  buttons.forEach((button, buttonIndex) => {
    button.addEventListener('click', () => state.goTo(buttonIndex), { signal: controller.signal });
    button.addEventListener('keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = buttonIndex - 1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = buttonIndex + 1;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = buttons.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      state.goTo(nextIndex);
      buttons[normalizeIndex(nextIndex)]?.focus();
    }, { signal: controller.signal });
  });

  if (wrapper && slides.length > 1) {
    const fastDragDuration = 320;
    const fastDragVelocity = 0.15;
    const dragCommitDistance = () => Math.max(36, Math.min(72, wrapper.clientWidth * 0.08 || 48));
    const isInteractiveTarget = (target) => target?.closest?.('a, button, input, textarea, select, [contenteditable="true"]');
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

    wrapper.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0 || isInteractiveTarget(event.target)) return;

      dragSession = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startedAt: now(),
        active: false,
        cancelled: false
      };
    }, { signal: controller.signal });

    window.addEventListener('pointermove', (event) => {
      if (!dragSession || event.pointerId !== dragSession.pointerId) return;

      const deltaX = event.clientX - dragSession.startX;
      const deltaY = event.clientY - dragSession.startY;
      if (dragSession.active || dragSession.cancelled) {
        if (dragSession.active) event.preventDefault();
        return;
      }

      const elapsed = now() - dragSession.startedAt;
      const distance = Math.abs(deltaX);
      if (distance < dragCommitDistance()) {
        if (elapsed > fastDragDuration) dragSession.cancelled = true;
        return;
      }

      if (
        Math.abs(deltaY) >= distance ||
        elapsed > fastDragDuration ||
        distance / Math.max(elapsed, 1) < fastDragVelocity
      ) {
        dragSession.cancelled = true;
        return;
      }

      dragSession.active = true;
      wrapper.classList.add('is-dragging');
      root.classList.add('reveal-carousel--dragging');
      event.preventDefault();
    }, { passive: false, signal: controller.signal });

    window.addEventListener('pointerup', (event) => {
      if (!dragSession || event.pointerId !== dragSession.pointerId) return;

      const deltaX = event.clientX - dragSession.startX;
      const shouldChange = dragSession.active && Math.abs(deltaX) >= dragCommitDistance();
      resetDrag();
      if (!shouldChange) return;

      state.suppressClick = true;
      window.setTimeout(() => {
        state.suppressClick = false;
      }, 0);
      state.goTo(state.currentIndex + (deltaX < 0 ? 1 : -1));
    }, { signal: controller.signal });

    window.addEventListener('pointercancel', resetDrag, { signal: controller.signal });
    wrapper.addEventListener('click', (event) => {
      if (!state.suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      state.suppressClick = false;
    }, { capture: true, signal: controller.signal });
  }

  updateLayout(0, { behavior: 'auto' });
  instances.set(root, state);

  const autoplay = root.dataset.swiperAutoplay === 'true';
  state.autoplayCleanup = autoplay
    ? bindRevealAutoplay(
        state,
        root,
        number(root.dataset.swiperAutoplayDelay, 4000),
        root.dataset.swiperAutoplayPauseOnHover !== 'false'
      )
    : null;
};

const initialize = (root) => {
  if (!root || instances.has(root)) return;
  if (root.dataset.carouselMode === 'reveal') return initializeReveal(root);

  const viewport = root.querySelector('[data-swiper-carousel]');
  const wrapper = viewport?.querySelector('.swiper-wrapper');
  if (!viewport || !wrapper) return;

  const pagination = viewport.querySelector('.swiper-pagination');
  const showDesktop = root.dataset.swiperPaginationDesktop === 'true';
  const showMobile = root.dataset.swiperPaginationMobile === 'true';
  if (pagination) {
    pagination.dataset.paginationVisibleDesktop = String(showDesktop);
    pagination.dataset.paginationVisibleMobile = String(showMobile);
  }

  const paginationType = root.dataset.swiperPaginationType === 'progress_bar' ? 'progressbar' : 'bullets';
  const autoplay = root.dataset.swiperAutoplay === 'true';
  const fractionControls = root.dataset.carouselControlsStyle === 'fraction';
  const loop = root.dataset.carouselLoop === 'true';
  const manualLoopRequested = root.dataset.carouselManualLoop === 'true';
  const showNextSlidePreview = viewport.dataset.swiperNextSlidePreview === 'true';
  const desktopColumns = number(root.dataset.swiperColumnsDesktop, 4);
  const slideCount = Array.from(wrapper.children).filter((slide) => slide.classList.contains('swiper-slide')).length;
  const previewEnabled = showNextSlidePreview && slideCount > desktopColumns;
  viewport.dataset.swiperNextSlidePreview = String(previewEnabled);
  // The shared Swiper preview attribute is a CSS-only overflow hook. Sections
  // that require centered-slide runtime must opt in explicitly on their root.
  const useCenteredSlidePreview = root.dataset.showNextSlidePreviewOnDesktop === 'true';
  const transition = root.dataset.transition === 'fade' ? 'fade' : 'slide';
  const fade = transition === 'fade' && !useCenteredSlidePreview;
  const manualLoop = manualLoopRequested && loop ? createManualLoop(viewport) : null;
  const paginationModules = pagination && !manualLoop ? [Pagination] : [];
  const modules = fade ? [EffectFade, ...paginationModules] : paginationModules;
  const options = {
    loop: loop && !manualLoop,
    initialSlide: manualLoop?.initialSlide || 0,
    effect: fade ? 'fade' : 'slide',
    ...(fade ? { fadeEffect: { crossFade: true } } : {}),
    preventInteractionOnTransition: true,
    speed: prefersReducedMotion() ? 0 : 600,
    slidesPerView: number(root.dataset.swiperColumnsMobile, 1),
    spaceBetween: number(root.dataset.swiperGapMobile, 12),
    breakpoints: {
      [desktopBreakpoint]: {
        slidesPerView: desktopColumns,
        spaceBetween: number(root.dataset.swiperGapDesktop, 16),
        ...(useCenteredSlidePreview ? { centeredSlides: true, spaceBetween: 24 } : {})
      }
    },
    controls: {
      scope: root,
      previous: fractionControls ? '[data-carousel-fraction-previous]' : '[data-carousel-previous]',
      next: fractionControls ? '[data-carousel-fraction-next]' : '[data-carousel-next]',
      loop: Boolean(manualLoop)
    },
    ...(modules.length ? { modules } : {}),
    ...(pagination && !manualLoop ? { pagination: { el: pagination, type: paginationType, clickable: paginationType === 'bullets' } } : {})
  };

  const swiper = createSwiperCarousel(viewport, options);
  if (!swiper) {
    manualLoop?.destroy();
    return;
  }
  let hotspotContentSchemeCleanup = null;
  if (root.hasAttribute('data-hotspot-full-width-carousel')) {
    const controls = root.querySelectorAll(
      '.hotspot-full-width-carousel__navigation, .hotspot-full-width-carousel__pagination, .hotspot-full-width-carousel__fraction-controls'
    );
    const syncHotspotContentScheme = () => {
      if (swiper.destroyed) return;
      const activeSlide = swiper.slides[swiper.activeIndex];
      const productCallout = activeSlide?.matches('.product-callout.color-scheme')
        ? activeSlide
        : activeSlide?.querySelector('.product-callout.color-scheme');
      const scheme = [...(productCallout?.classList || [])].find((className) => className.startsWith('scheme-'));
      if (!scheme) return;

      controls.forEach((control) => {
        const currentScheme = control.dataset.carouselContentScheme
          || [...control.classList].find((className) => className.startsWith('scheme-'));
        if (currentScheme !== scheme) {
          if (currentScheme) control.classList.remove(currentScheme);
          control.classList.add(scheme);
          control.dataset.carouselContentScheme = scheme;
        }
      });
    };
    swiper.on('init slideChange', syncHotspotContentScheme);
    syncHotspotContentScheme();
    hotspotContentSchemeCleanup = () => swiper.off('init slideChange', syncHotspotContentScheme);
  }
  const manualPaginationCleanup = createManualPagination(pagination, swiper, manualLoop);
  if (manualLoop) {
    swiper.on('slideChangeTransitionEnd', manualLoop.restore);
    swiper.on('slideChangeTransitionStart', manualLoop.clearReset);
  }
  const testimonialItem = root.querySelector('.testimonial-item');
  let testimonialGapCleanup = null;
  if (testimonialItem) {
    const syncTestimonialGap = () => {
      const styles = window.getComputedStyle(testimonialItem);
      const gap = Number.parseFloat(styles.getPropertyValue('--testimonial-gap-desktop'));
      if (Number.isFinite(gap)) root.style.setProperty('--testimonial-controls-gap-half', `${gap / 2}px`);
    };
    syncTestimonialGap();
    window.addEventListener('resize', syncTestimonialGap);
    testimonialGapCleanup = () => window.removeEventListener('resize', syncTestimonialGap);
  }
  const updateLockedState = () => {
    if (!swiper.destroyed) root.classList.toggle('carousel-block--locked', Boolean(swiper.isLocked));
  };
  swiper.on('resize breakpoint update observerUpdate', updateLockedState);
  updateLockedState();
  const lockedCleanup = () => swiper.off('resize breakpoint update observerUpdate', updateLockedState);
  const notifySlideChange = () => {
    document.dispatchEvent(new CustomEvent('theme:carousel:slidechange', { detail: { root } }));
  };
  swiper.on('slideChange', notifySlideChange);
  const slideChangeCleanup = () => swiper.off('slideChange', notifySlideChange);
  let fractionCleanup = null;
  if (fractionControls) {
    const current = root.querySelector('[data-carousel-fraction-current]');
    const total = root.querySelector('[data-carousel-fraction-total]');
    const updateFraction = () => {
      if (swiper.destroyed) return;
      const realSlides = swiper.slides.filter((slide) => !slide.classList.contains('swiper-slide-duplicate') && !slide.classList.contains('swiper-slide-clone'));
      const slideCount = manualLoop?.slideCount || (loop ? realSlides.length : swiper.slides.length);
      const currentIndex = manualLoop
        ? manualLoop.logicalIndex(swiper.activeIndex) + 1
        : loop
          ? swiper.realIndex + 1
          : swiper.activeIndex + 1;
      if (current) current.textContent = String(currentIndex);
      if (total) total.textContent = String(slideCount);
    };
    swiper.on('init slideChange update', updateFraction);
    updateFraction();
    fractionCleanup = () => swiper.off('init slideChange update', updateFraction);
  }
  const state = {
    swiper,
    testimonialGapCleanup,
    hotspotContentSchemeCleanup,
    lockedCleanup,
    slideChangeCleanup,
    fractionCleanup,
    manualLoop,
    manualPaginationCleanup,
    autoplayCleanup: autoplay
      ? bindCarouselAutoplay(
          swiper,
          root,
          number(root.dataset.swiperAutoplayDelay, 4000),
          root.dataset.swiperAutoplayPauseOnHover !== 'false'
        )
      : null
  };
  instances.set(root, state);
};

const destroy = (root) => {
  const state = instances.get(root);
  if (!state) return;
  state.autoplayCleanup?.();
  state.testimonialGapCleanup?.();
  state.hotspotContentSchemeCleanup?.();
  state.lockedCleanup?.();
  state.slideChangeCleanup?.();
  state.fractionCleanup?.();
  state.manualPaginationCleanup?.();
  state.revealCleanup?.();
  if (state.manualLoop) {
    state.swiper.off('slideChangeTransitionEnd', state.manualLoop.restore);
    state.swiper.off('slideChangeTransitionStart', state.manualLoop.clearReset);
    state.manualLoop.destroy();
  }
  if (state.swiper) destroySwiperCarousel(state.swiper);
  instances.delete(root);
};

const initializeRoot = (root = document, refreshExisting = false) => {
  const initializeOrRefresh = (carouselRoot) => {
    if (!refreshExisting || !instances.has(carouselRoot)) {
      initialize(carouselRoot);
      return;
    }

    const state = instances.get(carouselRoot);
    const manualLoopRequested = carouselRoot.dataset.carouselManualLoop === 'true';
    if (state?.manualLoop || manualLoopRequested) {
      destroy(carouselRoot);
      initialize(carouselRoot);
      return;
    }

    if (state?.swiper && !state.swiper.destroyed) state.swiper.update();
  };

  if (root.matches?.('[data-carousel-block]')) initializeOrRefresh(root);
  root.querySelectorAll?.('[data-carousel-block]').forEach(initializeOrRefresh);
};
const destroyRoot = (root) => {
  if (root.matches?.('[data-carousel-block]')) destroy(root);
  root.querySelectorAll?.('[data-carousel-block]').forEach(destroy);
};

export { initializeRoot as initializeThemeModule };

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:select', (event) => initializeRoot(event.target, true));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));
document.addEventListener('shopify:block:select', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const root = target?.closest('[data-carousel-block]');
  if (!root) return initializeRoot(target || event.target);

  initialize(root);
  const state = instances.get(root);
  const slide = target.closest('.carousel-slide, .testimonial-item, .press-item, .product-callout');
  const paginationButton = target.closest('[data-carousel-pagination-button]');
  if (!state) return;

  if (state.reveal) {
    const index = paginationButton
      ? number(paginationButton.dataset.carouselPaginationIndex, -1)
      : state.slides.indexOf(slide);
    if (index >= 0) state.goTo(index, { immediate: Boolean(event.detail?.load) });
    return;
  }

  if (!slide) return;
  const index = Array.from(state.swiper?.slides || []).indexOf(slide);
  if (index < 0 || !state.swiper || state.swiper.destroyed) return;

  const duration = event.detail?.load || prefersReducedMotion() ? 0 : state.swiper.params.speed;
  if (state.manualLoop) {
    const realIndex = number(slide.dataset.swiperSlideIndex, state.manualLoop.logicalIndex(index));
    state.swiper.slideTo(state.manualLoop.originalIndex(realIndex), duration);
    return;
  }

  if (state.swiper.params.loop && typeof state.swiper.slideToLoop === 'function') {
    const realIndex = number(slide.dataset.swiperSlideIndex, index);
    state.swiper.slideToLoop(realIndex, duration);
    return;
  }

  state.swiper.slideTo(index, duration);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
else initializeRoot();
