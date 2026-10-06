class VariantPicker extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.sectionRoot =
      this.closest('[data-product-information]') || this.closest('.shopify-section') || this.parentElement;
    this.variants = this.readVariants();
    this.variantIdInput = this.querySelector('[data-variant-id-input]')
      || this.querySelector('[data-variant-id]:not([data-option-control])');
    this.sizeChartDialogElement = this.querySelector('[data-size-chart-dialog]');
    this.initialVariantId = String(this.dataset.currentVariantId || this.variantIdInput?.value || '');
    this.sizeChartOpener = null;

    this.handleChange = this.handleChange.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handlePopState = this.handlePopState.bind(this);
    this.handleExternalVariantChange = this.handleExternalVariantChange.bind(this);

    const eventOptions = { signal: this.signal };
    this.addEventListener('change', this.handleChange, eventOptions);
    this.addEventListener('click', this.handleClick, eventOptions);
    this.addEventListener('keydown', this.handleKeydown, eventOptions);
    window.addEventListener('popstate', this.handlePopState, eventOptions);
    if (this.dataset.syncExternalVariants !== 'false') {
      this.sectionRoot?.addEventListener('variant:change', this.handleExternalVariantChange, eventOptions);
    }

    this.applyUrlVariant();
    this.sync({ source: 'initial' });
  }

  disconnectedCallback() {
    window.requestAnimationFrame(() => {
      if (this.isConnected) return;

      this.abortController?.abort();
      this.abortController = null;
      this.signal = null;
      window.ThemeOverlay.get(this.sizeChartDialog)?.destroy();
    });
  }

  get sizeChartDialog() {
    return this.sizeChartDialogElement || this.querySelector('[data-size-chart-dialog]');
  }

  readVariants() {
    const dataElement = this.querySelector('[data-variant-data]');

    if (!dataElement) {
      return [];
    }

    try {
      const variants = JSON.parse(dataElement.textContent);
      return Array.isArray(variants) ? variants : [];
    } catch (error) {
      return [];
    }
  }

  optionGroups() {
    return Array.from(this.querySelectorAll('.variant-picker__option[data-option-index]'));
  }

  selectedOptions() {
    return this.optionGroups().map((group) => {
      const selectedControl = group.querySelector(
        'select[data-option-control], input[data-option-control]:checked',
      );
      const fallbackControl = group.querySelector('[data-option-control]');
      return (selectedControl || fallbackControl)?.value || '';
    });
  }

  variantOptions(variant) {
    if (Array.isArray(variant?.options) && variant.options.length) {
      return variant.options;
    }

    return [variant?.option1, variant?.option2, variant?.option3].slice(0, this.optionGroups().length);
  }

  findVariant(options) {
    return this.variants.find((variant) => {
      const variantOptions = this.variantOptions(variant);
      if (variantOptions.length !== options.length) {
        return false;
      }

      return variantOptions.every((option, index) => String(option) === String(options[index]));
    });
  }

  findVariantById(variantId) {
    if (!variantId) return null;

    return this.variants.find((variant) => String(variant.id) === String(variantId)) || null;
  }

  valueState(optionIndex, value, selectedOptions) {
    let hasVariant = false;
    let hasAvailableVariant = false;

    this.variants.forEach((variant) => {
      const variantOptions = this.variantOptions(variant);
      if (String(variantOptions[optionIndex]) !== String(value)) {
        return;
      }

      const matchesOtherOptions = variantOptions.every(
        (option, index) =>
          index === optionIndex ||
          !selectedOptions[index] ||
          String(option) === String(selectedOptions[index]),
      );

      if (matchesOtherOptions) {
        hasVariant = true;
        hasAvailableVariant = hasAvailableVariant || Boolean(variant.available);
      }
    });

    if (!hasVariant) {
      return 'unavailable';
    }

    return hasAvailableVariant ? 'available' : 'sold-out';
  }

  updateAvailability(selectedOptions) {
    this.querySelectorAll('[data-option-control]').forEach((control) => {
      const optionIndex = Number(control.dataset.optionIndex);
      const state = this.valueState(optionIndex, control.value, selectedOptions);
      const isCurrentValue = control.value === selectedOptions[optionIndex];

      if (control.tagName === 'OPTION') {
        control.dataset.variantState = state;
        control.disabled = state === 'unavailable' && !isCurrentValue;
        control.textContent = control.dataset.label || control.value;
        if (state === 'unavailable') {
          control.textContent += ` - ${this.dataset.unavailableLabel}`;
        } else if (state === 'sold-out') {
          control.textContent += ` - ${this.dataset.soldOutLabel}`;
        }
        return;
      }

      const choice = control.closest('.variant-picker__choice');
      const button = choice?.querySelector('.variant-picker__button');
      const status = choice?.querySelector('[data-variant-status]');

      control.disabled = state === 'unavailable' && !isCurrentValue;
      choice?.classList.toggle('variant-picker__choice--unavailable', state === 'unavailable');
      choice?.classList.toggle('variant-picker__choice--sold-out', state === 'sold-out');
      if (choice) choice.dataset.variantState = state;
      button?.classList.toggle('variant-picker__button--unavailable', state === 'unavailable');
      button?.classList.toggle('variant-picker__button--sold-out', state === 'sold-out');

      if (button) {
        if (state === 'unavailable') {
          button.setAttribute('aria-disabled', 'true');
        } else {
          button.removeAttribute('aria-disabled');
        }
      }

      if (status) {
        status.textContent =
          state === 'unavailable'
            ? this.dataset.unavailableLabel
            : state === 'sold-out'
              ? this.dataset.soldOutLabel
              : '';
        status.hidden = state === 'available';
      }
    });

    this.optionGroups().forEach((group, optionIndex) => {
      const selectedValue = group.querySelector('[data-variant-selected-value]');
      if (selectedValue) selectedValue.textContent = selectedOptions[optionIndex] ? `: ${selectedOptions[optionIndex]}` : '';
    });
  }

  productForm() {
    if (!this.dataset.productFormId) {
      return this.closest('form');
    }

    return (
      Array.from(this.sectionRoot?.querySelectorAll('form') || []).find(
        (form) => form.getAttribute('id') === this.dataset.productFormId,
      ) ||
      document.getElementById(this.dataset.productFormId) ||
      this.closest('form')
    );
  }

  productFormController(productForm = this.productForm()) {
    return productForm?.closest('[data-product-buy-buttons]')
      || this.sectionRoot?.querySelector('[data-product-buy-buttons]')
      || null;
  }

  updateQuantityInput(variant, productForm) {
    const productFormId = productForm?.getAttribute('id') || '';
    const quantityInput = Array.from(
      this.sectionRoot?.querySelectorAll('[data-quantity-input]') || [],
    ).find(
      (input) =>
        !productForm || input.form === productForm || (productFormId && input.getAttribute('form') === productFormId),
    );

    if (!quantityInput) return;

    const quantityRule = variant?.quantity_rule || {};
    const min = Number.isFinite(Number(quantityRule.min)) && Number(quantityRule.min) > 0
      ? Math.floor(Number(quantityRule.min))
      : 1;
    const increment = Number.isFinite(Number(quantityRule.increment)) && Number(quantityRule.increment) > 0
      ? Math.floor(Number(quantityRule.increment))
      : 1;
    const maxValue = Number(quantityRule.max);
    const max = Number.isFinite(maxValue) && maxValue >= min ? Math.floor(maxValue) : null;

    quantityInput.min = String(min);
    quantityInput.step = String(increment);
    if (max == null) {
      quantityInput.removeAttribute('max');
    } else {
      quantityInput.max = String(max);
    }

    let value = Number(quantityInput.value);
    if (!Number.isFinite(value) || value < min) value = min;
    if (increment > 1) value = min + Math.ceil((value - min) / increment) * increment;
    if (max != null && value > max) {
      value = min + Math.floor((max - min) / increment) * increment;
    }
    quantityInput.value = String(Math.max(min, value));
    quantityInput.dataset.quantityVariantId = variant?.id ? String(variant.id) : '';
  }

  updateProductForm(variant) {
    const variantId = variant?.id ? String(variant.id) : '';
    const isAvailable = Boolean(variant?.available);
    const productForm = this.productForm();
    const productFormController = this.productFormController(productForm);

    const variantInputs = [
      this.variantIdInput,
      ...this.querySelectorAll('[data-variant-id-input]'),
      ...Array.from(productForm?.querySelectorAll('[data-variant-id-input]') || []),
    ].filter((input, index, inputs) => input && inputs.indexOf(input) === index);

    variantInputs.forEach((input) => {
      input.value = variantId;
      input.setAttribute('value', variantId);
    });

    this.dataset.currentVariantId = variantId;
    this.dataset.currentVariantAvailable = String(isAvailable);

    // Keep every cart form input synchronized even when the modern buy-button
    // controller has not upgraded yet. This also makes the initial lifecycle
    // deterministic when the picker script is defined before the form script.
    // Product buy buttons owns the modern product form. The picker only keeps
    // its own state in sync and emits the shared variant:change contract;
    // legacy product forms still use the fallback branch below.
    if (productFormController) return;

    if (productForm) {
      productForm.dataset.currentVariantId = variantId;
      productForm.dataset.variantAvailable = String(isAvailable);
    }

    productForm?.querySelectorAll('.product-form__submit, .shopify-payment-button button').forEach((button) => {
      button.disabled = !isAvailable;
      button.setAttribute('aria-disabled', String(!isAvailable));
      button.dataset.variantAvailable = String(isAvailable);
    });

    this.updateQuantityInput(variant, productForm);
    this.updateAddToCartLabel(productForm, variant);
  }

  updateAddToCartLabel(productForm, variant) {
    const button = productForm?.querySelector('[data-add-to-cart-button]');
    const label = button?.querySelector('.btn__text');

    if (!button || !label) {
      return;
    }

    const variantId = variant?.id ? String(variant.id) : '';
    let nextLabel = '';

    if (variant && !variant.available) {
      nextLabel = this.dataset.soldOutLabel;
    } else if (!variant) {
      nextLabel = this.dataset.unavailableLabel;
    } else {
      const template = Array.from(
        productForm.querySelectorAll('[data-add-to-cart-label-template]'),
      ).find((labelTemplate) => labelTemplate.dataset.addToCartLabelTemplate === variantId);
      nextLabel = template?.content.textContent.trim() || productForm.dataset.addToCartLabel;
    }

    if (nextLabel) {
      label.textContent = nextLabel;
    }
  }

  priceContainers() {
    const sectionId = this.dataset.sectionId;

    return Array.from(this.sectionRoot?.querySelectorAll('[data-product-price-container]') || []).filter(
      (container) => container.dataset.sectionId === sectionId,
    );
  }

  updatePrice(variant) {
    this.priceContainers().forEach((container) => {
      const currentPrice = container?.querySelector('[data-price-component]');

      if (!container || !currentPrice) {
        return;
      }

      const variantId = variant?.id ? String(variant.id) : '';
      const template = Array.from(container.querySelectorAll('[data-variant-price-template]')).find(
        (priceTemplate) => priceTemplate.dataset.variantPriceTemplate === variantId,
      );
      const nextPrice = template?.content.querySelector('[data-price-component]');

      if (!nextPrice) {
        currentPrice.hidden = true;
        currentPrice.setAttribute('aria-hidden', 'true');
        return;
      }

      currentPrice.replaceWith(nextPrice.cloneNode(true));
    });
  }

  updateSaleBadge(variant) {
    this.priceContainers().forEach((price) => {
      const container = price?.querySelector('[data-variant-sale-badge-container]');

      if (!price || !container) {
        return;
      }

      const variantId = variant?.id ? String(variant.id) : '';
      const template = Array.from(price.querySelectorAll('[data-variant-sale-badge-template]')).find(
        (badgeTemplate) => badgeTemplate.dataset.variantSaleBadgeTemplate === variantId,
      );

      container.replaceChildren(template?.content.cloneNode(true) || document.createDocumentFragment());
    });
  }

  updateLegacyMedia(variantId) {
    const galleryId = this.dataset.mediaGalleryId;
    const gallery = galleryId
      ? Array.from(this.sectionRoot?.querySelectorAll('[data-product-media-gallery]') || []).find(
          (element) => element.id === galleryId,
        )
      : null;
    const mediaItems = gallery ? Array.from(gallery.querySelectorAll('[data-product-media]')) : [];

    // ProductMediaGallery is the single owner of modern media filtering and
    // featured-media selection. Keep this fallback only for the legacy
    // product section, which renders a plain gallery element.
    if (gallery?.matches('product-media-gallery')) return;

    if (!mediaItems.length) {
      return;
    }

    const onlySelectedMedia = this.dataset.onlySelectedMedia === 'true';
    const selectedMediaItems = mediaItems.filter((item) => {
      const variantIds = (item.dataset.variantIds || '').split(',').filter(Boolean);
      return variantIds.includes(String(variantId));
    });
    const hasSelectedMedia = selectedMediaItems.length > 0;

    mediaItems.forEach((item) => {
      const variantIds = (item.dataset.variantIds || '').split(',').filter(Boolean);
      const isSelectedVariantMedia = variantIds.includes(String(variantId));
      const isCommonMedia = variantIds.length === 0;
      const shouldHide = onlySelectedMedia && hasSelectedMedia && !isCommonMedia && !isSelectedVariantMedia;

      item.hidden = shouldHide;
      item.setAttribute('aria-hidden', String(shouldHide));
    });

    if (onlySelectedMedia && hasSelectedMedia && !mediaItems.some((item) => !item.hidden)) {
      const firstSelectedMedia = selectedMediaItems[0];
      firstSelectedMedia.hidden = false;
      firstSelectedMedia.setAttribute('aria-hidden', 'false');
    }
  }

  updateStatus(variant) {
    const status = this.querySelector('[data-variant-picker-status]');
    if (!status) return;

    const message = variant ? '' : this.dataset.unavailableSelectionLabel;
    status.textContent = message || '';
    status.hidden = !message;
    status.setAttribute('aria-hidden', String(!message));
  }

  updateUrl(variantId) {
    if (this.sectionRoot?.hasAttribute('data-featured-product')) return;
    if (window.Shopify?.designMode || !window.history?.replaceState) return;

    const url = new URL(window.location.href);
    if (variantId) {
      url.searchParams.set('variant', String(variantId));
    } else {
      url.searchParams.delete('variant');
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;

    const currentState = window.history.state;
    const nextState = currentState && typeof currentState === 'object' ? { ...currentState } : {};
    nextState.variantId = variantId ? String(variantId) : null;
    window.history.replaceState(nextState, '', nextUrl);
  }

  applyUrlVariant() {
    if (this.sectionRoot?.hasAttribute('data-featured-product')) return;
    if (window.Shopify?.designMode) return;

    const url = new URL(window.location.href);
    const requestedVariantId = url.searchParams.get('variant');
    if (requestedVariantId && this.dataset.ignoreUrlVariant === 'true') return;
    const targetVariant = requestedVariantId
      ? this.findVariantById(requestedVariantId)
      : this.findVariantById(this.initialVariantId);

    if (targetVariant) {
      this.setControlsForVariant(targetVariant);
    }
  }

  setControlsForVariant(variant) {
    const variantOptions = this.variantOptions(variant);

    this.optionGroups().forEach((group, index) => {
      const nextValue = variantOptions[index];
      if (nextValue == null) return;

      const select = group.querySelector('select[data-option-control]');
      if (select) {
        const matchingOption = Array.from(select.options).find(
          (option) => String(option.value) === String(nextValue),
        );
        if (matchingOption) select.value = matchingOption.value;
        return;
      }

      const radio = Array.from(group.querySelectorAll('input[data-option-control]')).find(
        (input) => String(input.value) === String(nextValue),
      );
      if (radio) radio.checked = true;
    });
  }

  sync({ updateUrl = false, source = 'change' } = {}) {
    const options = this.selectedOptions();
    const variant = this.findVariant(options);

    this.updateAvailability(options);
    this.updateProductForm(variant);
    this.updateStatus(variant);
    this.updatePrice(variant);
    this.updateSaleBadge(variant);
    this.updateLegacyMedia(variant?.id || '');
    if (updateUrl) this.updateUrl(variant?.id || '');

    this.dispatchEvent(
      new CustomEvent('variant:change', {
        bubbles: true,
        detail: {
          variant,
          variantId: variant?.id ? String(variant.id) : '',
          options,
          available: Boolean(variant?.available),
          source,
        },
      }),
    );
  }

  handleChange(event) {
    if (!event.target.matches('[data-option-control]')) {
      return;
    }

    this.sync({ updateUrl: this.dataset.updateUrlOnChange !== 'false', source: 'change' });
  }

  handleClick(event) {
    const trigger = event.target.closest('[data-size-chart-trigger]');
    if (trigger && this.contains(trigger)) {
      event.preventDefault();
      this.openSizeChart(trigger);
      return;
    }

    const closeButton = event.target.closest('[data-size-chart-close]');
    if (closeButton && this.contains(closeButton)) {
      event.preventDefault();
      this.closeSizeChart();
      return;
    }


  }

  handleKeydown(event) {
    if (event.key !== 'Escape' || !this.sizeChartDialog?.open) return;

    event.preventDefault();
    this.closeSizeChart();
  }

  handlePopState() {
    if (this.sectionRoot?.hasAttribute('data-featured-product')) return;
    if (this.dataset.ignoreUrlVariant === 'true') return;
    if (window.Shopify?.designMode) return;

    const url = new URL(window.location.href);
    const requestedVariantId = url.searchParams.get('variant');
    const targetVariant = requestedVariantId
      ? this.findVariantById(requestedVariantId)
      : this.findVariantById(this.initialVariantId);

    if (!targetVariant) return;

    this.setControlsForVariant(targetVariant);
    this.sync({ source: 'history' });
  }

  handleExternalVariantChange(event) {
    if (event.target === this || !event.detail?.variantId) return;
    if (String(event.detail.variantId) === String(this.dataset.currentVariantId)) return;

    const variant = this.findVariantById(event.detail.variantId);
    if (!variant) return;

    this.setControlsForVariant(variant);
    this.sync({ source: 'external' });
  }

  openSizeChart(opener) {
    window.ThemeOverlay.get(this.sizeChartDialog)?.open({ opener });
  }

  closeSizeChart() {
    window.ThemeOverlay.get(this.sizeChartDialog)?.close();
  }

}

if (!customElements.get('variant-picker')) {
  customElements.define('variant-picker', VariantPicker);
}
