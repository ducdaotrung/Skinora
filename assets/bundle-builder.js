import { formatShopifyMoney } from './money-format.js';
import { setButtonLoadingState } from './button-loading.js';

const instances = new WeakMap();
const editorSelections = new Map();

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function getVariantData(card) {
  const script = card.querySelector('[data-variant-data], [data-bundle-product-variants]');
  const variants = parseJson(script?.textContent || '[]', []);
  return Array.isArray(variants) ? variants : [];
}

function getVariant(card, variantId) {
  return getVariantData(card).find((variant) => String(variant.id) === String(variantId)) || null;
}

function getSizedImageUrl(source, width) {
  if (!source) return '';

  try {
    const url = new URL(source, window.location.origin);
    url.searchParams.set('width', String(width));
    return url.toString();
  } catch (error) {
    return source;
  }
}

function getVariantImage(card, variant) {
  const imageScript = card.querySelector('[data-bundle-variant-images]');
  const images = parseJson(imageScript?.textContent || '[]', []);
  const imageData = Array.isArray(images)
    ? images.find((image) => String(image.id) === String(variant?.id))
    : null;

  if (imageData && (imageData.src || imageData.secondary_src)) return imageData;

  const image = variant?.featured_image || variant?.image || variant?.featured_media?.preview_image || null;
  if (typeof image === 'string') return { src: image };
  if (!image || typeof image !== 'object') return null;

  return {
    ...image,
    src: typeof image.src === 'string' ? image.src : image.preview_image?.src || '',
  };
}

function getVariantImageSnapshot(card, variant) {
  const image = getVariantImage(card, variant);
  const imageUrl = image?.src || '';
  const width = Number(image?.width || card.dataset.productImageDefaultWidth);
  const height = Number(image?.height || card.dataset.productImageDefaultHeight);
  const ratio = Number(image?.aspect_ratio)
    || (width > 0 && height > 0 ? width / height : 0)
    || Number(card.dataset.productImageDefaultRatio);

  return {
    src: imageUrl
      ? image.thumb_src || getSizedImageUrl(imageUrl, 160)
      : card.dataset.productImageDefault || '',
    ratio: Number.isFinite(ratio) && ratio > 0 ? String(ratio) : '',
  };
}

function updateProductImage(card, variant) {
  const variantImage = getVariantImage(card, variant);
  const variantImageUrl = variantImage?.src || '';
  const imageUrl = variantImageUrl
    ? variantImageUrl
    : card.dataset.productImageDefaultLarge;
  const image = card.querySelector('.product-card__image img');

  if (image && imageUrl) {
    image.src = imageUrl;
    image.removeAttribute('srcset');
    image.alt = variantImage?.alt || card.dataset.productTitle || '';

    const imageWidth = Number(variantImage?.width || card.dataset.productImageDefaultWidth);
    const imageHeight = Number(variantImage?.height || card.dataset.productImageDefaultHeight);
    if (Number.isFinite(imageWidth) && imageWidth > 0) image.width = imageWidth;
    if (Number.isFinite(imageHeight) && imageHeight > 0) image.height = imageHeight;
  }

  card.dataset.productImage = variantImageUrl
    ? variantImage.thumb_src || getSizedImageUrl(variantImageUrl, 160)
    : card.dataset.productImageDefault || '';

  const imageWidth = Number(variantImage?.width || card.dataset.productImageDefaultWidth);
  const imageHeight = Number(variantImage?.height || card.dataset.productImageDefaultHeight);
  const imageRatio = Number(variantImage?.aspect_ratio)
    || (imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 0)
    || Number(card.dataset.productImageDefaultRatio);
  if (Number.isFinite(imageRatio) && imageRatio > 0) {
    card.dataset.productImageRatio = String(imageRatio);
  }

  const productCard = card.querySelector('.product-card');
  const imageLink = productCard?.querySelector('.product-card__image-link');
  const secondaryImageUrl = variantImage?.secondary_src || '';
  const secondaryImageEnabled = card.dataset.productSecondaryImageEnabled !== 'false';
  let secondaryWrapper = imageLink?.querySelector('.product-card__secondary-image');
  let secondaryImage = secondaryWrapper?.querySelector('img');

  if (secondaryImageEnabled && secondaryImageUrl && imageLink && !secondaryWrapper) {
    secondaryWrapper = document.createElement('div');
    secondaryWrapper.className = 'image product-card__secondary-image';
    secondaryImage = document.createElement('img');
    secondaryImage.loading = 'lazy';
    secondaryImage.decoding = 'async';
    secondaryWrapper.append(secondaryImage);
    imageLink.append(secondaryWrapper);
  }

  const hasSecondaryImage = Boolean(
    secondaryImageEnabled && secondaryImageUrl && secondaryWrapper && secondaryImage,
  );
  if (hasSecondaryImage) {
    secondaryImage.src = secondaryImageUrl;
    secondaryImage.removeAttribute('srcset');
    secondaryImage.alt = variantImage?.secondary_alt || card.dataset.productTitle || '';

    const secondaryWidth = Number(variantImage?.secondary_width);
    const secondaryHeight = Number(variantImage?.secondary_height);
    if (Number.isFinite(secondaryWidth) && secondaryWidth > 0) secondaryImage.width = secondaryWidth;
    if (Number.isFinite(secondaryHeight) && secondaryHeight > 0) secondaryImage.height = secondaryHeight;
  } else if (secondaryImage) {
    secondaryImage.alt = '';
  }

  imageLink?.classList.toggle('product-card__image-link--has-secondary', hasSecondaryImage);
  productCard?.classList.toggle('product-card--variant-image-selected', !hasSecondaryImage);
}

