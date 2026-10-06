(() => {
  if (customElements.get('lh-parallax')) return;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  // Reference motion contract: staggered columns, a 30–70% travel band and
  // different movement shares by DOM order. Content determines section height.
  const shares = [.2, .6, .3, .05, .5, 1];
  const columns = ['left', 'center', 'right'];

  class Parallax extends HTMLElement {
    connectedCallback() {
      queueMicrotask(() => { if (this.isConnected && !this.controller) this.setup(); });
    }
    disconnectedCallback() { this.teardown(); }

    setup() {
      this.grid = this.querySelector('.parallax-section__grid');
      if (!this.grid) return;
      this.root = this.closest('.parallax-section');
      this.inner = this.closest('.parallax-section__inner');
      this.controller = new AbortController();
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.frame = this.packFrame = 0;
      this.visible = false;
      this.items = [];
      this.collectItems();
      this.resizeObserver = new ResizeObserver(() => this.schedulePack());
      this.resizeObserver.observe(this.inner);
      this.items.forEach(item => this.resizeObserver.observe(item.element));
      this.mutationObserver = new MutationObserver(() => {
        this.items.forEach(item => this.resizeObserver.unobserve(item.element));
        this.unpack();
        this.collectItems();
        this.items.forEach(item => this.resizeObserver.observe(item.element));
        this.schedulePack();
      });
      this.mutationObserver.observe(this.grid, { childList: true });
      this.intersectionObserver = new IntersectionObserver(entries => {
        this.visible = entries.some(entry => entry.isIntersecting);
        if (this.visible) this.start();
        else this.stop();
      }, { rootMargin: '200px' });
      this.intersectionObserver.observe(this.root);
      const options = { signal: this.controller.signal };
      window.addEventListener('scroll', () => { if (this.visible) this.start(); }, { ...options, passive: true });
      window.addEventListener('resize', () => this.schedulePack(), options);
      this.motion.addEventListener('change', () => this.schedulePack(), options);
      document.addEventListener('shopify:block:select', event => {
        if (!this.root.contains(event.target)) return;
        this.pack();
        const item = event.target.closest('.parallax-item');
        if (item && matchMedia('(max-width: 767.98px)').matches) {
          this.scrollTo({ left: item.offsetLeft, behavior: 'auto' });
        }
        this.start();
      }, options);
      document.fonts?.ready.then(() => { if (this.controller) this.schedulePack(); });
      this.pack();
    }

    collectItems() {
      this.items = [...this.grid.children].filter(element => element.classList.contains('parallax-item'))
        .map((element, index) => ({
          element, column: Math.max(0, columns.findIndex(name => element.classList.contains('parallax-item--' + name))),
          share: shares[index % shares.length], reach: 0, width: 0, x: 0, y: 0, offset: 0
        }));
    }

    schedulePack() {
      if (this.packFrame) return;
      this.packFrame = requestAnimationFrame(() => { this.packFrame = 0; this.pack(); });
    }

    pack() {
      const style = getComputedStyle(this.grid);
      const count = parseInt(style.getPropertyValue('--parallax-columns'), 10) || 0;
      this.viewportHeight = window.innerHeight;
      this.shift = parseFloat(style.getPropertyValue('--parallax-shift')) || 0;
      if (!count || !this.items.length) {
        this.unpack();
      } else {
        const gap = parseFloat(style.columnGap) || 0;
        const rowGap = parseFloat(style.rowGap) || 0;
        const stagger = [0, parseFloat(style.getPropertyValue('--parallax-stagger-center')) || 0,
          parseFloat(style.getPropertyValue('--parallax-stagger-right')) || 0];
        this.grid.classList.add('is-packed');
        this.packed = true;
        const width = (this.grid.clientWidth - (count - 1) * gap) / count;
        this.items.forEach(item => {
          if (item.width !== width) {
            item.width = width;
            item.element.style.width = width + 'px';
          }
        });
        const heights = this.items.map(item => item.element.offsetHeight);
        const bottoms = Array(count).fill(null);
        this.items.forEach((item, index) => {
          const column = Math.min(item.column, count - 1);
          item.x = column * (width + gap);
          item.y = bottoms[column] ?? stagger[item.column];
          bottoms[column] = item.y + heights[index] + rowGap;
        });
        const height = Math.max(...bottoms.map(bottom => (bottom ?? rowGap) - rowGap));
        this.grid.style.height = height + 'px';
        this.items.forEach((item, index) => {
          const room = height - item.y - heights[index];
          const taper = clamp(this.shift > 0 ? room / this.shift : 0);
          item.reach = Math.max(item.share * taper, Math.min(item.share, .08));
          if (this.motion.matches) item.offset = 0;
        });
        this.paint();
      }
      if (this.visible) this.start();
    }

    unpack() {
      this.stop();
      this.packed = false;
      this.grid.classList.remove('is-packed');
      this.grid.style.height = '';
      this.items.forEach(item => {
        item.width = item.x = item.y = item.offset = 0;
        item.element.style.width = '';
        item.element.style.transform = '';
      });
    }

    factor() {
      const rect = this.getBoundingClientRect();
      const progress = clamp((this.viewportHeight - rect.top) / (this.viewportHeight + rect.height));
      const spent = clamp((progress - .3) / .4);
      return -(spent * spent * (3 - 2 * spent));
    }

    start() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => this.step());
    }
    step() {
      this.frame = 0;
      if (!this.packed || this.motion.matches) return;
      const reach = this.factor() * this.shift;
      let moving = false;
      this.items.forEach(item => {
        const distance = reach * item.reach - item.offset;
        if (Math.abs(distance) < .1) item.offset += distance;
        else { item.offset += distance * .08; moving = true; }
      });
      this.paint();
      if (moving) this.start();
    }
    paint() {
      this.items.forEach(item => {
        const transform = 'translate(' + item.x + 'px, ' + Math.round((item.y + item.offset) * 100) / 100 + 'px)';
        if (item.element.style.transform !== transform) item.element.style.transform = transform;
      });
    }
    stop() {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    teardown() {
      if (!this.controller) return;
      this.controller.abort();
      this.controller = null;
      cancelAnimationFrame(this.packFrame);
      this.stop();
      this.resizeObserver.disconnect();
      this.mutationObserver.disconnect();
      this.intersectionObserver.disconnect();
      this.unpack();

    }
  }
  customElements.define('lh-parallax', Parallax);
})();
