class SwatchesVariantPickerComponent extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.form = this.querySelector('form');
    this.form?.addEventListener('change', (event) => this.handleChange(event), {
      signal: this.abortController.signal,
    });
    this.form?.addEventListener('submit', (event) => event.preventDefault(), {
      signal: this.abortController.signal,
    });
    this.querySelector('[data-product-card-swatch-more]')?.addEventListener(
      'click',
      () => this.openRemainingOptions(),
      { signal: this.abortController.signal },
    );
  }

  disconnectedCallback() {
    this.abortController?.abort();
    this.abortController = null;
  }

  get card() {
    return this.closest('[data-product-card]');
  }

  handleChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-product-card-swatch]')) return;

    const card = this.card;
    const variantId = input.dataset.variantId;
    const template = variantId
      ? Array.from(this.querySelectorAll('template[data-product-card-variant]')).find(
          (item) => item.dataset.productCardVariant === variantId,
        )
      : null;

    // Combined-listing values and options without a local variant use their
    // own Shopify URL instead of changing the current card's local media.
    if (!card || !template) {
      if (input.dataset.productUrl) window.location.assign(input.dataset.productUrl);
      return;
    }

    this.updateCard(card, input, template);
  }

  updateCard(card, input, template) {
    const variantId = input.dataset.variantId;
    const content = template.content;
    const price = content.querySelector('.product-card__price');
    if (price) card.querySelector('.product-card__price')?.replaceWith(price.cloneNode(true));

    const imageLink = card.querySelector('.product-card__image-link');
    const image = content.querySelector('.product-card__image');
    const secondaryImage = content.querySelector('.product-card__secondary-image');
    const currentImage = imageLink?.querySelector('.product-card__image');
    const currentSecondaryImage = imageLink?.querySelector('.product-card__secondary-image');
    if (image && currentImage) currentImage.replaceWith(image.cloneNode(true));
    if (secondaryImage) {
      const replacement = secondaryImage.cloneNode(true);
      if (currentSecondaryImage) currentSecondaryImage.replaceWith(replacement);
      else imageLink?.querySelector('.product-card__image')?.after(replacement);
    } else {
      currentSecondaryImage?.remove();
    }
    imageLink?.classList.toggle('product-card__image-link--has-secondary', Boolean(secondaryImage));
    card.classList.toggle('product-card--variant-image-selected', !secondaryImage);

    const variantUrl = input.dataset.productUrl || this.dataset.productUrl;
    card.querySelectorAll(
      '.product-card__image-link, .product-card__title-link, [data-product-card-quick-add-overlay], [data-product-card-quick-view]',
    ).forEach((link) => {
      link.href = variantUrl;
      if (link.hasAttribute('data-product-card-quick-add-url')) {
        link.dataset.productCardQuickAddUrl = variantUrl;
      }
      if (link.hasAttribute('data-product-card-quick-view-url')) {
        link.dataset.productCardQuickViewUrl = variantUrl;
      }
    });

    const id = card.querySelector('form[action*="/cart/add"] [name="id"]');
    if (id) id.value = variantId;
    card.dataset.selectedVariantId = variantId;
  }

  openRemainingOptions() {
    const card = this.card;
    const trigger = card?.querySelector('[data-product-card-quick-add-overlay]');
    if (trigger) {
      const loadingTarget = this.querySelector('[data-product-card-swatch-more]');
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      clickEvent.productCardLoadingTarget = loadingTarget;
      trigger.dispatchEvent(clickEvent);
      return;
    }

    const destination = this.dataset.productUrl;
    if (destination) window.location.assign(destination);
  }
}

if (!customElements.get('swatches-variant-picker-component')) {
  customElements.define('swatches-variant-picker-component', SwatchesVariantPickerComponent);
}