function getVariantOptionValue(option) {
  if (option == null) return '';
  if (typeof option !== 'object') return String(option);

  const value = option.value;
  if (value && typeof value === 'object') return String(value.name || value.value || '');
  return String(option.name || value || '');
}

function getVariantOptionValues(variant) {
  if (Array.isArray(variant?.options_with_values) && variant.options_with_values.length) {
    return variant.options_with_values.map((option) => getVariantOptionValue(option?.value));
  }
  if (Array.isArray(variant?.options) && variant.options.length) {
    return variant.options.map(getVariantOptionValue);
  }
  return [variant?.option1, variant?.option2, variant?.option3]
    .filter((value) => value != null)
    .map(getVariantOptionValue);
}

function getVariantSelectLabel(variant, optionNames) {
  const optionValues = getVariantOptionValues(variant);
  return optionValues
    .map((value, index) => {
      const option = variant?.options_with_values?.[index];
      const optionName = option?.name || optionNames[index];
      return optionName ? `${optionName}: ${value}` : value;
    })
    .filter(Boolean)
    .join(' | ') || String(variant?.title || '');
}

function populateBundleVariantSelects(root) {
  root.querySelectorAll('[data-bundle-variant-select]').forEach((select) => {
    const card = select.closest('[data-bundle-product]');
    if (!card) return;

    const variants = getVariantData(card);
    if (!variants.length) return;

    const optionNames = parseJson(select.dataset.optionNames || '[]', []);
    const currentVariantId = String(card.dataset.currentVariantId || select.value || '');
    const currentVariant = variants.find((variant) => String(variant.id) === currentVariantId)
      || variants.find((variant) => variant.available)
      || variants[0];
    if (!currentVariant) return;

    const fragment = document.createDocumentFragment();
    if (select.dataset.unavailableLabel) {
      const unavailableOption = document.createElement('option');
      unavailableOption.value = '';
      unavailableOption.textContent = select.dataset.unavailableLabel;
      unavailableOption.disabled = true;
      fragment.append(unavailableOption);
    }
    variants.forEach((variant) => {
      const option = document.createElement('option');
      option.value = String(variant.id);
      option.dataset.variantAvailable = String(Boolean(variant.available));
      option.textContent = getVariantSelectLabel(variant, optionNames);
      if (!variant.available && select.dataset.soldOutLabel) {
        option.textContent += ` — ${select.dataset.soldOutLabel}`;
      }
      fragment.append(option);
    });

    select.replaceChildren(fragment);
    select.value = String(currentVariant.id);
    card.dataset.currentVariantId = String(currentVariant.id);
    card.dataset.currentVariantAvailable = String(Boolean(currentVariant.available));
  });
}

function quantityRule(variant) {
  const rule = variant?.quantity_rule || {};
  const minValue = Number(rule.min);
  const incrementValue = Number(rule.increment);
  const maxValue = Number(rule.max);
  const min = Number.isFinite(minValue) && minValue > 0 ? Math.floor(minValue) : 1;
  const increment = Number.isFinite(incrementValue) && incrementValue > 0 ? Math.floor(incrementValue) : 1;
  const max = Number.isFinite(maxValue) && maxValue >= min ? Math.floor(maxValue) : null;

  return { min, increment, max };
}

function normalizeQuantity(value, variant) {
  const { min, increment, max } = quantityRule(variant);
  let quantity = Number.parseInt(value, 10);
  if (!Number.isFinite(quantity) || quantity < min) quantity = min;
  if (increment > 1) quantity = min + Math.ceil((quantity - min) / increment) * increment;
  if (max != null && quantity > max) quantity = min + Math.floor((max - min) / increment) * increment;
  return Math.max(min, quantity);
}

function formatMoney(cents, root) {
  const currency = root?.dataset.currency || window.Shopify?.currency?.active || 'USD';
  const locale = document.documentElement.lang || navigator.language || 'en';
  const showCurrencyCode = root?.dataset.currencyCodeDisplay === 'true';
  const formatTemplate = showCurrencyCode
    ? root?.dataset.moneyWithCurrencyFormat
    : root?.dataset.moneyFormat;

  return formatShopifyMoney(cents, formatTemplate, {
    currency,
    currencyDisplay: showCurrencyCode ? 'code' : 'symbol',
    locale,
  });
}

