(() => {
  if (customElements.get('lh-editorial-text')) return;
  const clamp = value => Math.max(0, Math.min(1, value));

  class EditorialText extends HTMLElement {
    static get observedAttributes() {
      return ['data-editorial-reveal', 'data-editorial-speed', 'data-editorial-opacity'];
    }
    attributeChangedCallback(name, previous, next) {
      if (previous === next || !this.isConnected) return;
      this.teardown();
      this.setup();
    }
    connectedCallback() {
      queueMicrotask(() => { if (this.isConnected && !this.controller) this.setup(); });
    }
    disconnectedCallback() { this.teardown(); }

    setup() {
      this.base = this.querySelector('.editorial-text-block__base');
      if (!this.base || this.dataset.editorialReveal !== 'true') return;
      this.original = this.base.innerHTML;
      this.units = [];
      this.frame = 0;
      this.selected = false;
      this.controller = new AbortController();
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.anchor = this.closest('.parallax-section__inner') || this;
      const walker = document.createTreeWalker(this.base, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        const accessible = document.createElement('span');
        accessible.className = 'visually-hidden';
        accessible.textContent = node.textContent;
        fragment.append(accessible);
        for (const character of node.textContent) {
          const letter = document.createElement('span');
          letter.className = 'editorial-reading-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = character;
          fragment.append(letter);
          this.units.push(letter);
        }
        node.replaceWith(fragment);
      });
      const options = { signal: this.controller.signal };
      this.schedule = () => {
        if (!this.frame) this.frame = requestAnimationFrame(() => this.update());
      };
      window.addEventListener('scroll', this.schedule, { ...options, passive: true });
      window.addEventListener('resize', this.schedule, options);
      this.motion.addEventListener('change', this.schedule, options);
      this.resizeObserver = new ResizeObserver(this.schedule);
      this.resizeObserver.observe(this.base);
      document.addEventListener('shopify:block:select', event => {
        if (event.target !== this && !event.target.contains(this)) return;
        this.selected = true;
        this.schedule();
      }, options);
      document.addEventListener('shopify:block:deselect', event => {
        if (event.target !== this && !event.target.contains(this)) return;
        this.selected = false;
        this.schedule();
      }, options);
      this.update();
    }

    update() {
      this.frame = 0;
      const speed = { slow: .65, medium: 1, fast: 1.5 }[this.dataset.editorialSpeed] || 1;
      const opacity = clamp(Number(this.dataset.editorialOpacity) / 100);
      const viewport = window.innerHeight;
      const top = this.anchor.getBoundingClientRect().top;
      const height = this.base.getBoundingClientRect().height;
      const progress = this.motion.matches || this.selected ? 1
        : clamp((viewport * .85 - top) / Math.max(height + viewport * .5 / speed, 1));
      const edge = progress * (this.units.length + 15);
      this.units.forEach((unit, index) => {
        const value = String(opacity + (1 - opacity) * clamp((edge - index) / 16));
        if (unit.style.opacity !== value) unit.style.opacity = value;
      });
    }

    teardown() {
      if (!this.controller) return;
      this.controller.abort();
      this.controller = null;
      cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      this.base.innerHTML = this.original;
      this.units = [];
    }
  }
  customElements.define('lh-editorial-text', EditorialText);
})();
