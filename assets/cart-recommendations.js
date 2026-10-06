/** Cart composition adapter; Shopify and the shared Product list own card output. */
class CartPageRecommendations extends HTMLElement {
  connectedCallback() {
    if (this.lifecycle) return;
    this.lifecycle = new AbortController();
    document.addEventListener('cart:updated', (event) => {
      const cart = event.detail?.cart;
      if (!cart) return;
      this.dataset.productId = String(cart.items?.[0]?.product_id || '');
      this.load();
    }, { signal: this.lifecycle.signal });
    this.load();
  }

  disconnectedCallback() {
    this.lifecycle?.abort();
    this.request?.abort();
    this.lifecycle = null;
    this.loadedKey = null;
  }

  async load() {
    const list = this.querySelector('[data-product-list]');
    if (!list?.hasAttribute('data-recommendation-intent')) {
      this.hidden = false;
      return;
    }
    const product = this.dataset.productId;
    const intent = list?.dataset.recommendationIntent || 'related';
    const limit = Math.min(10, Math.max(1, Number(list?.dataset.recommendationLimit || 8)));
    const key = `${product}:${intent}:${limit}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    this.request?.abort();
    this.request = new AbortController();
    if (!product) {
      this.hidden = this.dataset.designMode !== 'true';
      return;
    }
    const url = new URL(this.dataset.recommendationsUrl, window.location.origin);
    url.search = new URLSearchParams({ section_id: this.dataset.sectionId, product_id: product, intent, limit }).toString();
    this.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(url, { credentials: 'same-origin', signal: this.request.signal });
      if (!response.ok) throw new Error('Recommendations unavailable');
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = html.querySelector('cart-page-recommendations');
      if (!next) throw new Error('Recommendation section missing');
      if (key !== this.loadedKey || !this.isConnected) return;
      const hasProducts = next.querySelector('[data-product-list]')?.dataset.recommendationPlaceholder === 'false';
      this.querySelectorAll('[data-swiper-carousel]').forEach((carousel) => carousel.swiper?.destroy(true, true));
      this.innerHTML = next.innerHTML;
      this.hidden = !hasProducts && this.dataset.designMode !== 'true';
      // Existing module loader/carousel controllers initialize replacement markup.
      this.dispatchEvent(new CustomEvent('shopify:section:load', { bubbles: true }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (key !== this.loadedKey || !this.isConnected) return;
      const hasFallback = this.querySelector('[data-product-list]')?.dataset.recommendationPlaceholder === 'false';
      this.hidden = !hasFallback && this.dataset.designMode !== 'true';
      this.loadedKey = null;
    } finally {
      if (key === this.loadedKey || this.loadedKey === null) this.removeAttribute('aria-busy');
    }
  }
}
if (!customElements.get('cart-page-recommendations')) customElements.define('cart-page-recommendations', CartPageRecommendations);