function getGoalLabel(goal) {
  return String(goal?.label || '').trim();
}

function getGoalSavings(goal, subtotal, selectedLines) {
  if (!goal || subtotal <= 0) return 0;

  const isProductDiscount = goal.discountType === 'amount_off_products';
  let savings = 0;
  if (goal.discountMethod === 'percentage') {
    const percentage = Number(goal.discountPercentage);
    if (!Number.isFinite(percentage) || percentage <= 0) return 0;
    savings = Math.round(subtotal * percentage / 100);
  } else if (goal.discountMethod === 'amount') {
    const amount = Number(goal.discountAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const amountCents = Math.round(amount * 100);
    savings = isProductDiscount && !goal.onlyApplyOncePerOrder
      ? selectedLines.reduce((total, line) => total + Math.min(line.unitPrice, amountCents) * line.quantity, 0)
      : amountCents;
  }

  return Math.min(subtotal, Math.max(0, savings));
}

function getEditorSelectionKey(root) {
  if (root.dataset.bundleDesignMode !== 'true' || !root.dataset.sectionId) return null;
  return `bundle-builder:editor:${window.location.host}${window.location.pathname}:${root.dataset.sectionId}`;
}

function readEditorSelection(key) {
  if (!key) return null;
  if (editorSelections.has(key)) return editorSelections.get(key);
  try {
    const saved = parseJson(window.sessionStorage.getItem(key), null);
    if (saved) editorSelections.set(key, saved);
    return saved;
  } catch {
    return null;
  }
}

function saveEditorSelection(key, selection) {
  if (!key) return;
  editorSelections.set(key, selection);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(selection));
  } catch {
    // Keep the selection in memory when storage is unavailable.
  }
}

function updateItemSnapshot(item, card, variant) {
  const imageSnapshot = getVariantImageSnapshot(card, variant);
  item.productTitle = card.dataset.productTitle || '';
  item.productImage = imageSnapshot.src;
  item.productImageRatio = imageSnapshot.ratio;
  item.variant = {
    id: variant.id,
    title: variant.title,
    price: variant.price,
    available: variant.available,
    quantity_rule: variant.quantity_rule,
  };
}

