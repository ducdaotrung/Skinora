class ProductInventory extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.sectionRoot =
      this.closest('[data-product-information]') || this.closest('.shopify-section') || this.parentElement;
    this.message = this.querySelector('[data-inventory-message]');

    this.handleVariantChange = this.handleVariantChange.bind(this);
    this.sectionRoot?.addEventListener('variant:change', this.handleVariantChange, { signal: this.signal });

    this.render(this.dataset.currentVariantId || '');
  }

  disconnectedCallback() {
    window.requestAnimationFrame(() => {
      if (this.isConnected) return;

      this.abortController?.abort();
      this.abortController = null;
      this.signal = null;
      this.sectionRoot = null;
      this.message = null;
    });
  }

  templateForVariant(variantId) {
    if (!variantId) {
      return this.querySelector('[data-inventory-fallback-template]');
    }

    return Array.from(this.querySelectorAll('[data-inventory-template]')).find(
      (template) => String(template.dataset.inventoryTemplate) === String(variantId),
    ) || this.querySelector('[data-inventory-fallback-template]');
  }

  render(variantId) {
    if (!this.message) return;

    const template = this.templateForVariant(variantId);
    const nextMessage = template?.content?.cloneNode(true) || document.createDocumentFragment();
    this.message.replaceChildren(nextMessage);
    this.dataset.currentVariantId = variantId ? String(variantId) : '';
  }

  handleVariantChange(event) {
    if (event.target === this || !event.detail) return;

    this.render(event.detail.variantId || '');
  }
}

if (!customElements.get('product-inventory')) {
  customElements.define('product-inventory', ProductInventory);
}
