class ProductBuyButtons extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.sectionRoot =
      this.closest('[data-product-information]') || this.closest('.shopify-section') || this.parentElement;
    this.form = this.querySelector('[data-product-form]');
    this.variantInput = this.form?.querySelector('[data-variant-id-input]')
      || this.form?.querySelector('[data-variant-id]:not([data-option-control])');
    this.addButton = this.form?.querySelector('[data-add-to-cart-button]');
    this.paymentWrapper = this.form?.querySelector('[data-accelerated-checkout-wrapper]');
    this.quantityInput = this.form?.querySelector('[data-quantity-input]');
    this.quantityDecrease = this.form?.querySelector('[data-quantity-decrease]');
    this.quantityIncrease = this.form?.querySelector('[data-quantity-increase]');
    this.currentQuantityRule = {
      min: this.dataset.quantityMin || this.quantityInput?.min || 1,
      increment: this.dataset.quantityStep || this.quantityInput?.step || 1,
      max: this.dataset.quantityMax || this.quantityInput?.max || '',
    };
    this.recipientForm = this.form?.querySelector('[data-gift-card-recipient-form]');
    this.recipientToggle = this.recipientForm?.querySelector('[data-gift-card-recipient-toggle]');
    this.recipientFields = this.recipientForm?.querySelector('[data-gift-card-recipient-fields]');
    this.recipientEmail = this.recipientForm?.querySelector('[data-gift-card-recipient-email]');
    this.recipientOffset = this.recipientForm?.querySelector('[data-gift-card-recipient-offset]');
    this.recipientError = this.recipientForm?.querySelector('[data-gift-card-recipient-error]');
    this.backInStockTrigger = this.querySelector('[data-back-in-stock-trigger]');
    this.backInStockDialog = this.querySelector('[data-back-in-stock-dialog]');
    this.backInStockForm = this.querySelector('[data-back-in-stock-form]');
    this.backInStockContext = this.backInStockForm?.querySelector('[data-back-in-stock-context]');

    this.handleVariantChange = this.handleVariantChange.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);

    this.sectionRoot?.addEventListener('variant:change', this.handleVariantChange, { signal: this.signal });
    this.sectionRoot?.addEventListener('input', this.handleInput, { signal: this.signal });
    this.sectionRoot?.addEventListener('change', this.handleChange, { signal: this.signal });
    this.addEventListener('click', this.handleClick, { signal: this.signal });
    this.form?.addEventListener('submit', this.handleSubmit, { signal: this.signal });

    this.syncGiftCardRecipient();
    this.normalizeQuantity();
    const variantPicker = this.sectionRoot?.querySelector('[data-product-variant-picker]');
    const pickerVariantId = variantPicker?.dataset.currentVariantId || '';
    const pickerVariant = variantPicker?.findVariantById?.(pickerVariantId) || null;
    const initialVariantId = pickerVariantId || this.dataset.currentVariantId || this.variantInput?.value || '';
    const initialVariantAvailable = variantPicker
      ? variantPicker.dataset.currentVariantAvailable === 'true'
      : this.dataset.variantAvailable === 'true';
    this.syncPurchaseState(
      initialVariantId,
      initialVariantAvailable,
      pickerVariant,
    );

    const backInStockFormState = this.backInStockForm?.querySelector('[data-back-in-stock-form-state]')?.dataset.backInStockFormState
      || this.backInStockDialog?.dataset.formState
      || 'idle';
    if (backInStockFormState !== 'idle') {
      window.requestAnimationFrame(() => this.openBackInStock(false));
    }
  }

  disconnectedCallback() {
    window.requestAnimationFrame(() => {
      if (this.isConnected) return;

      this.abortController?.abort();
      this.abortController = null;
      this.signal = null;
      this.sectionRoot = null;
      this.form = null;
      this.currentQuantityRule = null;
      window.ThemeOverlay.get(this.backInStockDialog)?.destroy();
    });
  }

  isDesignMode() {
    return this.dataset.designMode === 'true' || Boolean(window.Shopify?.designMode);
  }

  handleVariantChange(event) {
    if (event.target === this || !event.detail) return;

    const variantId = event.detail.variantId ? String(event.detail.variantId) : '';
    const isAvailable = Boolean(variantId && event.detail.variant?.available);
    this.syncPurchaseState(variantId, isAvailable, event.detail.variant || null);
  }

  syncPurchaseState(variantId, isAvailable, variant) {
    this.dataset.currentVariantId = variantId;
    this.dataset.backInStockVariantId = variantId;
    this.dataset.variantAvailable = String(isAvailable);

    const variantInputs = [
      this.variantInput,
      ...Array.from(this.form?.querySelectorAll('[data-variant-id-input]') || []),
      ...Array.from(this.form?.querySelectorAll('[data-variant-id]:not([data-option-control])') || []),
    ].filter((input, index, inputs) => input && inputs.indexOf(input) === index);

    variantInputs.forEach((input) => {
      input.value = variantId;
      input.setAttribute('value', variantId);
    });
    if (this.form) {
      this.form.dataset.currentVariantId = variantId;
      this.form.dataset.variantAvailable = String(isAvailable);
    }

    if (this.addButton) {
      this.addButton.disabled = !isAvailable;
      this.addButton.setAttribute('aria-disabled', String(!isAvailable));
      this.addButton.dataset.variantAvailable = String(isAvailable);
    }

    const paymentDisabled = !isAvailable || Boolean(this.recipientToggle?.checked);
    this.form?.querySelectorAll('.shopify-payment-button button').forEach((button) => {
      button.disabled = paymentDisabled;
      button.setAttribute('aria-disabled', String(paymentDisabled));
      button.dataset.variantAvailable = String(isAvailable);
    });
    this.syncAcceleratedCheckoutVisibility();

    if (this.backInStockTrigger) {
      const shouldShowNotify = Boolean(variantId) && !isAvailable;
      const shouldHide = !shouldShowNotify && !this.isDesignMode();
      this.backInStockTrigger.hidden = shouldHide;
      this.backInStockTrigger.setAttribute('aria-hidden', String(shouldHide));
      if (shouldHide && this.backInStockDialog?.open) this.closeBackInStock(false);
    }

    this.updateAddToCartLabel(variantId, isAvailable);
    this.updateQuantityForVariant(variant);
    this.updateBackInStockContext(variantId, variant);
  }

  updateAddToCartLabel(variantId, isAvailable) {
    const label = this.addButton?.querySelector('.btn__text');
    if (!label) return;

    const showPrice = this.form?.dataset.addToCartShowPrice !== 'false'
      && this.addButton?.closest('[data-add-to-cart-show-price]')?.dataset.addToCartShowPrice !== 'false';
    let nextLabel = this.dataset.unavailableLabel || '';
    if (variantId && !isAvailable) {
      nextLabel = this.dataset.soldOutLabel || nextLabel;
    } else if (variantId && isAvailable) {
      const template = showPrice
        ? Array.from(this.form?.querySelectorAll('[data-add-to-cart-label-template]') || []).find(
          (candidate) => String(candidate.dataset.addToCartLabelTemplate) === String(variantId),
        )
        : null;
      nextLabel = template?.content.textContent.trim() || this.dataset.addToCartLabel || nextLabel;
    }

    if (nextLabel) label.textContent = nextLabel;
  }

  updateQuantityForVariant(variant) {
    const variantQuantityRule = variant?.quantity_rule;
    const hasVariantQuantityRule = variantQuantityRule && typeof variantQuantityRule === 'object'
      && Object.keys(variantQuantityRule).length > 0;
    const quantityRule = hasVariantQuantityRule ? variantQuantityRule : this.currentQuantityRule || {};
    const minValue = Number(quantityRule.min);
    const incrementValue = Number(quantityRule.increment);
    const maxValue = Number(quantityRule.max);
    const quantityInputs = [this.quantityInput].filter(Boolean);

    let resolvedRule = null;
    quantityInputs.forEach((quantityInput) => {
      const min = Number.isFinite(minValue) && minValue > 0 ? Math.floor(minValue) : Number(quantityInput.min || 1);
      const step = Number.isFinite(incrementValue) && incrementValue > 0 ? Math.floor(incrementValue) : 1;
      const max = Number.isFinite(maxValue) && maxValue >= min ? Math.floor(maxValue) : null;
      if (!resolvedRule) resolvedRule = { min, increment: step, max: max ?? '' };

      quantityInput.min = String(min);
      quantityInput.step = String(step);
      if (max == null) quantityInput.removeAttribute('max');
      else quantityInput.max = String(max);
      this.normalizeQuantity(quantityInput);
    });
    if (resolvedRule && (variant || !this.currentQuantityRule)) this.currentQuantityRule = resolvedRule;
  }

  normalizeQuantity(quantityInput = null) {
    const quantityInputs = quantityInput
      ? [quantityInput]
      : [this.quantityInput].filter(Boolean);

    quantityInputs.forEach((input) => {
      const minValue = Number(input.min);
      const min = Number.isFinite(minValue) && minValue > 0 ? Math.floor(minValue) : 1;
      const stepValue = Number(input.step);
      const step = Number.isFinite(stepValue) && stepValue > 0 ? Math.floor(stepValue) : 1;
      const maxValue = Number(input.max);
      const max = Number.isFinite(maxValue) && maxValue >= min ? Math.floor(maxValue) : null;
      const highestValid = max == null ? null : min + Math.floor((max - min) / step) * step;
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = min;
      value = Math.max(min, value);
      value = min + Math.ceil((value - min) / step) * step;
      if (highestValid != null) value = Math.min(highestValid, value);
      input.value = String(Math.max(min, Math.floor(value)));
      if (input === this.quantityInput) this.updateQuantityButtons();
    });
  }

  syncAcceleratedCheckoutVisibility() {
    if (!this.paymentWrapper) return;

    const isAvailable = this.dataset.variantAvailable === 'true';
    const recipientEnabled = Boolean(this.recipientToggle?.checked);
    const shouldHide = recipientEnabled || (!isAvailable && !this.isDesignMode());
    this.paymentWrapper.hidden = shouldHide;
    this.paymentWrapper.setAttribute('aria-hidden', String(shouldHide));

    this.paymentWrapper.querySelectorAll('.shopify-payment-button button').forEach((button) => {
      const disabled = recipientEnabled || !isAvailable;
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
    });
  }

  changeQuantity(delta) {
    if (!this.quantityInput) return;

    const step = Math.max(1, Number(this.quantityInput.step || 1));
    const current = Number(this.quantityInput.value || this.quantityInput.min || 1);
    this.quantityInput.value = String(current + delta * step);
    this.normalizeQuantity();
  }

  updateQuantityButtons() {
    if (!this.quantityInput) return;

    const value = Number(this.quantityInput.value || this.quantityInput.min || 1);
    const min = Number(this.quantityInput.min || 1);
    const max = this.quantityInput.max === '' ? null : Number(this.quantityInput.max);
    if (this.quantityDecrease) this.quantityDecrease.disabled = value <= min;
    if (this.quantityIncrease) this.quantityIncrease.disabled = max !== null && Number.isFinite(max) && value >= max;
  }

  syncGiftCardRecipient() {
    if (!this.recipientForm || !this.recipientToggle || !this.recipientFields) return;

    const enabled = this.recipientToggle.checked;
    this.recipientFields.hidden = !enabled;
    this.recipientFields.setAttribute('aria-hidden', String(!enabled));
    this.recipientToggle.setAttribute('aria-expanded', String(enabled));
    this.recipientForm.querySelectorAll('[data-gift-card-recipient-field]').forEach((field) => {
      field.disabled = !enabled;
    });
    if (this.recipientEmail) this.recipientEmail.required = enabled;
    if (this.recipientOffset) {
      this.recipientOffset.disabled = !enabled;
      this.recipientOffset.value = enabled ? String(new Date().getTimezoneOffset()) : '';
    }
    if (!enabled) this.setRecipientError('');
    this.syncAcceleratedCheckoutVisibility();
  }

  setRecipientError(message, emailInvalid = false) {
    if (!this.recipientError) return;

    this.recipientError.textContent = message || '';
    this.recipientError.hidden = !message;
    this.recipientEmail?.toggleAttribute('aria-invalid', Boolean(message) && emailInvalid);
  }

  handleInput(event) {
    if (event.target === this.quantityInput) this.updateQuantityButtons();
    if (event.target.matches('[data-gift-card-recipient-field]') && this.recipientForm?.contains(event.target)) {
      this.setRecipientError('');
    }
  }

  handleChange(event) {
    if (event.target.matches('[data-quantity-input]') && event.target === this.quantityInput) {
      this.normalizeQuantity(event.target);
    }
    if (event.target.matches('[data-gift-card-recipient-toggle]') && this.recipientForm?.contains(event.target)) {
      this.syncGiftCardRecipient();
    }
  }

  handleSubmit(event) {
    if (event.defaultPrevented || event.target !== this.form) return;

    this.normalizeQuantity();
    if (!this.variantInput?.value || this.dataset.variantAvailable !== 'true') {
      event.preventDefault();
      this.form.reportValidity?.();
      return;
    }
    if (!this.form.checkValidity()) {
      event.preventDefault();
      this.form.reportValidity?.();
      if (this.recipientToggle?.checked && this.recipientEmail && !this.recipientEmail.checkValidity()) {
        this.setRecipientError(this.recipientEmail.validationMessage, true);
      }
    }
  }

  handleClick(event) {
    const decrease = event.target.closest('[data-quantity-decrease]');
    if (decrease && this.contains(decrease)) {
      event.preventDefault();
      this.changeQuantity(-1);
      return;
    }

    const increase = event.target.closest('[data-quantity-increase]');
    if (increase && this.contains(increase)) {
      event.preventDefault();
      this.changeQuantity(1);
      return;
    }

    const trigger = event.target.closest('[data-back-in-stock-trigger]');
    if (trigger && this.contains(trigger)) {
      event.preventDefault();
      this.openBackInStock(true);
      return;
    }

    const close = event.target.closest('[data-back-in-stock-close]');
    if (close && this.contains(close)) {
      event.preventDefault();
      this.closeBackInStock(true);
      return;
    }


  }

  openBackInStock(fromTrigger = true) {
    window.ThemeOverlay.get(this.backInStockDialog)?.open({ opener: fromTrigger ? this.backInStockTrigger : null });
  }

  closeBackInStock(restoreFocus = true) {
    window.ThemeOverlay.get(this.backInStockDialog)?.close({ restoreFocus });
  }

  updateBackInStockContext(variantId, variant) {
    if (!this.backInStockContext) return;

    const productTitle = this.dataset.productTitle || '';
    const variantTitle = variant?.title && variant.title !== 'Default Title'
      ? ` | Variant: ${variant.title}`
      : variantId && String(variantId) === String(this.dataset.currentVariantId) && this.dataset.currentVariantTitle
        ? ` | Variant: ${this.dataset.currentVariantTitle}`
        : '';
    let productUrl = '';
    if (this.dataset.productUrl) {
      try {
        productUrl = ` | URL: ${new URL(this.dataset.productUrl, window.location.origin).href}`;
      } catch (error) {
        productUrl = ` | URL: ${this.dataset.productUrl}`;
      }
    }
    this.backInStockContext.value = `Product: ${productTitle}${variantTitle} | Variant ID: ${variantId}${productUrl}`;
  }
}

if (!customElements.get('product-buy-buttons')) {
  customElements.define('product-buy-buttons', ProductBuyButtons);
}