function initialize(root) {
  if (!(root instanceof HTMLElement) || instances.has(root)) return;

  const summary = root.querySelector('[data-bundle-summary]');
  if (!summary) return;

  const mobileSummaryToggle = summary.querySelector('[data-bundle-summary-toggle]');
  const mobileSummarySurface = summary.querySelector('.bundle-summary__surface');
  const mobileSummaryInner = summary.querySelector('.bundle-summary__inner');
  const mobileSummaryHeading = summary.querySelector('.bundle-summary__heading');
  const mobileSummaryProgress = summary.querySelector('[data-bundle-progress]');
  const mobileSummaryItems = summary.querySelector('.bundle-summary__items');
  const mobileSummaryFooter = summary.querySelector('.bundle-summary__footer');
  const mobileViewport = window.matchMedia('(max-width: 767.98px)');
  const productCardImageRatio = getComputedStyle(root).getPropertyValue('--product-card-image-ratio').trim();
  const abortController = new AbortController();
  const { signal } = abortController;
  const parsedGoals = parseJson(summary.dataset.goals || '[]', []);
  const productList = root.querySelector('.bundle-product-list');
  const sourceSignature = JSON.stringify([
    productList?.dataset.bundleSourceCollection || '',
    productList?.dataset.bundleSourceProducts || '',
  ]);
  const selectionKey = getEditorSelectionKey(root);
  const savedSelection = readEditorSelection(selectionKey);
  const selected = new Map();
  if (savedSelection?.source === sourceSignature && Array.isArray(savedSelection.items)) {
    savedSelection.items.forEach((item) => {
      if (!item || !item.productId || !item.variantId) return;
      selected.set(String(item.variantId), item);
    });
  }
  const state = {
    abortController,
    canSubmitBundle: false,
    isSubmitting: false,
    selected,
    goals: Array.isArray(parsedGoals) ? parsedGoals.filter((goal) => goal?.enabled) : [],
    placeholderCount: Math.max(0, Number.parseInt(summary.dataset.placeholderCount || '3', 10) || 0),
    summary,
  };
  instances.set(root, state);

  const saveSelection = () => {
    saveEditorSelection(selectionKey, {
      source: sourceSignature,
      items: Array.from(state.selected.values()),
    });
  };

  const measureCollapsedSummaryHeight = () => {
    if (!mobileViewport.matches || !mobileSummarySurface || !mobileSummaryInner || !mobileSummaryHeading || !mobileSummaryFooter) return;
    const surfaceStyle = getComputedStyle(mobileSummarySurface);
    const innerGap = Number.parseFloat(getComputedStyle(mobileSummaryInner).rowGap) || 0;
    const chromeHeight = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
      .reduce((height, property) => height + (Number.parseFloat(surfaceStyle[property]) || 0), 0);
    const contentHeight = mobileSummaryHeading.getBoundingClientRect().height
      + mobileSummaryFooter.getBoundingClientRect().height + innerGap;
    summary.style.setProperty('--bundle-summary-collapsed-height', `${Math.ceil(chromeHeight + contentHeight)}px`);
  };

  const measureExpandedSummaryHeight = () => {
    if (!mobileViewport.matches || !mobileSummarySurface || !mobileSummaryInner || !mobileSummaryHeading || !mobileSummaryItems || !mobileSummaryFooter) return;
    const surfaceStyle = getComputedStyle(mobileSummarySurface);
    const innerGap = Number.parseFloat(getComputedStyle(mobileSummaryInner).rowGap) || 0;
    const chromeHeight = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
      .reduce((height, property) => height + (Number.parseFloat(surfaceStyle[property]) || 0), 0);
    const progressHeight = mobileSummaryProgress?.hidden ? 0 : mobileSummaryProgress?.scrollHeight || 0;
    const headerHeight = mobileSummaryHeading.getBoundingClientRect().height + (progressHeight ? 14 + progressHeight : 0);
    const productsHeight = mobileSummaryItems.scrollHeight;
    const contentHeight = headerHeight + productsHeight + mobileSummaryFooter.getBoundingClientRect().height + innerGap * 2;
    summary.style.setProperty('--bundle-summary-expanded-height', `${Math.ceil(chromeHeight + contentHeight)}px`);
  };

  const setMobileSummaryExpanded = (expanded) => {
    if (!expanded) measureCollapsedSummaryHeight();
    else measureExpandedSummaryHeight();
    summary.dataset.mobileExpanded = String(expanded);
    mobileSummaryToggle?.setAttribute('aria-expanded', String(expanded));
    const detailsInert = mobileViewport.matches && !expanded;
    if (mobileSummaryProgress) mobileSummaryProgress.inert = detailsInert;
    if (mobileSummaryItems) mobileSummaryItems.inert = detailsInert;
  };

  const isMobileSummaryExpanded = () => mobileSummaryToggle?.getAttribute('aria-expanded') === 'true';

  const updateMobileSummaryMode = () => {
    if (mobileSummaryToggle) mobileSummaryToggle.disabled = !mobileViewport.matches;
    if (!mobileViewport.matches) {
      setMobileSummaryExpanded(false);
      summary.style.removeProperty('--bundle-summary-collapsed-height');
      summary.style.removeProperty('--bundle-summary-expanded-height');
    } else {
      measureCollapsedSummaryHeight();
      measureExpandedSummaryHeight();
      setMobileSummaryExpanded(isMobileSummaryExpanded());
    }
  };

  summary.dataset.mobileSticky = 'true';
  mobileSummaryToggle?.addEventListener('click', () => {
    if (!mobileViewport.matches) return;
    setMobileSummaryExpanded(!isMobileSummaryExpanded());
  }, { signal });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMobileSummaryExpanded()) return;
    setMobileSummaryExpanded(false);
    mobileSummaryToggle?.focus();
  }, { signal });
  mobileViewport.addEventListener('change', updateMobileSummaryMode, { signal });
  window.addEventListener('resize', () => {
    measureCollapsedSummaryHeight();
    measureExpandedSummaryHeight();
  }, { signal });
  updateMobileSummaryMode();

  const renderProductButton = (card) => {
    const button = card.querySelector('[data-bundle-toggle]');
    if (!button) return;
    const variantId = String(card.dataset.currentVariantId || '');
    const selected = variantId !== '' && state.selected.has(variantId);
    const available = card.dataset.currentVariantAvailable === 'true';
    const addLabel = button.dataset.bundleLabelAdd;
    const label = selected ? button.dataset.bundleLabelAdded || addLabel : addLabel;
    const productTitle = card.dataset.productTitle || '';
    const visibleLabel = button.querySelector('.btn__text');

    if (visibleLabel && label) visibleLabel.textContent = label;
    button.removeAttribute('aria-pressed');
    button.setAttribute('aria-label', selected
      ? `${label || ''}: ${productTitle}`.trim()
      : button.dataset.bundleAriaAdd || `${label || ''}: ${productTitle}`.trim());
    button.disabled = state.isSubmitting || !available || selected;
  };

  const getCurrent = (card) => {
    const variantId = card.dataset.currentVariantId;
    const variant = getVariant(card, variantId);
    if (!variant || !variant.available) return null;
    return { variant, variantId: String(variant.id) };
  };

  const render = () => {
    const list = summary.querySelector('[data-bundle-items]');
    const template = summary.querySelector('[data-bundle-item-template]');
    const placeholderTemplate = summary.querySelector('[data-bundle-placeholder-template]');
    const totalPrice = summary.querySelector('[data-bundle-total-price]');
    const subtotalOutput = summary.querySelector('[data-bundle-subtotal]');
    const discountedTotal = summary.querySelector('[data-bundle-discounted-total]');
    const discountedTotalOutput = summary.querySelector('[data-bundle-discounted-total-value]');
    const originalTotal = summary.querySelector('[data-bundle-original-total]');
    const originalTotalOutput = summary.querySelector('[data-bundle-original-total-value]');
    const saving = summary.querySelector('[data-bundle-saving]');
    const savingAmount = summary.querySelector('[data-bundle-saving-amount]');
    const submitButton = summary.querySelector('[data-bundle-submit]');
    const fragment = document.createDocumentFragment();
    let subtotal = 0;
    let itemCount = 0;
    const selectedLines = [];

    state.selected.forEach((item, variantId) => {
      const productId = String(item.productId || '');
      const card = root.querySelector(`[data-bundle-product][data-product-id="${CSS.escape(productId)}"]`);
      const variant = card ? getVariant(card, variantId) : item.variant;
      if (!variant || !variant.available) {
        state.selected.delete(variantId);
        return;
      }
      if (card) updateItemSnapshot(item, card, variant);

      const productTitle = card?.dataset.productTitle || item.productTitle || '';
      const productImage = item.productImage || card?.dataset.productImage || '';
      const productImageRatio = Number(item.productImageRatio || card?.dataset.productImageRatio);

      const quantity = normalizeQuantity(item.quantity, variant);
      item.quantity = quantity;
      const unitPrice = Math.max(0, Number(variant.price) || 0);
      const linePrice = unitPrice * quantity;
      subtotal += linePrice;
      itemCount += quantity;
      selectedLines.push({ unitPrice, quantity });

      if (!template?.content?.firstElementChild) return;
      const itemNode = template.content.firstElementChild.cloneNode(true);
      itemNode.dataset.productId = productId;
      itemNode.dataset.variantId = variantId;

      const image = itemNode.querySelector('[data-bundle-item-image]');
      const itemMedia = itemNode.querySelector('.bundle-summary__item-media');
      if (itemMedia && productCardImageRatio === 'auto' && Number.isFinite(productImageRatio) && productImageRatio > 0) {
        itemMedia.style.aspectRatio = String(productImageRatio);
      }
      if (image) {
        if (productImage) image.src = productImage;
        else image.removeAttribute('src');
        image.alt = '';
        image.hidden = !productImage;
      }

      const title = itemNode.querySelector('[data-bundle-item-title]');
      if (title) title.textContent = productTitle;

      const variantName = itemNode.querySelector('[data-bundle-item-variant]');
      const variantTitle = variant.title && variant.title !== 'Default Title' ? variant.title : '';
      if (variantName) {
        variantName.textContent = variantTitle;
        variantName.hidden = !variantTitle;
      }

      const lineTotal = itemNode.querySelector('[data-bundle-item-total]');
      if (lineTotal) {
        lineTotal.textContent = formatMoney(linePrice, root);
        lineTotal.setAttribute('aria-label', `${lineTotal.getAttribute('aria-label')}: ${formatMoney(linePrice, root)}`);
      }

      const quantityInput = itemNode.querySelector('[data-bundle-quantity]');
      const quantityControls = itemNode.querySelector('[data-bundle-quantity-controls]');
      const staticQuantity = itemNode.querySelector('[data-bundle-static-quantity]');
      if (quantityInput) {
        const rule = quantityRule(variant);
        quantityInput.value = String(quantity);
        quantityInput.min = String(rule.min);
        quantityInput.step = String(rule.increment);
        if (rule.max == null) quantityInput.removeAttribute('max');
        else quantityInput.max = String(rule.max);
        quantityInput.dataset.productId = productId;
        quantityInput.dataset.variantId = variantId;
        quantityInput.setAttribute('aria-label', `${quantityInput.getAttribute('aria-label')}: ${productTitle}`);
        const decreaseButton = itemNode.querySelector('[data-bundle-quantity-decrease]');
        const increaseButton = itemNode.querySelector('[data-bundle-quantity-increase]');
        quantityInput.disabled = state.isSubmitting;
        if (decreaseButton) decreaseButton.disabled = state.isSubmitting || quantity <= rule.min;
        if (increaseButton) increaseButton.disabled = state.isSubmitting || (rule.max != null && quantity >= rule.max);
      }
      if (state.summary.dataset.showQuantity === 'true') {
        if (staticQuantity) staticQuantity.hidden = true;
      } else {
        if (quantityControls) quantityControls.hidden = true;
        if (staticQuantity) {
          staticQuantity.textContent = quantity > 1 ? String(quantity) : '';
          staticQuantity.hidden = quantity <= 1;
          if (quantity > 1) {
            staticQuantity.setAttribute('aria-label', `${staticQuantity.getAttribute('aria-label')}: ${productTitle}`);
          }
        }
      }

      const removeButton = itemNode.querySelector('[data-bundle-remove]');
      if (removeButton) {
        removeButton.dataset.productId = productId;
        removeButton.dataset.variantId = variantId;
        removeButton.disabled = state.isSubmitting;
        removeButton.setAttribute('aria-label', `${removeButton.textContent.trim()}: ${productTitle}`);
      }
      itemNode.querySelectorAll('[data-bundle-quantity-decrease], [data-bundle-quantity-increase]').forEach((button) => {
        button.dataset.productId = productId;
        button.dataset.variantId = variantId;
        button.setAttribute('aria-label', `${button.getAttribute('aria-label')}: ${productTitle}`);
      });

      fragment.append(itemNode);
      if (card) renderProductButton(card);
    });

    const placeholder = placeholderTemplate?.content?.firstElementChild;
    if (placeholder) {
      const remainingPlaceholders = Math.max(0, state.placeholderCount - itemCount);
      for (let index = 0; index < remainingPlaceholders; index += 1) {
        fragment.append(placeholder.cloneNode(true));
      }
    }

    const goalStatus = state.goals
      .map((goal, originalIndex) => {
        const isAmount = goal.minimumType === 'amount';
        const threshold = Number(isAmount ? goal.minimumAmount : goal.minimumQuantity);
        const target = isAmount ? Math.round(threshold * 100) : threshold;
        const current = isAmount ? subtotal : itemCount;
        return { goal, originalIndex, target, current, remaining: Math.max(0, target - current), complete: current >= target, isAmount };
      })
      .filter(({ target }) => Number.isFinite(target) && target > 0)
      .sort((left, right) => left.target - right.target || left.originalIndex - right.originalIndex);
    const unlockedGoal = goalStatus.filter((status) => status.complete).pop();
    const estimatedSavings = getGoalSavings(unlockedGoal?.goal, subtotal, selectedLines);
    const discountedSubtotal = Math.max(0, subtotal - estimatedSavings);
    const hasDiscountedPrice = estimatedSavings > 0;
    totalPrice?.classList.toggle('price--sale', hasDiscountedPrice);
    totalPrice?.classList.toggle('price--sale-first', hasDiscountedPrice);
    if (subtotalOutput) {
      subtotalOutput.hidden = hasDiscountedPrice;
      subtotalOutput.textContent = formatMoney(subtotal, root);
    }
    if (discountedTotal && discountedTotalOutput) {
      discountedTotal.hidden = !hasDiscountedPrice;
      discountedTotalOutput.textContent = formatMoney(discountedSubtotal, root);
    }
    if (originalTotal && originalTotalOutput) {
      originalTotal.hidden = !hasDiscountedPrice;
      originalTotalOutput.textContent = formatMoney(subtotal, root);
    }
    if (saving && savingAmount) {
      saving.hidden = estimatedSavings <= 0;
      savingAmount.textContent = estimatedSavings > 0 ? formatMoney(estimatedSavings, root) : '';
    }
    const firstGoal = goalStatus[0];
    state.canSubmitBundle = state.selected.size > 0 && (!firstGoal || firstGoal.complete);

    list?.replaceChildren(fragment);
    if (submitButton) {
      submitButton.disabled = !state.canSubmitBundle || state.isSubmitting;
      setButtonLoadingState(submitButton, state.isSubmitting, {
        buttonStateKey: 'bundleLoading',
      });
    }
    if (productList) {
      productList.inert = state.isSubmitting;
      if (state.isSubmitting) productList.setAttribute('aria-busy', 'true');
      else productList.removeAttribute('aria-busy');
    }
    if (mobileSummaryItems) mobileSummaryItems.inert = state.isSubmitting;
    root.querySelectorAll('[data-bundle-product]').forEach(renderProductButton);

    const progress = summary.querySelector('[data-bundle-progress]');
    const progressMessage = summary.querySelector('[data-bundle-progress-message]');
    const progressBar = summary.querySelector('[data-bundle-progress-bar]');
    const progressFill = summary.querySelector('[data-bundle-progress-fill]');
    const progressMilestones = summary.querySelector('[data-bundle-progress-milestones]');
    const progressMilestoneLabels = summary.querySelector('[data-bundle-progress-milestone-labels]');
    const milestoneTemplate = summary.querySelector('[data-bundle-progress-milestone-template]');
    const milestoneLabelTemplate = summary.querySelector('[data-bundle-progress-milestone-label-template]');

    if (progress && goalStatus.length > 0) {
      progress.hidden = false;
      const nextGoal = goalStatus.find((status) => !status.complete);
      const current = goalStatus[0]?.current || 0;
      const nextGoalIndex = goalStatus.findIndex((status) => !status.complete);
      let percent = 100;

      if (nextGoalIndex !== -1) {
        const previousTarget = nextGoalIndex > 0 ? goalStatus[nextGoalIndex - 1].target : 0;
        const nextTarget = goalStatus[nextGoalIndex].target;
        const tierRange = nextTarget - previousTarget;
        const tierProgress = tierRange > 0
          ? Math.min(1, Math.max(0, (current - previousTarget) / tierRange))
          : 0;
        percent = ((nextGoalIndex + tierProgress) / goalStatus.length) * 100;
      }

      progress.dataset.tiered = String(goalStatus.length >= 2);
      progress.dataset.complete = String(nextGoalIndex === -1);

      if (nextGoal) {
        const remaining = nextGoal.isAmount ? formatMoney(nextGoal.remaining, root) : String(Math.ceil(nextGoal.remaining));
        const message = (summary.dataset.initialMessage || '')
          .replaceAll('[x]', remaining)
          .replaceAll('[label]', getGoalLabel(nextGoal.goal));
        if (progressMessage) progressMessage.textContent = message;
      } else if (progressMessage) {
        progressMessage.textContent = summary.dataset.unlockedMessage || '';
      }

      if (progressFill) progressFill.style.width = `${percent}%`;
      progressBar?.setAttribute('aria-valuenow', String(Math.round(percent)));

      if (
        goalStatus.length >= 2 &&
        progressMilestones &&
        progressMilestoneLabels &&
        milestoneTemplate?.content?.firstElementChild &&
        milestoneLabelTemplate?.content?.firstElementChild
      ) {
        const markerFragment = document.createDocumentFragment();
        const labelFragment = document.createDocumentFragment();

        goalStatus.forEach((status, index) => {
          const position = ((index + 1) / goalStatus.length) * 100;
          const marker = milestoneTemplate.content.firstElementChild.cloneNode(true);
          marker.style.setProperty('--bundle-progress-position', `${position}%`);
          marker.dataset.complete = String(status.complete);
          markerFragment.append(marker);

          const label = milestoneLabelTemplate.content.firstElementChild.cloneNode(true);
          const rewardLabel = getGoalLabel(status.goal);
          label.style.setProperty('--bundle-progress-position', `${position}%`);
          label.textContent = rewardLabel || (status.isAmount ? formatMoney(status.target, root) : String(status.target));
          labelFragment.append(label);
        });

        progressMilestones.replaceChildren(markerFragment);
        progressMilestoneLabels.replaceChildren(labelFragment);
        progressMilestones.hidden = false;
        progressMilestoneLabels.hidden = false;
      } else {
        if (progressMilestones) progressMilestones.hidden = true;
        if (progressMilestoneLabels) progressMilestoneLabels.hidden = true;
      }
    } else if (progress) {
      progress.hidden = true;
    }
    measureCollapsedSummaryHeight();
    measureExpandedSummaryHeight();
    saveSelection();
  };

  const updateCardVariant = (card, variant) => {
    card.dataset.currentVariantId = variant?.id ? String(variant.id) : '';
    card.dataset.currentVariantAvailable = String(Boolean(variant?.available));
    updateProductImage(card, variant);
    card.querySelectorAll('[data-bundle-variant-select]').forEach((variantSelect) => {
      variantSelect.value = variant?.id ? String(variant.id) : '';
    });

    renderProductButton(card);
    render();
  };

  const handleVariantChange = (event) => {
    const card = event.target.closest('[data-bundle-product]');
    if (state.isSubmitting || !card || !root.contains(card)) return;
    updateCardVariant(card, event.detail?.variant);
  };

  const handleBundleToggle = (event) => {
    const toggle = event.currentTarget;
    if (state.isSubmitting || !(toggle instanceof HTMLButtonElement) || toggle.disabled) return;
    const card = toggle.closest('[data-bundle-product]');
    if (!card || !root.contains(card)) return;
    const current = getCurrent(card);
    if (!current || state.selected.has(current.variantId)) return;
    state.selected.set(current.variantId, {
      productId: String(card.dataset.productId || ''),
      variantId: current.variantId,
      quantity: quantityRule(current.variant).min,
    });
    updateItemSnapshot(state.selected.get(current.variantId), card, current.variant);
    render();
  };

  root.querySelectorAll('[data-bundle-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', handleBundleToggle, { signal });
  });

  const handleClick = (event) => {
    const remove = event.target.closest('[data-bundle-remove]');
    if (remove && root.contains(remove)) {
      if (state.isSubmitting) return;
      state.selected.delete(String(remove.dataset.variantId || ''));
      render();
      return;
    }

    const decrement = event.target.closest('[data-bundle-quantity-decrease]');
    const increment = event.target.closest('[data-bundle-quantity-increase]');
    if ((decrement || increment) && root.contains(event.target)) {
      if (state.isSubmitting) return;
      const variantId = String((decrement || increment).dataset.variantId || '');
      const item = state.selected.get(variantId);
      const card = item
        ? root.querySelector(`[data-bundle-product][data-product-id="${CSS.escape(item.productId)}"]`)
        : null;
      const variant = card ? getVariant(card, item?.variantId) : item?.variant;
      if (!item || !variant) return;

      const { increment: step, max } = quantityRule(variant);
      item.quantity = normalizeQuantity(item.quantity + (decrement ? -step : step), variant);
      if (max != null) item.quantity = Math.min(item.quantity, max);
      render();
      return;
    }

    const submit = event.target.closest('[data-bundle-submit]');
    if (submit && root.contains(submit)) {
      event.preventDefault();
      addBundle(submit);
    }
  };

  const handleChange = (event) => {
    if (state.isSubmitting) return;

    const variantSelect = event.target.closest('[data-bundle-variant-select]');
    if (variantSelect && root.contains(variantSelect)) {
      const card = variantSelect.closest('[data-bundle-product]');
      const variant = card ? getVariant(card, variantSelect.value) : null;
      if (!card || !variant) return;

      variantSelect.dispatchEvent(new CustomEvent('variant:change', {
        bubbles: true,
        detail: {
          variant,
          variantId: String(variant.id),
          options: getVariantOptionValues(variant),
          available: Boolean(variant.available),
          source: 'bundle-dropdown',
        },
      }));
      return;
    }

    const optionControl = event.target.closest('[data-option-control]');
    const picker = optionControl?.closest('variant-picker');
    if (picker && root.contains(picker)) {
      const card = picker.closest('[data-bundle-product]');
      const selectedOptions = Array.from(picker.querySelectorAll('.variant-picker__option[data-option-index]'))
        .map((group) => {
          const control = group.querySelector('select[data-option-control], input[data-option-control]:checked')
            || group.querySelector('[data-option-control]');
          return control?.value || '';
        });
      const variant = card
        ? getVariantData(card).find((candidate) => {
          const options = getVariantOptionValues(candidate);
          return options.length === selectedOptions.length
            && options.every((value, index) => String(value) === String(selectedOptions[index]));
        }) || null
        : null;

      if (card && String(card.dataset.currentVariantId || '') !== String(variant?.id || '')) {
        updateCardVariant(card, variant);
      }
      return;
    }

    const input = event.target.closest('[data-bundle-quantity]');
    if (!input || !root.contains(input)) return;
    const variantId = String(input.dataset.variantId || '');
    const item = state.selected.get(variantId);
    const card = item
      ? root.querySelector(`[data-bundle-product][data-product-id="${CSS.escape(item.productId)}"]`)
      : null;
    const variant = card ? getVariant(card, item?.variantId) : item?.variant;
    if (!item || !variant) return;

    item.quantity = normalizeQuantity(input.value, variant);
    render();
  };

  const addBundle = async (submit) => {
    if (!state.canSubmitBundle || state.isSubmitting) return;

    const items = Array.from(state.selected.values()).map((item) => ({
      id: Number(item.variantId),
      quantity: Number(item.quantity),
    }));
    if (items.some((item) => !Number.isFinite(item.id) || !Number.isFinite(item.quantity) || item.quantity < 1)) {
      return;
    }

    state.isSubmitting = true;
    try {
      render();

      const rootPath = window.Shopify?.routes?.root || '/';
      const response = await fetch(`${rootPath.replace(/\/$/, '')}/cart/add.js`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!response.ok) return;

      setMobileSummaryExpanded(false);
      state.selected.clear();
      render();

      const drawerTrigger = document.querySelector('[data-cart-drawer-open]');
      if (drawerTrigger) {
        drawerTrigger.click();
      } else {
        window.location.assign(`${rootPath.replace(/\/$/, '')}/cart`);
      }
    } catch {
      // Keep the selection available for another attempt.
    } finally {
      state.isSubmitting = false;
      render();
    }
  };

  root.addEventListener('click', handleClick, { signal });
  root.addEventListener('change', handleChange, { signal });
  root.addEventListener('variant:change', handleVariantChange, { signal });
  populateBundleVariantSelects(root);
  root.querySelectorAll('[data-bundle-product]').forEach((card) => {
    const variant = getVariant(card, card.dataset.currentVariantId);
    if (variant) updateProductImage(card, variant);
  });
  render();
}

