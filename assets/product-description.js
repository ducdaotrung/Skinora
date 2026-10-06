class ProductDescription extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.content = this.querySelector('[data-description-content]');
    this.flow = this.querySelector('[data-description-flow]') || this.content;
    this.toggle = this.querySelector('[data-description-toggle]');
    this.toggleLabel = this.toggle?.querySelector('[data-description-toggle-label]');
    this.measureFrame = null;
    this.resizeObserver = null;

    this.handleToggle = this.handleToggle.bind(this);
    this.scheduleMeasure = this.scheduleMeasure.bind(this);
    this.measure = this.measure.bind(this);

    if (!this.content || !this.flow || !this.toggle || this.dataset.descriptionHeight === 'none') {
      this.dataset.descriptionReady = 'true';
      this.dataset.descriptionState = 'full';
      return;
    }

    this.toggle.addEventListener('click', this.handleToggle, { signal: this.signal });
    window.addEventListener('resize', this.scheduleMeasure, { signal: this.signal });
    this.content.addEventListener('load', this.scheduleMeasure, { capture: true, signal: this.signal });

    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(this.scheduleMeasure);
      this.resizeObserver.observe(this.flow);
    }

    this.dataset.descriptionReady = 'true';
    this.scheduleMeasure();
    const fontsReady = document.fonts?.ready;
    fontsReady?.then(this.scheduleMeasure).catch(() => {});
  }

  disconnectedCallback() {
    window.cancelAnimationFrame(this.measureFrame);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.abortController?.abort();
    this.abortController = null;
    this.signal = null;
    this.content = null;
    this.flow = null;
    this.toggle = null;
    this.toggleLabel = null;
  }

  scheduleMeasure() {
    if (!this.isConnected || !this.content || !this.flow || !this.toggle || this.measureFrame != null) return;

    this.measureFrame = window.requestAnimationFrame(() => {
      this.measureFrame = null;
      this.measure();
    });
  }

  measure() {
    if (!this.isConnected || !this.content || !this.flow || !this.toggle) return;

    const previousState = this.dataset.descriptionState;
    const wasExpanded = previousState === 'expanded';

    this.dataset.descriptionState = 'expanded';
    const fullHeight = this.flow.scrollHeight;
    if (!fullHeight) {
      this.dataset.descriptionState = 'full';
      this.toggle.hidden = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      return;
    }

    this.content.style.setProperty('--product-description-expanded-height', `${fullHeight}px`);
    this.dataset.descriptionState = 'collapsed';
    const collapsedHeight = this.content.clientHeight;
    const hasOverflow = fullHeight > collapsedHeight + 1;

    if (!hasOverflow) {
      this.dataset.descriptionState = 'full';
      this.toggle.hidden = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      return;
    }

    this.dataset.descriptionState = wasExpanded ? 'expanded' : 'collapsed';
    this.toggle.hidden = false;
    this.toggle.setAttribute('aria-expanded', String(wasExpanded));
    this.updateToggleLabel(wasExpanded);
  }

  updateToggleLabel(isExpanded) {
    if (!this.toggleLabel || !this.toggle) return;

    const label = isExpanded ? this.toggle.dataset.lessLabel : this.toggle.dataset.moreLabel;
    if (label) this.toggleLabel.textContent = label;
  }

  handleToggle() {
    const isExpanded = this.dataset.descriptionState === 'expanded';
    this.dataset.descriptionState = isExpanded ? 'collapsed' : 'expanded';
    this.toggle?.setAttribute('aria-expanded', String(!isExpanded));
    this.updateToggleLabel(!isExpanded);

    if (!isExpanded) this.scheduleMeasure();
  }
}

if (!customElements.get('product-description')) {
  customElements.define('product-description', ProductDescription);
}
