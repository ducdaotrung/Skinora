/* Shared presentation lifecycle. Feature controllers own only their content. */
(() => {
  const mobile = window.matchMedia('(max-width: 767.98px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  const instances = new WeakMap();
  const backdropCursorOwners = new Set();
  const transitionBuffer = 16;
  const duration = (element) => {
    if (!element) return 0;
    const style = getComputedStyle(element);
    const milliseconds = (value) => {
      const normalized = String(value || '').trim();
      const amount = parseFloat(normalized);
      return Number.isFinite(amount) ? amount * (normalized.endsWith('ms') ? 1 : 1000) : 0;
    };
    const timedValues = (values, delays) => {
      const durations = String(values || '0s').split(',').map(milliseconds);
      const offsets = String(delays || '0s').split(',').map(milliseconds);
      return Math.max(0, ...durations.map((value, index) => value + (offsets[index % offsets.length] || 0)));
    };
    return Math.max(
      timedValues(style.transitionDuration, style.transitionDelay),
      timedValues(style.animationDuration, style.animationDelay),
    );
  };

  const hideBackdropCursor = ({ cursor, owner, root }) => {
    root?.classList.remove('cursor-none');
    backdropCursorOwners.delete(owner);
    if (backdropCursorOwners.size > 0) return;
    cursor?.classList.remove('active');
    document.documentElement?.classList?.toggle?.('component-overlay-backdrop-cursor', false);
    const scheme = cursor?.dataset?.backdropCursorScheme;
    if (scheme) cursor.classList.remove(scheme);
    cursor?.classList.remove('color-scheme', 'section-color-scope');
    if (cursor?.dataset) delete cursor.dataset.backdropCursorScheme;
  };

  const updateBackdropCursor = ({ cursor, owner, root, colorSource, isOpen, event }) => {
    if (!cursor || !pointerMedia.matches || !isOpen()) {
      hideBackdropCursor({ cursor, owner, root });
      return;
    }

    cursor.style.setProperty('--cursor-x', `${event.clientX}px`);
    cursor.style.setProperty('--cursor-y', `${event.clientY}px`);
    const source = typeof colorSource === 'function' ? colorSource() : colorSource;
    const overlayStyle = getComputedStyle(source || root);
    cursor.style.setProperty('--color-cursor-text', overlayStyle.getPropertyValue?.('--overlay-text-color') || '');
    cursor.style.setProperty('--color-cursor-background', overlayStyle.getPropertyValue?.('--overlay-background-color') || '');
    const scheme = root?.dataset.overlayColorScheme
      || Array.from(root?.classList || []).find((className) => /^scheme-[a-z0-9_-]+$/i.test(className));
    if (cursor.dataset.backdropCursorScheme && cursor.dataset.backdropCursorScheme !== scheme) {
      cursor.classList.remove(cursor.dataset.backdropCursorScheme);
    }
    if (scheme) {
      cursor.classList.add('color-scheme', 'section-color-scope', scheme);
      cursor.dataset.backdropCursorScheme = scheme;
    }
    cursor.classList.add('active');
    root?.classList.add('cursor-none');
    backdropCursorOwners.add(owner);
    document.documentElement?.classList?.toggle?.('component-overlay-backdrop-cursor', true);
  };

  const bindBackdropCursor = ({ backdrop, owner = backdrop, root = backdrop, colorSource = root, isOpen = () => true }) => {
    const cursor = document.querySelector?.('custom-cursor[data-component-overlay-cursor]');
    if (!backdrop || !cursor) return null;

    const controller = new AbortController();
    const options = { signal: controller.signal };
    const update = (event) => updateBackdropCursor({ cursor, owner, root, colorSource, isOpen, event });
    const hide = () => hideBackdropCursor({ cursor, owner, root });
    backdrop.addEventListener('mousemove', update, options);
    backdrop.addEventListener('mouseleave', hide, options);
    window.addEventListener?.('mouseout', (event) => {
      if (!event.relatedTarget) hide();
    }, options);
    window.addEventListener?.('blur', hide, options);

    return {
      hide,
      destroy() {
        hide();
        controller.abort();
      },
    };
  };

  class SheetGesture {
    constructor({ panel, header, backdrop, enabled, close, delegated = false }) {
      Object.assign(this, { panel, header, backdrop, enabled, close });
      this.resistance = 0.32;
      this.scrollTarget = panel?.querySelector?.('.component-overlay__body') || panel;
      this.activationDistance = 8;
      this.controller = new AbortController();
      const options = { signal: this.controller.signal };
      if (!delegated) panel?.addEventListener('pointerdown', (event) => this.start(event), options);
      panel?.addEventListener('pointermove', (event) => this.move(event), options);
      panel?.addEventListener('pointerup', (event) => this.end(event), options);
      panel?.addEventListener('pointercancel', (event) => this.end(event, true), options);
      panel?.addEventListener('lostpointercapture', () => { if (this.drag) this.reset(); }, options);
      mobile.addEventListener('change', () => this.reset(), options);
    }

    isHeaderTarget(target) {
      return target === this.header || Boolean(this.header?.contains?.(target));
    }

    getDismissDistance() {
      return Math.min(140, Math.max(1, (this.panel?.offsetHeight || 0) * 0.2));
    }

    getDragOffset(distance) {
      const resistanceStart = this.getDismissDistance();

      if (distance <= resistanceStart) return distance;

      return resistanceStart + (distance - resistanceStart) * this.resistance;
    }

    setDragProgress(progress) {
      const value = String(Math.min(1, Math.max(0, progress)));

      this.panel?.style.setProperty('--sheet-drag-progress', value);
      this.backdrop?.style.setProperty('--sheet-drag-progress', value);
    }

    clearDragProgress() {
      this.panel?.style.removeProperty('--sheet-drag-progress');
      this.backdrop?.style.removeProperty('--sheet-drag-progress');
    }

    releasePointer(pointerId) {
      if (pointerId === undefined || pointerId === null || !this.panel?.hasPointerCapture?.(pointerId)) return;
      this.panel.releasePointerCapture(pointerId);
    }

    start(event) {
      const target = event.target;
      const interactiveTarget = target?.closest?.('button, a, input, select, textarea, summary, iframe, [contenteditable="true"], [role="button"], [draggable="true"], [data-no-sheet-drag]');
      if (!this.enabled() || !event.isPrimary || event.button !== 0 || interactiveTarget) return;
      if (!this.isHeaderTarget(target) && (this.scrollTarget?.scrollTop || 0) > 0) return;
      this.reset();
      this.drag = {
        id: event.pointerId,
        start: event.clientY,
        last: event.clientY,
        time: performance.now(),
        distance: 0,
        offset: 0,
        velocity: 0,
        active: false,
        startScrollTop: this.scrollTarget?.scrollTop || 0,
      };
      this.panel?.setPointerCapture?.(event.pointerId);
    }

    move(event) {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const now = performance.now();
      drag.velocity = (event.clientY - drag.last) / Math.max(1, now - drag.time);
      drag.last = event.clientY;
      drag.time = now;
      const distance = event.clientY - drag.start;
      if (!drag.active) {
        if (distance <= -this.activationDistance || (this.scrollTarget?.scrollTop || 0) > drag.startScrollTop) {
          this.reset();
          return;
        }
        if (distance < this.activationDistance) return;
        drag.active = true;
        this.panel.classList.add('is-sheet-dragging');
        this.panel.style.transition = 'none';
        this.panel.style.transform = 'translateY(0)';
      }
      drag.distance = Math.max(0, distance);
      drag.offset = this.getDragOffset(drag.distance);
      this.panel.style.transform = `translate3d(0, ${drag.offset}px, 0)`;
      this.setDragProgress(drag.offset / Math.max(1, this.panel.offsetHeight || 0));
      event.preventDefault();
    }

    end(event, cancelled = false) {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      if (!drag.active) {
        this.reset();
        return;
      }
      const dismiss = !cancelled && (drag.distance >= this.getDismissDistance() || (drag.distance >= 32 && drag.velocity > 0.55 && performance.now() - drag.time < 100));
      this.drag = null;
      this.releasePointer(drag.id);
      this.panel.classList.remove('is-sheet-dragging');
      this.panel.style.transition = reduced.matches
        ? 'none'
        : 'transform var(--overlay-motion-duration, var(--motion-duration-standard)) var(--overlay-motion-ease, var(--motion-ease-standard)), opacity var(--overlay-motion-duration, var(--motion-duration-standard)) var(--overlay-motion-ease, var(--motion-ease-standard))';
      if (dismiss) {
        this.setDragProgress(1);
        this.close();
      }
      if (reduced.matches) { this.reset(); return; }
      this.frame = requestAnimationFrame(() => {
        this.panel.style.transform = dismiss ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0, 0)';
        if (!dismiss) this.setDragProgress(0);
        this.timer = setTimeout(() => this.reset(), duration(this.panel) + transitionBuffer);
      });
    }

    reset() {
      clearTimeout(this.timer);
      cancelAnimationFrame(this.frame);
      const drag = this.drag;
      this.drag = null;
      if (drag) this.releasePointer(drag.id);
      this.panel.classList.remove('is-sheet-dragging');
      this.panel.style.removeProperty('transition');
      this.panel.style.removeProperty('transform');
      this.clearDragProgress();
    }

    destroy() { this.reset(); this.controller.abort(); }
  }

  class Overlay {
    constructor(dialog) {
      this.dialog = dialog;
      this.originalParent = null;
      this.originalNextSibling = null;
      this.portaled = false;
      this.portalContextClass = null;
      this.openFrame = null;
      this.panel = dialog.querySelector('.component-overlay__panel');
      this.backdrop = dialog.querySelector('[data-component-overlay-backdrop]');
      this.backdropCursorBinding = bindBackdropCursor({
        backdrop: this.backdrop,
        owner: this,
        root: this.dialog,
        colorSource: this.dialog,
        isOpen: () => this.isOpen() && this.dialog.dataset.state === 'open',
      });
      this.portalToBody();
      this.controller = new AbortController();
      const options = { signal: this.controller.signal };
      this.gesture = new SheetGesture({
        panel: this.panel,
        header: dialog.querySelector('.component-overlay__header'),
        backdrop: this.backdrop,
        enabled: () => mobile.matches && dialog.dataset.mobileLayout === 'bottom_sheet' && dialog.dataset.state === 'open',
        close: () => this.close({ fromGesture: true, restoreFocus: false }),
      });
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close();
          return;
        }
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, iframe, [tabindex]')]
          .filter((element) => !element.disabled && element.tabIndex >= 0 && !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus({ preventScroll: true });
        }
      }, options);
      dialog.addEventListener('click', (event) => {
        if (event.target.closest('[data-overlay-close]')) {
          // Pointer dismissal should not put focus back on a product-card
          // action. Keyboard activation still returns focus for accessibility.
          this.close({ restoreFocus: event.detail === 0 });
          return;
        }
      }, options);
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.close({ restoreFocus: false }), options);
      }
    }

    isOpen() {
      return this.dialog.dataset.state !== 'closed' && !this.dialog.hidden;
    }

    hideBackdropCursor() {
      this.backdropCursorBinding?.hide();
    }

    updateBackdropCursor(event) {
      if (!this.backdropCursorBinding) return;
      const cursor = document.querySelector?.('custom-cursor[data-component-overlay-cursor]');
      updateBackdropCursor({
        cursor,
        owner: this,
        root: this.dialog,
        colorSource: this.dialog,
        isOpen: () => this.isOpen() && this.dialog.dataset.state === 'open',
        event,
      });
    }

    portalToBody() {
      if (!this.dialog.hasAttribute?.('data-append-to-body') || !document.body || this.dialog.parentElement === document.body) return;

      this.originalParent = this.dialog.parentNode;
      this.originalNextSibling = this.dialog.nextSibling;

      const context = this.dialog.closest('[data-overlay-color-scheme], .color-scheme');
      const contextClass = context?.dataset.overlayColorScheme
        || [...(context?.classList || [])].find((className) => /^scheme-[a-z0-9_-]+$/i.test(className));
      if (contextClass && !this.dialog.classList.contains(contextClass)) {
        this.portalContextClass = contextClass;
        this.dialog.classList.add(contextClass);
      }

      document.body.append(this.dialog);
      this.portaled = true;
    }

    restoreFromBody() {
      if (!this.portaled) return;

      if (this.portalContextClass) this.dialog.classList.remove(this.portalContextClass);
      if (this.originalParent) {
        const nextSibling = this.originalNextSibling?.parentNode === this.originalParent
          ? this.originalNextSibling
          : null;
        this.originalParent.insertBefore(this.dialog, nextSibling);
      } else {
        this.dialog.remove();
      }
      this.portaled = false;
    }

    finishClose() {
      clearTimeout(this.timer);
      this.cancelOpenFrame();
      this.hideBackdropCursor();
      this.gesture.reset();
      this.dialog.dataset.state = 'closed';
      this.dialog.open = false;
      this.dialog.hidden = true;
      this.dialog.removeAttribute('open');
      this.dialog.setAttribute('aria-hidden', 'true');
      this.dialog.dispatchEvent?.(new Event('close'));
      const opener = this.opener;
      const restoreFocus = this.restoreFocus;
      opener?.setAttribute('aria-expanded', 'false');
      this.opener = null;

      if (restoreFocus && opener?.isConnected && !opener.hidden) {
        opener.focus({ preventScroll: true });
        return;
      }

      if (!restoreFocus) {
        // Browser focus fixup can run after the overlay hides. Clear the opener
        // again on the next task so pointer dismissal cannot leave :focus-within
        // active on the product card.
        const clearOpenerFocus = () => {
          if (this.isOpen() || this.opener || document.activeElement !== opener) return;
          opener?.blur?.();
        };
        clearOpenerFocus();
        setTimeout(clearOpenerFocus, 0);
      }
    }

    cancelOpenFrame() {
      cancelAnimationFrame(this.openFrame);
      this.openFrame = null;
    }

    open({ opener = document.activeElement, focus = true, defer = false, restoreFocus = true } = {}) {
      clearTimeout(this.timer);
      this.cancelOpenFrame();
      this.gesture.reset();
      this.hideBackdropCursor();
      if (this.isOpen() && this.dialog.dataset.state === 'open') return;
      this.opener = opener;
      this.restoreFocus = restoreFocus;
      this.opener?.setAttribute('aria-expanded', 'true');
      this.dialog.open = true;
      this.dialog.hidden = false;
      this.dialog.setAttribute('open', '');
      this.dialog.setAttribute('aria-hidden', 'false');
      this.dialog.dataset.state = 'opening';
      void this.dialog.offsetHeight;
      const reveal = () => {
        this.openFrame = null;
        if (!this.isOpen() || this.dialog.dataset.state !== 'opening') return;
        this.dialog.dataset.state = 'open';
        this.dialog.dispatchEvent?.(new Event('open'));
        const close = this.dialog.querySelector('[data-overlay-close]');
        if (focus) close?.focus({ preventScroll: true });
        else close?.blur?.();
      };
      if (defer && !reduced.matches) this.openFrame = requestAnimationFrame(reveal);
      else reveal();
    }

    close({ restoreFocus = true, immediate = false, fromGesture = false } = {}) {
      if (!this.isOpen()) return;
      clearTimeout(this.timer);
      this.cancelOpenFrame();
      this.hideBackdropCursor();
      this.restoreFocus = restoreFocus;
      if (!fromGesture) this.gesture.reset();
      this.dialog.dataset.state = 'closing';
      const finish = () => {
        if (!this.isOpen()) return;
        this.finishClose();
      };
      if (immediate || reduced.matches) finish();
      else this.timer = setTimeout(finish, Math.max(duration(this.panel), duration(this.backdrop)) + transitionBuffer);
    }

    destroy() {
      this.close({ immediate: true, restoreFocus: false });
      this.gesture.destroy();
      this.backdropCursorBinding?.destroy();
      this.controller.abort();
      instances.delete(this.dialog);
      this.restoreFromBody();
    }
  }

  window.ThemeOverlay = {
    mobile,
    SheetGesture,
    bindBackdropCursor,
    get(dialog) {
      if (!dialog) return null;
      if (!instances.has(dialog)) instances.set(dialog, new Overlay(dialog));
      return instances.get(dialog);
    },
  };
})();