function destroy(scope) {
  const roots = scope instanceof HTMLElement
    ? [scope, ...scope.querySelectorAll('[data-bundle-builder]')]
    : [];
  roots.forEach((root) => {
    const state = instances.get(root);
    if (!state) return;
    state.abortController.abort();
    delete state.summary.dataset.mobileSticky;
    state.summary.dataset.mobileExpanded = 'false';
    state.summary.style.removeProperty('--bundle-summary-collapsed-height');
    const toggle = state.summary.querySelector('[data-bundle-summary-toggle]');
    if (toggle) {
      toggle.disabled = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
    const progress = state.summary.querySelector('[data-bundle-progress]');
    const items = state.summary.querySelector('.bundle-summary__items');
    if (progress) progress.inert = false;
    if (items) items.inert = false;
    state.selected.clear();
    instances.delete(root);
  });
}

function initializeWithin(scope = document) {
  if (scope instanceof HTMLElement && scope.matches('[data-bundle-builder]')) initialize(scope);
  scope.querySelectorAll?.('[data-bundle-builder]').forEach(initialize);
}

initializeWithin();

document.addEventListener('shopify:section:load', (event) => initializeWithin(event.target));
document.addEventListener('shopify:section:select', (event) => initializeWithin(event.target));
document.addEventListener('shopify:section:unload', (event) => destroy(event.target));
document.addEventListener('shopify:section:deselect', (event) => initializeWithin(event.target));
