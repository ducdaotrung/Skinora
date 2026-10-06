class ScrollToBlock extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;

    this.initialized = true;
    this.handleClick = this.handleClick.bind(this);
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
    this.initialized = false;
  }

  getTargetSection(order) {
    const mainContent = document.getElementById('MainContent');
    if (!mainContent || !Number.isInteger(order) || order < 1) return null;

    const sections = Array.from(mainContent.children).filter((child) => child.classList.contains('shopify-section'));
    return sections[order - 1] || null;
  }

  handleClick(event) {
    const trigger = event.target.closest('[data-scroll-to]');
    if (!trigger || !this.contains(trigger)) return;

    const order = Number.parseInt(trigger.dataset.scrollTargetOrder, 10);
    const targetSection = this.getTargetSection(order);
    if (!targetSection) return;

    event.preventDefault();

    if (targetSection.id) trigger.setAttribute('aria-controls', targetSection.id);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    targetSection.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }
}

if (!customElements.get('scroll-to-block')) {
  customElements.define('scroll-to-block', ScrollToBlock);
}
