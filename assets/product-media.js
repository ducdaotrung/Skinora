import { EffectFade, Pagination, Thumbs } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel } from './swiper-carousel.js';

// Zoom relative to the fitted image, capped by source resolution and display size.
const LIGHTBOX_ZOOM_SCALE = 3;
const LIGHTBOX_MAX_IMAGE_SIZE = 2000;
const LIGHTBOX_DRAG_THRESHOLD = 4;
const LIGHTBOX_DISMISS_AXIS_RATIO = 1.15;
const LIGHTBOX_DISMISS_ANIMATION_MS = 240;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class ProductMediaGallery extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.mobileQuery = window.matchMedia('(max-width: 767.98px)');
    this.desktopLeftThumbnailQuery = window.matchMedia('(min-width: 992px)');
    this.productInformation = this.closest('[data-product-information]');
    const variantPicker = this.productInformation?.querySelector('[data-product-variant-picker]');
    const currentVariantId = variantPicker?.dataset.currentVariantId || this.dataset.currentVariantId;
    const currentVariant = variantPicker?.findVariantById?.(currentVariantId);
    const linkedVariantMedia = Array.from(this.querySelectorAll('[data-product-media]')).find((media) =>
      this.variantIdsFor(media).includes(String(currentVariantId || '')),
    );
    const preferredMediaId = currentVariant?.featured_media?.id
      ? String(currentVariant.featured_media.id)
      : this.dataset.currentVariantMediaId || linkedVariantMedia?.dataset.mediaId || '';
    if (currentVariantId) this.dataset.currentVariantId = currentVariantId;
    if (preferredMediaId) this.dataset.currentVariantMediaId = preferredMediaId;

    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleLightboxPointerDown = this.handleLightboxPointerDown.bind(this);
    this.handleLightboxPointerMove = this.handleLightboxPointerMove.bind(this);
    this.handleLightboxPointerUp = this.handleLightboxPointerUp.bind(this);
    this.handleLightboxDragStart = this.handleLightboxDragStart.bind(this);
    this.handleBreakpoint = this.handleBreakpoint.bind(this);
    this.handleVariantChange = this.handleVariantChange.bind(this);
    this.scheduleGalleryRefresh = this.scheduleGalleryRefresh.bind(this);
    this.handleQuickAddStripPointerDown = this.handleQuickAddStripPointerDown.bind(this);
    this.handleQuickAddStripPointerMove = this.handleQuickAddStripPointerMove.bind(this);
    this.handleQuickAddStripPointerUp = this.handleQuickAddStripPointerUp.bind(this);

    this.addEventListener('click', this.handleClick, { signal: this.signal, capture: true });
    this.addEventListener('keydown', this.handleKeydown, { signal: this.signal });
    this.addEventListener('pointerdown', this.handleLightboxPointerDown, { signal: this.signal, capture: true });
    this.addEventListener('pointermove', this.handleLightboxPointerMove, { signal: this.signal, capture: true });
    this.addEventListener('pointerup', this.handleLightboxPointerUp, { signal: this.signal, capture: true });
    this.addEventListener('pointercancel', this.handleLightboxPointerUp, { signal: this.signal, capture: true });
    this.addEventListener('dragstart', this.handleLightboxDragStart, { signal: this.signal, capture: true });
    this.mobileQuery.addEventListener('change', this.handleBreakpoint, { signal: this.signal });
    this.desktopLeftThumbnailQuery.addEventListener('change', this.handleBreakpoint, { signal: this.signal });
    window.addEventListener('resize', () => {
      if (!this.lightbox?.open) return;
      this.resetLightboxZoom();
      this.layoutLightboxImages();
    }, { signal: this.signal });
    this.productInformation?.addEventListener('variant:change', this.handleVariantChange, { signal: this.signal });
    this.galleryResizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(this.scheduleGalleryRefresh)
      : null;
    this.galleryResizeObserver?.observe(this);
    this.lightbox?.addEventListener('close', () => this.destroyLightbox(), { signal: this.signal });
    this.lightbox?.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.closeLightbox();
    }, { signal: this.signal });
    this.lightbox?.addEventListener('click', (event) => {
      const target = event.target;
      if (target === this.lightbox) {
        this.closeLightbox();
        return;
      }

      const panel = target.closest?.('.product-media-lightbox__panel');
      const protectedContent = target.closest?.(
        '.product-media-lightbox__toolbar, .product-media-lightbox__thumbnails, .product-media-lightbox__slide, [data-product-lightbox-previous], [data-product-lightbox-next]',
      );
      if (panel && !protectedContent) this.closeLightbox();
    }, { signal: this.signal });

    this.applyVariantMediaFilter(this.dataset.currentVariantId);
    this.syncThumbnailVisibility();
    this.syncGalleryOverflow();
    this.initializeGallery(preferredMediaId);
    this.initializeShopifyMedia();
  }

  disconnectedCallback() {
    window.requestAnimationFrame(() => {
      if (this.isConnected) return;

      this.abortController?.abort();
      this.abortController = null;
      cancelAnimationFrame(this.galleryRefreshFrame);
      this.galleryRefreshFrame = null;
      this.galleryResizeObserver?.disconnect();
      this.galleryResizeObserver = null;
      this.destroyGallery();
      this.destroyLightbox();
    });
  }

  get mainElement() {
    return this.querySelector('[data-product-main-swiper]');
  }

  get thumbnailElement() {
    return this.querySelector('[data-product-thumbnail-swiper]');
  }

  get lightbox() {
    return this.querySelector('[data-product-media-lightbox]');
  }

  get lightboxZoomState() {
    if (!this._lightboxZoomState) {
      this._lightboxZoomState = {
        scale: 1,
        x: 0,
        y: 0,
        image: null,
        slide: null,
        dragging: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
        moved: false,
        suppressClickUntil: 0,
        mediaPointerId: null,
        mediaStartX: 0,
        mediaStartY: 0,
        mediaMoved: false,
        mediaSuppressClickUntil: 0,
        dismissCandidate: false,
        dismissDragging: false,
        dismissAnimating: false,
        dismissPointerId: null,
        dismissAxis: null,
        dismissStartX: 0,
        dismissStartY: 0,
        dismissOffset: 0,
        dismissImage: null,
        dismissCapture: null,
        dismissSlide: null,
        dismissTimer: null,
      };
    }

    return this._lightboxZoomState;
  }

  get galleryMode() {
    if (this.mobileQuery.matches) return 'mobile';
    if (this.dataset.overlayPresentation === 'quick-add-strip') return 'quick-add-strip';
    if (!['left_thumbnails', 'bottom_thumbnails'].includes(this.dataset.desktopLayout)) return 'desktop-static';

    const useLeftThumbnails = this.dataset.desktopLayout === 'left_thumbnails'
      && (this.desktopLeftThumbnailQuery?.matches ?? true);
    return useLeftThumbnails ? 'desktop-carousel-left' : 'desktop-carousel-bottom';
  }

  get quickAddStripSlidesPerView() {
    const visibleMediaCount = this.visibleSlides().length;
    return visibleMediaCount > 4 ? 4 : Math.max(1, visibleMediaCount);
  }

  syncQuickAddStripSlidesPerView() {
    if (this.dataset.overlayPresentation !== 'quick-add-strip' || this.mobileQuery?.matches) {
      this.style.removeProperty('--overlay-media-slides-per-view');
      return;
    }

    this.style.setProperty('--overlay-media-slides-per-view', String(this.quickAddStripSlidesPerView));
  }

  visibleSlides() {
    return Array.from(this.querySelectorAll('[data-product-media]')).filter((slide) => !slide.hidden);
  }

  activeMediaId() {
    const activeSlide = this.mainSwiper?.slides?.[this.mainSwiper.activeIndex];
    if (activeSlide && !activeSlide.hidden) return activeSlide.dataset.mediaId || '';

    return this.visibleSlides()[0]?.dataset.mediaId || '';
  }

  variantIdsFor(element) {
    return (element?.dataset.variantIds || '')
      .split(',')
      .map((variantId) => variantId.trim())
      .filter(Boolean);
  }

  setMediaVisibility(element, hidden) {
    if (!element) return;

    element.hidden = hidden;
    element.style.display = hidden ? 'none' : '';
    element.setAttribute('aria-hidden', String(hidden));
  }

  resetPagination() {
    const pagination = this.querySelector('[data-product-media-pagination]');
    if (!pagination) return;

    pagination.replaceChildren();
    pagination.classList.remove(
      'swiper-pagination-bullets',
      'swiper-pagination-progressbar',
      'swiper-pagination-clickable',
      'swiper-pagination-horizontal',
      'swiper-pagination-vertical',
      'swiper-pagination-lock',
      'swiper-pagination-hidden',
      'swiper-pagination-disabled',
    );
  }

  syncPaginationVisibility(shouldShow) {
    const pagination = this.querySelector('[data-product-media-pagination]');
    if (!pagination) return;

    const hasOverflow = this.visibleSlides().length > 1;
    pagination.toggleAttribute('hidden', !(shouldShow && hasOverflow));
  }

  applyVariantMediaFilter(variantId) {
    if (this.dataset.filterVariantMedia !== 'true') return false;

    const slides = Array.from(this.querySelectorAll('[data-product-media]'));
    const normalizedVariantId = String(variantId || '');
    const hasLinkedMedia = Boolean(normalizedVariantId) && slides.some((slide) =>
      this.variantIdsFor(slide).includes(normalizedVariantId),
    );

    slides.forEach((slide) => {
      const variantIds = this.variantIdsFor(slide);
      const hidden = hasLinkedMedia && variantIds.length > 0 && !variantIds.includes(normalizedVariantId);
      this.setMediaVisibility(slide, hidden);
    });

    return true;
  }

  destroyGallery() {
    this.quickAddStripController?.abort();
    this.quickAddStripController = null;
    this.quickAddStripDrag = null;
    destroySwiperCarousel(this.mainSwiper);
    destroySwiperCarousel(this.thumbnailSwiper);
    this.mainSwiper = null;
    this.thumbnailSwiper = null;
    this.activeGalleryMode = null;
    this.resetPagination();
    this.syncPaginationVisibility(false);
  }

  initializeGallery(preferredMediaId = '', { instant = true } = {}) {
    const main = this.mainElement;
    if (!main) return;

    const mode = this.galleryMode;
    if (mode === 'desktop-static') {
      this.destroyGallery();
      if (preferredMediaId) this.scrollToMedia(preferredMediaId, true);
      return;
    }

    if (this.mainSwiper && this.activeGalleryMode === mode) {
      this.syncQuickAddStripSlidesPerView();
      if (mode === 'quick-add-strip') {
        this.mainSwiper.params.slidesPerView = this.quickAddStripSlidesPerView;
      }
      this.thumbnailSwiper?.update();
      this.mainSwiper.update();
      if (preferredMediaId) this.showMedia(preferredMediaId, instant);
      return;
    }

    this.destroyGallery();
    this.activeGalleryMode = mode;
    const isMobile = mode === 'mobile';
    const isQuickAddStrip = mode === 'quick-add-strip';
    const showThumbnails = (!isMobile && !isQuickAddStrip) || this.dataset.mobileLayout === 'thumbnails';
    const showPagination = isMobile && this.dataset.mobileLayout === 'slider' && this.dataset.mobileShowPagination === 'true';
    const slidesPerView = isQuickAddStrip ? this.quickAddStripSlidesPerView : 1;
    this.syncPaginationVisibility(showPagination);
    this.syncQuickAddStripSlidesPerView();
    const gapProperty = isMobile ? '--product-media-gap-mobile' : '--product-media-gap';
    const thumbnailGapProperty = isMobile ? '--product-media-thumbnail-gap-mobile' : '--product-media-thumbnail-gap';
    const computedStyle = getComputedStyle(this);
    const gapValue = Number.parseFloat(computedStyle.getPropertyValue(gapProperty));
    const gap = Number.isFinite(gapValue) ? gapValue : (isMobile ? 10 : 12);
    const thumbnailGapValue = Number.parseFloat(computedStyle.getPropertyValue(thumbnailGapProperty));
    const thumbnailGap = Number.isFinite(thumbnailGapValue) ? thumbnailGapValue : gap;

    if (showThumbnails && this.thumbnailElement) {
      this.thumbnailSwiper = createSwiperCarousel(this.thumbnailElement, {
        slidesPerView: 'auto',
        spaceBetween: thumbnailGap,
        direction: mode === 'desktop-carousel-left' ? 'vertical' : 'horizontal',
        watchSlidesProgress: true,
        a11y: { enabled: true },
      });
    }

    const pagination = this.querySelector('[data-product-media-pagination]');
    const paginationType = pagination?.dataset.paginationType === 'progress_bar' ? 'progressbar' : 'bullets';
    this.mainSwiper = createSwiperCarousel(main, {
      modules: showPagination ? [Pagination, Thumbs] : [Thumbs],
      slidesPerView,
      autoHeight: isMobile,
      spaceBetween: gap,
      speed: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
      grabCursor: isQuickAddStrip,
      ...(isQuickAddStrip ? { focusableElements: 'input, select, option, textarea, video, label' } : {}),
      watchOverflow: true,
      controls: {
        scope: this,
        previous: '[data-product-media-previous]',
        next: '[data-product-media-next]'
      },
      ...(showPagination && pagination ? { pagination: { el: pagination, type: paginationType, clickable: paginationType === 'bullets' } } : {}),
      ...(this.thumbnailSwiper ? { thumbs: { swiper: this.thumbnailSwiper, autoScrollOffset: 1 } } : {}),
      a11y: { enabled: true },
    });

    if (isQuickAddStrip) this.bindQuickAddStripDrag(main);

    if (preferredMediaId) this.showMedia(preferredMediaId, instant);
  }

  bindQuickAddStripDrag(main) {
    if (!main || this.quickAddStripController) return;

    this.quickAddStripController = new AbortController();
    const options = { capture: true, signal: this.quickAddStripController.signal };
    main.addEventListener('pointerdown', this.handleQuickAddStripPointerDown, options);
    main.addEventListener('pointermove', this.handleQuickAddStripPointerMove, options);
    main.addEventListener('pointerup', this.handleQuickAddStripPointerUp, options);
    main.addEventListener('pointercancel', this.handleQuickAddStripPointerUp, options);
    main.addEventListener('lostpointercapture', this.handleQuickAddStripPointerUp, options);
  }

  handleQuickAddStripPointerDown(event) {
    if (this.galleryMode !== 'quick-add-strip' || !this.mainSwiper || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target.closest?.('button, a, input, select, textarea, video, iframe, model-viewer')) return;

    this.quickAddStripDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null,
      moved: false,
    };
    this.mainSwiper.allowTouchMove = false;
    // Capture only after a drag starts. Capturing on pointerdown retargets a
    // normal click to the carousel, losing the media that opens the lightbox.
    // Swiper's own pointer listeners must not compete with this desktop-only
    // fallback. A normal click still reaches the gallery click handler.
    event.stopPropagation();
  }

  handleQuickAddStripPointerMove(event) {
    const drag = this.quickAddStripDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.axis) {
      if (Math.hypot(deltaX, deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        this.finishQuickAddStripDrag(event, false);
        return;
      }
      drag.axis = 'horizontal';
      drag.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    if (drag.axis !== 'horizontal') return;
    event.preventDefault();
    event.stopPropagation();
  }

  handleQuickAddStripPointerUp(event) {
    const drag = this.quickAddStripDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const shouldSlide = drag.axis === 'horizontal' && drag.moved;
    const swiper = this.mainSwiper;
    if (shouldSlide && swiper && !swiper.destroyed) {
      const threshold = Math.max(24, (swiper.el.clientWidth || 0) * 0.08);
      if (Math.abs(deltaX) >= threshold) {
        const next = swiper.rtlTranslate ? deltaX > 0 : deltaX < 0;
        next ? swiper.slideNext() : swiper.slidePrev();
        event.preventDefault();
      }
    }

    this.finishQuickAddStripDrag(event, shouldSlide);
  }

  finishQuickAddStripDrag(event, moved) {
    const drag = this.quickAddStripDrag;
    if (!drag) return;

    const swiper = this.mainSwiper;
    this.quickAddStripDrag = null;
    event.currentTarget.releasePointerCapture?.(drag.pointerId);
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      this.lightboxZoomState.mediaSuppressClickUntil = performance.now() + 300;
    }
    window.requestAnimationFrame(() => {
      if (swiper && !swiper.destroyed) swiper.allowTouchMove = true;
    });
  }

  handleBreakpoint() {
    const activeMediaId = this.activeMediaId();
    this.initializeGallery(activeMediaId);
  }

  scheduleGalleryRefresh() {
    cancelAnimationFrame(this.galleryRefreshFrame);
    this.galleryRefreshFrame = requestAnimationFrame(() => {
      this.galleryRefreshFrame = null;
      if (!this.isConnected || !this.getClientRects().length) return;
      this.refreshGallery();
    });
  }

  refreshGallery() {
    const activeMediaId = this.activeMediaId();
    this.syncThumbnailVisibility();
    this.syncGalleryOverflow();
    this.initializeGallery(activeMediaId);
    this.mainSwiper?.update();
    this.thumbnailSwiper?.update();
  }

  handleVariantChange(event) {
    const variantId = String(event.detail?.variantId || event.detail?.variant?.id || '');
    const featuredMediaId = event.detail?.variant?.featured_media?.id;
    window.requestAnimationFrame(() => {
      this.dataset.currentVariantId = variantId;
      const filtersVariantMedia = this.applyVariantMediaFilter(variantId);
      this.syncThumbnailVisibility();
      this.syncGalleryOverflow();
      const visibleMediaIds = new Set(this.visibleSlides().map((slide) => String(slide.dataset.mediaId)));
      const mediaId = featuredMediaId && visibleMediaIds.has(String(featuredMediaId))
        ? String(featuredMediaId)
        : this.activeMediaId();
      this.dataset.currentVariantMediaId = mediaId || '';

      if (filtersVariantMedia) {
        this.destroyGallery();
        this.initializeGallery(mediaId, { instant: false });
        return;
      }

      if (this.galleryMode === 'desktop-static') {
        if (mediaId) this.scrollToMedia(String(mediaId), true);
        return;
      }
      this.mainSwiper?.update();
      this.thumbnailSwiper?.update();
      if (mediaId) this.showMedia(String(mediaId));
    });
  }

  handleClick(event) {
    const target = event.target;
    if (!target?.closest) return;

    // Pointer capture retargets the click following a drag to the dialog itself.
    // Consume it before either image zoom or the backdrop-close handler runs.
    if (target.closest('[data-product-media-lightbox]') && this.lightboxZoomState.suppressClickUntil > performance.now()) {
      this.lightboxZoomState.suppressClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (target.closest('[data-product-lightbox-close]')) {
      this.closeLightbox();
      event.stopPropagation();
      return;
    }
    if (this.lightboxTransition && target.closest('[data-product-media-lightbox]')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const lightboxThumbnail = target.closest('[data-product-lightbox-thumbnail]');
    if (lightboxThumbnail) {
      const slides = Array.from(this.lightboxSwiper?.slides || []);
      const index = slides.findIndex((slide) => String(slide.dataset.mediaId) === String(lightboxThumbnail.dataset.mediaId));
      if (index >= 0) this.lightboxSwiper?.slideTo(index);
      event.stopPropagation();
      return;
    }

    const lightboxImage = target.closest('.product-media-lightbox__image');
    if (lightboxImage) {
      this.toggleLightboxZoom(lightboxImage, event);
      event.stopPropagation();
      return;
    }

    const thumbnail = target.closest('[data-product-media-thumbnail]');
    if (thumbnail) {
      if (this.galleryMode === 'desktop-static') {
        this.scrollToMedia(thumbnail.dataset.mediaId);
      }
      return;
    }

    const media = target.closest('[data-product-media-content]');
    if (!media) return;
    const state = this.lightboxZoomState;
    if (state.mediaSuppressClickUntil > performance.now()) {
      state.mediaSuppressClickUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.activateMedia(media);
  }

  handleKeydown(event) {
    const target = event.target;
    if (!target?.closest) return;

    const lightboxSlide = target.closest('.product-media-lightbox__slide');
    if (lightboxSlide && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      const image = lightboxSlide.querySelector('.product-media-lightbox__image');
      if (image) this.toggleLightboxZoom(image, event);
      return;
    }

    const media = target.closest('[data-product-media-content]');
    if (!media || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    this.activateMedia(media);
  }

  handleLightboxPointerDown(event) {
    const state = this.lightboxZoomState;
    const target = event.target;
    const lightbox = target?.closest?.('[data-product-media-lightbox]');
    const image = target?.closest?.('.product-media-lightbox__image');
    if (lightbox && this.lightboxTransition) return;

    // Swiper can emit a click after a completed swipe; keep that synthetic click
    // from opening the lightbox while preserving a normal tap/click.
    if (!lightbox && target?.closest?.('[data-product-media-content]')) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      state.mediaPointerId = event.pointerId;
      state.mediaStartX = event.clientX;
      state.mediaStartY = event.clientY;
      state.mediaMoved = false;
      state.mediaSuppressClickUntil = 0;
      return;
    }

    if (!lightbox || !this.lightboxSwiper || state.dismissAnimating) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (state.scale <= 1) {
      const activeSlide = this.lightboxSwiper.slides?.[this.lightboxSwiper.activeIndex];
      const interactiveTarget = target.closest?.('button, a, input, select, textarea, [data-product-lightbox-thumbnail]');
      if (!activeSlide || interactiveTarget) return;

      state.dismissCandidate = true;
      state.dismissDragging = false;
      state.dismissPointerId = event.pointerId;
      state.dismissAxis = null;
      state.dismissStartX = event.clientX;
      state.dismissStartY = event.clientY;
      state.dismissOffset = 0;
      state.dismissImage = image;
      state.dismissCapture = lightbox;
      state.dismissSlide = activeSlide;
      return;
    }

    if (image !== state.image) return;

    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    state.moved = false;
    state.slide?.classList.add('is-dragging');
    image.setPointerCapture?.(event.pointerId);
    event.stopPropagation();
  }

  handleLightboxPointerMove(event) {
    const state = this.lightboxZoomState;
    if (state.mediaPointerId === event.pointerId) {
      const deltaX = event.clientX - state.mediaStartX;
      const deltaY = event.clientY - state.mediaStartY;
      if (!state.mediaMoved && Math.hypot(deltaX, deltaY) >= LIGHTBOX_DRAG_THRESHOLD) {
        state.mediaMoved = true;
      }
      if (state.mediaMoved) state.mediaSuppressClickUntil = performance.now() + 300;
      return;
    }

    if (state.dragging && state.pointerId === event.pointerId) {
      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      if (!state.moved && Math.hypot(deltaX, deltaY) < LIGHTBOX_DRAG_THRESHOLD) return;
      state.moved = true;
      const bounds = this.getLightboxPanBounds(state.slide);
      const resist = (value, min, max) => {
        if (value > max) return max + ((value - max) * 0.25);
        if (value < min) return min + ((value - min) * 0.25);
        return value;
      };
      state.x = resist(state.originX + deltaX, bounds.minX, bounds.maxX);
      state.y = resist(state.originY + deltaY, bounds.minY, bounds.maxY);
      this.applyLightboxZoom();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!state.dismissCandidate || state.dismissPointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.dismissStartX;
    const deltaY = event.clientY - state.dismissStartY;
    if (!state.dismissAxis) {
      if (Math.hypot(deltaX, deltaY) < 8) return;
      if (Math.abs(deltaX) > Math.abs(deltaY) * LIGHTBOX_DISMISS_AXIS_RATIO) {
        state.dismissAxis = 'horizontal';
        this.resetLightboxDismiss();
        return;
      }
      if (Math.abs(deltaY) <= Math.abs(deltaX) * LIGHTBOX_DISMISS_AXIS_RATIO) return;

      state.dismissAxis = 'vertical';
      state.dismissDragging = true;
      state.dismissCapture?.setPointerCapture?.(event.pointerId);
      this.lightbox?.classList.add('is-dismiss-dragging');
      if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = false;
    }

    if (state.dismissAxis !== 'vertical') return;
    state.dismissOffset = deltaY;
    this.applyLightboxDismiss();
    event.preventDefault();
    event.stopPropagation();
  }

  handleLightboxPointerUp(event) {
    const state = this.lightboxZoomState;
    if (state.mediaPointerId === event.pointerId) {
      if (state.mediaMoved && event.type === 'pointerup') {
        state.mediaSuppressClickUntil = performance.now() + 300;
      } else if (event.type === 'pointercancel') {
        state.mediaSuppressClickUntil = 0;
      }
      state.mediaPointerId = null;
      state.mediaMoved = false;
      return;
    }

    if (state.dragging && state.pointerId === event.pointerId) {
      state.image?.releasePointerCapture?.(event.pointerId);
      state.dragging = false;
      state.pointerId = null;
      state.slide?.classList.remove('is-dragging');
      this.clampLightboxPan(state.slide);
      if (state.moved) {
        state.suppressClickUntil = performance.now() + 250;
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (!state.dismissCandidate || state.dismissPointerId !== event.pointerId) return;

    if (state.dismissAxis === 'vertical') {
      this.finishLightboxDismiss(event.type === 'pointercancel');
      state.suppressClickUntil = performance.now() + 250;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.resetLightboxDismiss();
  }

  handleLightboxDragStart(event) {
    if (event.target?.closest?.('.product-media-lightbox__image, [data-product-media-content]')) {
      event.preventDefault();
    }
  }

  getLightboxPanBounds(slide) {
    const viewport = this.querySelector('[data-product-lightbox-swiper]');
    const zoomWidth = Number(slide?.dataset.zoomWidth || 0);
    const zoomHeight = Number(slide?.dataset.zoomHeight || 0);
    const viewportWidth = slide?.clientWidth || viewport?.clientWidth || 0;
    const viewportHeight = slide?.clientHeight || viewport?.clientHeight || 0;

    return {
      minX: zoomWidth <= viewportWidth ? (viewportWidth - zoomWidth) / 2 : viewportWidth - zoomWidth,
      maxX: zoomWidth <= viewportWidth ? (viewportWidth - zoomWidth) / 2 : 0,
      minY: zoomHeight <= viewportHeight ? (viewportHeight - zoomHeight) / 2 : viewportHeight - zoomHeight,
      maxY: zoomHeight <= viewportHeight ? (viewportHeight - zoomHeight) / 2 : 0,
    };
  }

  setLightboxPan(slide, x, y) {
    if (!slide) return;
    slide.dataset.panX = String(x);
    slide.dataset.panY = String(y);
    const image = slide.querySelector('.product-media-lightbox__image');
    const scale = Number(slide.dataset.zoomScale || 1);
    if (image) image.style.transform = `translate3d(${x}px, ${y}px, 0px) scale(${scale})`;
    if (this.lightboxZoomState.slide === slide) {
      this.lightboxZoomState.x = x;
      this.lightboxZoomState.y = y;
    }
  }

  layoutLightboxImage(slide) {
    const image = slide?.querySelector('.product-media-lightbox__image');
    if (!slide || !image) return { x: 0, y: 0 };

    image.loading = 'eager';
    const viewportWidth = slide.clientWidth || window.innerWidth;
    const viewportHeight = slide.clientHeight || window.innerHeight;
    const sourceWidth = Number(image.getAttribute('width')) || image.naturalWidth || viewportWidth;
    const sourceHeight = Number(image.getAttribute('height')) || image.naturalHeight || viewportHeight;
    const fit = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight, 1);
    const width = sourceWidth * fit;
    const height = sourceHeight * fit;
    slide.dataset.fitWidth = String(width);
    slide.dataset.fitHeight = String(height);
    slide.style.setProperty('--lightbox-fit-width', `${width}px`);
    slide.style.setProperty('--lightbox-fit-height', `${height}px`);
    slide.style.setProperty('--lightbox-fit-x', `${(viewportWidth - width) / 2}px`);
    slide.style.setProperty('--lightbox-fit-y', `${(viewportHeight - height) / 2}px`);
  }

  layoutLightboxImages() {
    const lightbox = this.lightbox;
    if (!lightbox) return;
    lightbox.classList.add('is-layout-updating');
    lightbox.querySelectorAll('.product-media-lightbox__slide').forEach((slide) => this.layoutLightboxImage(slide));
    lightbox.getBoundingClientRect();
    lightbox.classList.remove('is-layout-updating');
  }

  prepareLightboxZoom(slide) {
    const image = slide.querySelector('.product-media-lightbox__image');
    const width = Number(slide.dataset.fitWidth);
    const height = Number(slide.dataset.fitHeight);
    const sourceWidth = Number(image.getAttribute('width')) || width;
    const sourceHeight = Number(image.getAttribute('height')) || height;
    const scale = Math.max(1, Math.min(LIGHTBOX_ZOOM_SCALE, sourceWidth / width, sourceHeight / height, LIGHTBOX_MAX_IMAGE_SIZE / Math.max(width, height)));
    const zoomWidth = width * scale;
    const zoomHeight = height * scale;
    slide.dataset.zoomScale = String(scale);
    slide.dataset.zoomWidth = String(zoomWidth);
    slide.dataset.zoomHeight = String(zoomHeight);
    return scale;
  }

  clampLightboxPan(slide) {
    if (!slide) return;
    const bounds = this.getLightboxPanBounds(slide);
    const x = clamp(Number(slide.dataset.panX || 0), bounds.minX, bounds.maxX);
    const y = clamp(Number(slide.dataset.panY || 0), bounds.minY, bounds.maxY);
    this.setLightboxPan(slide, x, y);
  }

  get lightboxPanel() {
    return this.lightbox?.querySelector('.product-media-lightbox__panel');
  }

  getLightboxDismissThreshold() {
    const viewport = this.querySelector('[data-product-lightbox-swiper]');
    const height = viewport?.clientHeight || window.innerHeight;
    return Math.max(96, Math.min(240, height * 0.18));
  }

  applyLightboxDismiss() {
    const lightbox = this.lightbox;
    if (!lightbox) return;

    const viewport = this.querySelector('[data-product-lightbox-swiper]');
    const height = viewport?.clientHeight || window.innerHeight;
    const progress = clamp(Math.abs(this.lightboxZoomState.dismissOffset) / Math.max(1, height), 0, 1);
    lightbox.style.setProperty('--lightbox-dismiss-y', `${this.lightboxZoomState.dismissOffset}px`);
    lightbox.style.setProperty('--lightbox-dismiss-progress', String(progress));
    lightbox.style.setProperty('--lightbox-surface-amount', `${(1 - progress) * 100}%`);
  }

  finishLightboxDismiss(cancelled = false) {
    const state = this.lightboxZoomState;
    const panel = this.lightboxPanel;
    if (!panel) {
      this.resetLightboxDismiss();
      return;
    }

    state.dismissCandidate = false;
    state.dismissDragging = false;
    const pointerId = state.dismissPointerId;
    state.dismissPointerId = null;
    state.dismissCapture?.releasePointerCapture?.(pointerId);
    state.dismissImage?.releasePointerCapture?.(pointerId);
    state.dismissImage = null;
    state.dismissCapture = null;
    state.dismissSlide = null;
    this.lightbox?.classList.remove('is-dismiss-dragging');

    if (cancelled || Math.abs(state.dismissOffset) < this.getLightboxDismissThreshold()) {
      state.dismissOffset = 0;
      this.lightbox?.classList.add('is-dismiss-snapping');
      this.applyLightboxDismiss();
      window.clearTimeout(state.dismissTimer);
      state.dismissTimer = window.setTimeout(() => {
        this.lightbox?.classList.remove('is-dismiss-snapping');
      }, LIGHTBOX_DISMISS_ANIMATION_MS);
      if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = true;
      return;
    }

    this.closeLightbox();
  }

  resetLightboxDismiss() {
    const state = this.lightboxZoomState;
    window.clearTimeout(state.dismissTimer);
    state.dismissTimer = null;
    state.dismissCandidate = false;
    state.dismissDragging = false;
    state.dismissAnimating = false;
    state.dismissPointerId = null;
    state.dismissAxis = null;
    state.dismissOffset = 0;
    state.dismissImage = null;
    state.dismissCapture = null;
    state.dismissSlide = null;
    this.lightbox?.classList.remove('is-dismiss-dragging', 'is-dismiss-snapping', 'is-dismiss-animating');
    this.lightbox?.style.removeProperty('--lightbox-dismiss-y');
    this.lightbox?.style.removeProperty('--lightbox-dismiss-progress');
    this.lightbox?.style.removeProperty('--lightbox-surface-amount');
    if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = true;
  }

  toggleLightboxZoom(image, event = {}) {
    const state = this.lightboxZoomState;
    if (state.suppressClickUntil > performance.now()) {
      state.suppressClickUntil = 0;
      return;
    }

    const activeSlide = this.lightboxSwiper?.slides?.[this.lightboxSwiper.activeIndex];
    const slide = image.closest('.product-media-lightbox__slide');
    if (!activeSlide || slide !== activeSlide) return;

    if (state.scale > 1) {
      this.resetLightboxZoom();
      return;
    }

    const imageRect = image.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const hasPointerCoordinates = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY);
    state.image = image;
    state.slide = slide;
    state.scale = this.prepareLightboxZoom(slide);

    const bounds = this.getLightboxPanBounds(slide);
    const focusX = hasPointerCoordinates
      ? clamp(event.clientX - imageRect.left, 0, imageRect.width)
      : imageRect.width / 2;
    const focusY = hasPointerCoordinates
      ? clamp(event.clientY - imageRect.top, 0, imageRect.height)
      : imageRect.height / 2;
    const focusRatioX = imageRect.width > 0 ? focusX / imageRect.width : 0.5;
    const focusRatioY = imageRect.height > 0 ? focusY / imageRect.height : 0.5;
    const zoomWidth = Number(slide.dataset.zoomWidth || imageRect.width);
    const zoomHeight = Number(slide.dataset.zoomHeight || imageRect.height);
    const viewportFocusX = hasPointerCoordinates ? event.clientX - slideRect.left : slideRect.width / 2;
    const viewportFocusY = hasPointerCoordinates ? event.clientY - slideRect.top : slideRect.height / 2;

    state.x = clamp(viewportFocusX - (focusRatioX * zoomWidth), bounds.minX, bounds.maxX);
    state.y = clamp(viewportFocusY - (focusRatioY * zoomHeight), bounds.minY, bounds.maxY);
    this.applyLightboxZoom();
  }

  applyLightboxZoom() {
    const state = this.lightboxZoomState;
    if (!state.image || !state.slide) return;

    if (state.scale > 1) this.setLightboxPan(state.slide, state.x, state.y);
    else state.image.style.removeProperty('transform');
    state.slide.classList.toggle('is-zoomed', state.scale > 1);
    state.slide.setAttribute('aria-pressed', String(state.scale > 1));
    if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = state.scale <= 1;
  }

  clearLightboxZoom(slide) {
    if (!slide) return;

    slide.classList.remove('is-zoomed', 'is-dragging');
    slide.setAttribute('aria-pressed', 'false');
    slide.removeAttribute('data-zoom-width');
    slide.removeAttribute('data-zoom-height');
    slide.removeAttribute('data-zoom-scale');
    slide.removeAttribute('data-pan-x');
    slide.removeAttribute('data-pan-y');
    slide.style.removeProperty('--lightbox-zoom-width');
    slide.style.removeProperty('--lightbox-zoom-height');

    const image = slide.querySelector('.product-media-lightbox__image');
    image?.style.removeProperty('transform');
    image?.style.removeProperty('transform-origin');
  }

  resetLightboxZoom() {
    const state = this.lightboxZoomState;
    this.resetLightboxDismiss();
    this.lightbox?.querySelectorAll('.product-media-lightbox__slide').forEach((slide) => {
      this.clearLightboxZoom(slide);
    });
    state.scale = 1;
    state.x = 0;
    state.y = 0;
    state.image = null;
    state.slide = null;
    state.dragging = false;
    state.pointerId = null;
    state.moved = false;
    state.suppressClickUntil = 0;
    if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = true;
  }

  activateMedia(media) {
    if (!media.classList.contains('product-media--interactive')) return;
    if (this.dataset.zoom === 'open_lightbox') this.openLightbox(media.dataset.mediaId, media);
    if (this.dataset.zoom === 'click_hover') media.classList.toggle('is-zoomed');
  }

  syncThumbnailVisibility() {
    const slides = Array.from(this.querySelectorAll('[data-product-media]'));
    this.querySelectorAll('[data-product-media-thumbnail]').forEach((thumbnail) => {
      const slide = slides.find((item) => item.dataset.mediaId === thumbnail.dataset.mediaId);
      this.setMediaVisibility(thumbnail, Boolean(slide?.hidden));
    });
  }

  syncGalleryOverflow() {
    const visibleMediaCount = this.visibleSlides().length;
    const hasOverflow = visibleMediaCount > 1;
    this.dataset.visibleMediaCount = String(visibleMediaCount);
    this.syncQuickAddStripSlidesPerView();
    this.classList.toggle('product-media-gallery--single-media', !hasOverflow);

    this.querySelector('.media-thumbnails__carousel')?.toggleAttribute('hidden', !hasOverflow);
    this.querySelector('.media-gallery__controls')?.toggleAttribute('hidden', !hasOverflow);
    const showPagination = Boolean(this.mobileQuery?.matches)
      && this.dataset.mobileLayout === 'slider'
      && this.dataset.mobileShowPagination === 'true';
    this.syncPaginationVisibility(showPagination);
  }

  showMedia(mediaId, instant = false) {
    const slides = Array.from(this.mainSwiper?.slides || []);
    const index = slides.findIndex((slide) => String(slide.dataset.mediaId) === String(mediaId));
    if (index >= 0) this.mainSwiper.slideTo(index, instant ? 0 : undefined);
  }

  scrollToMedia(mediaId, instant = false) {
    const target = Array.from(this.querySelectorAll('[data-product-media]')).find(
      (media) => String(media.dataset.mediaId) === String(mediaId),
    );
    if (!target || target.hidden) return;
    target.scrollIntoView({
      behavior: instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'nearest',
    });
    this.querySelectorAll('[data-product-media-thumbnail]').forEach((thumbnail) => {
      thumbnail.setAttribute('aria-current', String(thumbnail.dataset.mediaId === String(mediaId)));
    });
  }

  openLightbox(mediaId, opener) {
    if (!this.lightbox?.showModal) return;
    const sourceImage = opener?.querySelector('img');
    const sourceGeometry = sourceImage && this.lightboxImageGeometry(sourceImage);
    this.lightboxOpener = opener;
    this.destroyLightbox(false);
    // Native dialog focus restoration must belong to this opening, not the
    // previously focused gallery item (pointer activation need not focus it).
    opener?.focus({ preventScroll: true });
    this.lightbox.showModal();
    this.lightbox.querySelector('[data-product-lightbox-close]')?.focus({ preventScroll: true });
    document.documentElement.classList.add('product-media-lightbox-open');

    const viewport = this.querySelector('[data-product-lightbox-swiper]');
    if (!viewport) return;
    this.lightboxSwiper = createSwiperCarousel(viewport, {
      modules: [EffectFade],
      effect: 'fade',
      fadeEffect: { crossFade: true },
      slidesPerView: 1,
      watchOverflow: true,
      speed: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240,
      controls: {
        scope: this.lightbox,
        previous: '[data-product-lightbox-previous]',
        next: '[data-product-lightbox-next]'
      },
      a11y: { enabled: true },
    });
    this.resetLightboxZoom();
    this.layoutLightboxImages();
    const index = Array.from(this.lightboxSwiper.slides).findIndex(
      (slide) => String(slide.dataset.mediaId) === String(mediaId),
    );
    if (index >= 0) this.lightboxSwiper.slideTo(index, 0);
    this.updateLightboxCounter();
    this.lightboxSwiper.on('slideChange', () => {
      this.resetLightboxZoom();
      this.updateLightboxCounter();
    });
    this.animateLightboxTransition(true, sourceImage, sourceGeometry);
  }

  // Measure the painted image, including object-fit cropping in the gallery.
  lightboxImageGeometry(image) {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    const ratio = (Number(image.getAttribute('width')) || image.naturalWidth) /
      (Number(image.getAttribute('height')) || image.naturalHeight);
    if (!ratio || !rect.width || !rect.height) return null;
    const cover = style.objectFit === 'cover';
    const width = (cover ? rect.width / rect.height < ratio : rect.width / rect.height > ratio)
      ? rect.height * ratio : rect.width;
    const height = width / ratio;
    const position = style.objectPosition.split(' ').map((value) => Number.parseFloat(value) / 100);
    const x = rect.left + (rect.width - width) * (Number.isFinite(position[0]) ? position[0] : 0.5);
    const y = rect.top + (rect.height - height) * (Number.isFinite(position[1]) ? position[1] : 0.5);
    return { x, y, width, height, clip: [Math.max(0, rect.top - y) / height * 100,
      Math.max(0, x + width - rect.right) / width * 100,
      Math.max(0, y + height - rect.bottom) / height * 100,
      Math.max(0, rect.left - x) / width * 100] };
  }

  clearLightboxTransition() {
    const transition = this.lightboxTransition;
    this.lightboxTransition = null;
    transition?.animations.forEach((animation) => animation.cancel());
    transition?.clone?.remove();
    transition?.source?.classList.remove('is-lightbox-source');
    this.lightbox?.classList.remove('is-transitioning', 'is-closing');
  }

  async animateLightboxTransition(opening, source, sourceGeometry) {
    const lightbox = this.lightbox;
    const slide = this.lightboxSwiper?.slides?.[this.lightboxSwiper.activeIndex];
    const image = slide?.querySelector('.product-media-lightbox__image');
    if (!image || !source || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (!opening) this.finishLightboxClose();
      return;
    }
    const from = sourceGeometry || this.lightboxImageGeometry(opening ? source : (this.lightboxTransition?.clone || image));
    const to = this.lightboxImageGeometry(opening ? image : source);
    this.clearLightboxTransition();
    if (!from || !to) {
      if (!opening) this.finishLightboxClose();
      return;
    }
    const clone = image.cloneNode(false);
    clone.className = 'product-media-lightbox__transition-image';
    clone.alt = '';
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('style');
    clone.src = opening ? source.currentSrc || source.src : image.currentSrc || image.src;
    clone.style.width = `${to.width}px`;
    clone.style.height = `${to.height}px`;
    lightbox.append(clone);
    source.classList.add('is-lightbox-source');
    lightbox.classList.add('is-transitioning');
    lightbox.classList.toggle('is-closing', !opening);
    const options = { duration: 333, easing: 'cubic-bezier(0.4, 0, 0.22, 1)', fill: 'both' };
    const frame = (rect) => ({
      transform: `translate3d(${rect.x}px, ${rect.y}px, 0) scale(${rect.width / to.width}, ${rect.height / to.height})`,
      clipPath: `inset(${rect.clip.map((value) => `${value}%`).join(' ')})`,
    });
    const animations = [clone.animate([frame(from), frame(to)], options)];
    const panel = this.lightboxPanel;
    const background = getComputedStyle(panel).backgroundColor;
    animations.push(panel.animate({ backgroundColor: opening ? ['transparent', background] : [background, 'transparent'] }, options));
    for (const control of lightbox.querySelectorAll('.product-media-lightbox__toolbar, .product-media-lightbox__navigation, .product-media-lightbox__thumbnails')) {
      animations.push(control.animate({ opacity: opening ? [0, 1] : [1, 0] }, options));
    }
    const backdropColor = getComputedStyle(lightbox, '::backdrop').backgroundColor;
    animations.push(lightbox.animate({ backgroundColor: opening ? ['transparent', backdropColor] : [backdropColor, 'transparent'] }, { ...options, pseudoElement: '::backdrop' }));
    const transition = { clone, source, animations };
    this.lightboxTransition = transition;
    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    if (this.lightboxTransition !== transition) return;
    if (!opening) this.finishLightboxClose();
    this.clearLightboxTransition();
  }

  finishLightboxClose() {
    // dialog.close() restores focus synchronously. Swiper's A11y listener
    // otherwise queues a slideTo for that old focus target on the next frame.
    const a11y = this.mainSwiper?.params.a11y;
    const scrollOnFocus = a11y?.scrollOnFocus;
    if (a11y) a11y.scrollOnFocus = false;
    try {
      this.lightbox?.close();
      if (this.lightboxOpener?.isConnected) this.lightboxOpener.focus({ preventScroll: true });
    } finally {
      if (a11y) a11y.scrollOnFocus = scrollOnFocus;
    }
  }

  closeLightbox() {
    if (!this.lightbox?.open || this.lightbox.classList.contains('is-closing')) return;
    const slide = this.lightboxSwiper?.slides?.[this.lightboxSwiper.activeIndex];
    const mediaId = slide?.dataset.mediaId;
    const media = Array.from(this.querySelectorAll('[data-product-media-content]')).find((item) =>
      item.dataset.mediaId === mediaId && !item.closest('[data-product-media]')?.hidden);
    if (media && this.mainSwiper) this.showMedia(mediaId, true);
    if (media) this.lightboxOpener = media;
    this.animateLightboxTransition(false, media?.querySelector('img'));
  }

  updateLightboxCounter() {
    const current = this.querySelector('[data-product-lightbox-current]');
    const total = this.querySelector('[data-product-lightbox-total]');
    const activeIndex = this.lightboxSwiper?.realIndex ?? this.lightboxSwiper?.activeIndex ?? 0;
    if (current) current.textContent = String(activeIndex + 1);
    if (total) total.textContent = String(this.lightboxSwiper?.slides?.length || 0);
    this.updateLightboxThumbnailState(activeIndex);
  }

  updateLightboxThumbnailState(activeIndex = 0) {
    this.querySelectorAll('[data-product-lightbox-thumbnail]').forEach((thumbnail, index) => {
      const isActive = index === activeIndex;
      thumbnail.classList.toggle('is-active', isActive);
      thumbnail.setAttribute('aria-current', String(isActive));
      if (isActive && typeof thumbnail.scrollIntoView === 'function') {
        thumbnail.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });
  }

  destroyLightbox(restoreFocus = true) {
    this.clearLightboxTransition();
    this.resetLightboxZoom();
    destroySwiperCarousel(this.lightboxSwiper);
    this.lightboxSwiper = null;
    document.documentElement.classList.remove('product-media-lightbox-open');
    if (restoreFocus && this.lightboxOpener?.isConnected) this.lightboxOpener.focus({ preventScroll: true });
    if (restoreFocus) this.lightboxOpener = null;
  }

  initializeShopifyMedia() {
    const modelViewers = this.querySelectorAll('model-viewer');
    if (!modelViewers.length || !window.Shopify?.loadFeatures) return;
    window.Shopify.loadFeatures([
      {
        name: 'model-viewer-ui',
        version: '1.0',
        onLoad: (error) => {
          if (error || !window.Shopify?.ModelViewerUI) return;
          modelViewers.forEach((modelViewer) => {
            if (modelViewer.dataset.modelViewerInitialized === 'true') return;
            new window.Shopify.ModelViewerUI(modelViewer);
            modelViewer.dataset.modelViewerInitialized = 'true';
          });
        },
      },
    ]);
  }
}

if (!customElements.get('product-media-gallery')) {
  customElements.define('product-media-gallery', ProductMediaGallery);
}
