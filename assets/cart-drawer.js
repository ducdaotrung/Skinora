(() => {
  const controllerKey = '__cartDrawerController';
  if (window[controllerKey]) {
    window[controllerKey].initialize(document);
    return;
  }

  const state = {
    drawer: null,
    sectionRoot: null,
    overlay: null,
    opener: null,
    request: null,
    cart: null,
    editorSelected: false,
    recommendationProductId: null,
    variantComparePrices: new Map(),
    orderOptionsDrag: null,
    cartRevision: 0,
  };

  const getDrawer = (root = document) => {
    if (!root) return null;
    if (root.matches?.('[data-cart-drawer]')) return root;
    return root.querySelector?.('[data-cart-drawer]') || null;
  };

  const endpoint = (path) => {
    if (!path) return '';
    return path.endsWith('.js') ? path : `${path}.js`;
  };

  const setLoading = (isLoading) => {
    if (!state.drawer) return;
    state.drawer.classList.toggle('is-loading', isLoading);
    state.drawer.setAttribute('aria-busy', String(isLoading));
    const loader = state.drawer.querySelector('[data-cart-drawer-loading]');
    if (loader) loader.hidden = !isLoading;
  };

  const setError = (message = '') => {
    const error = state.drawer?.querySelector('[data-cart-drawer-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  };

  const updateHeaderCount = (cart) => {
    const count = Number(cart?.item_count || 0);
    document.querySelectorAll('[data-cart-drawer-item-count]').forEach((badge) => {
      badge.textContent = `(${count})`;
      badge.setAttribute('aria-label', String(count));
    });
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      const isTextCount = badge.classList.contains('header-cart__count--text');
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.setAttribute('aria-label', String(count));
      badge.hidden = !isTextCount && count === 0;
    });
    document.querySelectorAll('[data-cart-drawer-open]').forEach((trigger) => {
      const label = trigger.dataset.cartLabel || 'Cart';
      trigger.setAttribute('aria-label', count > 0 ? `${label}, ${count}` : label);
    });
  };

  const parseError = async (response) => {
    try {
      const data = await response.json();
      return data.description || data.message || '';
    } catch (error) {
      return '';
    }
  };

  const escapeHtml = (value) => {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  };

  const formatMoney = (amount, currency) => {
    const value = Number(amount || 0) / 100;
    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(value);
    } catch (error) {
      return `${value.toFixed(2)} ${currency || ''}`.trim();
    }
  };

  const formatMoneyWithCurrency = (amount, currency) => {
    const code = currency || state.drawer?.dataset.currency || 'USD';
    const formatted = formatMoney(amount, code);
    return formatted.includes(code) ? formatted : `${formatted} ${code}`;
  };

  const productUnitPrice = (item) => Number(
    item.original_price ?? item.price ?? item.final_price ?? 0,
  );

  const originalUnitPrice = (item) => Math.max(
    productUnitPrice(item),
    Number(item.original_price ?? 0),
    Number(item.compare_at_price ?? 0),
    Number(item.selling_plan_allocation?.compare_at_price ?? 0),
    Number(state.variantComparePrices.get(String(item.variant_id)) || 0),
  );

  const seedVariantComparePrices = () => {
    state.drawer?.querySelectorAll('[data-cart-line][data-variant-id]').forEach((line) => {
      const variantId = String(line.dataset.variantId || '');
      const comparePrice = Number(line.dataset.comparePrice || 0);
      if (variantId && comparePrice > 0) state.variantComparePrices.set(variantId, comparePrice);
    });
  };

  const hydrateVariantComparePrices = async (cart) => {
    const products = new Map();
    (cart.items || []).forEach((item) => {
      const variantId = String(item.variant_id || '');
      if (!variantId || state.variantComparePrices.has(variantId)) return;
      const productPath = String(item.url || '').split('?')[0];
      if (productPath) products.set(productPath, true);
    });

    await Promise.all(Array.from(products.keys()).map(async (productPath) => {
      try {
        const response = await fetch(`${productPath}.js`, {
          cache: 'force-cache',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;
        const product = await response.json();
        (product.variants || []).forEach((variant) => {
          state.variantComparePrices.set(String(variant.id), Number(variant.compare_at_price || 0));
        });
      } catch (error) {
        return;
      }
    }));

    (cart.items || []).forEach((item) => {
      const comparePrice = state.variantComparePrices.get(String(item.variant_id));
      if (comparePrice != null) item.compare_at_price = comparePrice;
    });
  };

  const renderCartLine = (item, lineIndex, currency) => {
    const title = item.product_title || item.title || '';
    const variantTitle = item.variant_title && item.variant_title !== 'Default Title'
      ? `<p class="cart-drawer__item-options body-text body-sm">${escapeHtml(item.variant_title)}</p>`
      : '';
    const properties = Object.entries(item.properties || {})
      .filter(([, value]) => value != null && String(value) !== '')
      .map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`)
      .join('');
    const propertiesMarkup = properties ? `<dl class="cart-drawer__item-properties body-text body-sm">${properties}</dl>` : '';
    const currentPrice = productUnitPrice(item);
    const originalPrice = originalUnitPrice(item);
    const isSale = originalPrice > currentPrice;
    const comparePrice = isSale ? `<s class="cart-drawer__item-price-compare body-sm">${formatMoney(originalPrice, currency)}</s>` : '';
    const showSaleFirst = state.drawer?.dataset.showSalePriceFirst !== 'false';
    const imageMarkup = item.image
      ? `<img class="cart-drawer__image" src="${escapeHtml(item.image)}" alt="${escapeHtml(title)}" loading="lazy" width="240" height="240">`
      : '';
    const key = escapeHtml(item.key || '');
    const url = escapeHtml(item.url || '#');
    const quantity = Math.max(0, Number(item.quantity || 0));
    const safeId = String(item.key || lineIndex).replace(/[^a-z0-9_-]/gi, '-');
    const removeIcon = state.drawer?.dataset.removeIcon || '';
    const decreaseIcon = state.drawer?.dataset.decreaseIcon || '';
    const increaseIcon = state.drawer?.dataset.increaseIcon || '';

    return `<article class="cart-drawer__item${isSale ? ' is-sale' : ''}" data-cart-line data-line-key="${key}" data-variant-id="${escapeHtml(item.variant_id || '')}" data-compare-price="${originalPrice}">
      <a class="cart-drawer__item-media" href="${url}" aria-label="${escapeHtml(title)}">${imageMarkup}</a>
      <div class="cart-drawer__item-info">
        <h3 class="cart-drawer__item-title card-title-text"><a href="${url}">${escapeHtml(title)}</a></h3>
        ${variantTitle}${propertiesMarkup}
        <p class="cart-drawer__item-price card-price-text body-md${isSale ? ' is-sale' : ''}">
          ${isSale && !showSaleFirst ? comparePrice : ''}
          <span class="cart-drawer__item-price-current">${formatMoney(currentPrice, currency)}</span>
          ${isSale && showSaleFirst ? comparePrice : ''}
        </p>
      </div>
      <div class="cart-drawer__item-actions">
        <button class="cart-drawer__remove" type="button" data-cart-remove data-line-key="${key}" data-line-index="${lineIndex}" aria-label="${escapeHtml(state.drawer?.dataset.removeLabel || 'Remove')}">${removeIcon}</button>
        <div class="cart-drawer__quantity" data-cart-quantity>
          <button type="button" data-cart-quantity-action="decrease" data-line-key="${key}" data-line-index="${lineIndex}" aria-label="${escapeHtml(state.drawer?.dataset.decreaseLabel || 'Decrease quantity')}"><span class="cart-drawer__quantity-icon" aria-hidden="true">${decreaseIcon}</span></button>
          <input id="CartDrawerQuantity-${safeId}" type="number" min="0" value="${quantity}" inputmode="numeric" aria-label="${escapeHtml(state.drawer?.dataset.quantityLabel || 'Quantity')}" data-cart-quantity-input data-line-key="${key}" data-line-index="${lineIndex}">
          <button type="button" data-cart-quantity-action="increase" data-line-key="${key}" data-line-index="${lineIndex}" aria-label="${escapeHtml(state.drawer?.dataset.increaseLabel || 'Increase quantity')}"><span class="cart-drawer__quantity-icon" aria-hidden="true">${increaseIcon}</span></button>
        </div>
      </div>
    </article>`;
  };

  const updateShippingProgress = (cart) => {
    const progress = state.drawer?.querySelector('[data-cart-drawer-shipping-progress]');
    if (!progress) return;
    const threshold = Math.max(0, Number(state.drawer.dataset.shippingThreshold || 0));
    const total = Number(cart.items_subtotal_price ?? cart.total_price ?? 0);
    const remaining = Math.max(0, threshold - total);
    const unlocked = threshold > 0 && remaining === 0;
    progress.hidden = !cart.item_count || !cart.requires_shipping || state.drawer.dataset.freeShippingEnabled !== 'true';
    progress.dataset.unlocked = String(unlocked);
    const message = progress.querySelector('[data-cart-drawer-shipping-message]');
    const progressValue = progress.querySelector('[data-cart-drawer-shipping-progress-value]');
    const goalAmount = progress.querySelector('[data-cart-drawer-shipping-goal]');
    const template = unlocked
      ? state.drawer.dataset.freeShippingSuccessMessage
      : state.drawer.dataset.freeShippingPendingMessage;
    if (message) message.textContent = (template || '').replace('{amount}', formatMoneyWithCurrency(remaining, cart.currency));
    if (progressValue) progressValue.style.width = `${threshold > 0 ? Math.min(100, (total / threshold) * 100) : 0}%`;
    if (goalAmount) goalAmount.textContent = unlocked
      ? goalAmount.dataset.completeLabel || "You've got it!"
      : formatMoneyWithCurrency(threshold, cart.currency);
  };

  const getAppliedDiscountCount = (cart) => {
    const applications = new Set();
    const codes = new Set();
    const discountKey = (discount) => String(
      discount?.code || discount?.title || discount?.key || '',
    ).trim().toLowerCase();

    (cart.discount_codes || cart.discountCodes || [])
      .filter((discount) => discount.applicable === true)
      .forEach((discount) => {
        const key = discountKey(discount);
        if (key) codes.add(key);
      });
    (cart.cart_level_discount_applications || [])
      .filter((discount) => Number(discount.total_allocated_amount || 0) > 0)
      .forEach((discount) => {
        const key = discountKey(discount);
        if (key) applications.add(key);
      });
    (cart.items || []).forEach((item) => {
      (item.line_level_discount_allocations || [])
        .filter((allocation) => Number(allocation.amount || 0) > 0)
        .forEach((allocation) => {
          const key = discountKey(allocation.discount_application || allocation);
          if (key) applications.add(key);
        });
    });

    return applications.size || codes.size;
  };

  const mergeDiscountCodes = (...groups) => {
    const codes = [];
    const seen = new Set();
    groups.flat().forEach((value) => {
      const code = String(value || '').trim();
      const normalizedCode = code.toLowerCase();
      if (!normalizedCode || seen.has(normalizedCode)) return;
      seen.add(normalizedCode);
      codes.push(code);
    });
    return codes;
  };

  const getStoredDiscountCodes = (cart) => {
    const discountCodes = (cart?.discount_codes || cart?.discountCodes || [])
      .filter((discount) => discount.applicable !== false)
      .map((discount) => discount.code);
    if (discountCodes.length) return mergeDiscountCodes(discountCodes);

    const applications = [
      ...(cart?.discount_applications || []),
      ...(cart?.cart_level_discount_applications || []),
      ...(cart?.items || []).flatMap((item) => (
        item.line_level_discount_allocations || []
      ).map((allocation) => allocation.discount_application || allocation)),
    ];
    applications.forEach((application) => {
      const type = String(application.type || '').toLowerCase();
      if (type === 'discount_code' || type === 'code') discountCodes.push(application.title);
    });
    return mergeDiscountCodes(discountCodes);
  };

  const isDiscountApplied = (cart, code) => {
    const normalizedCode = String(code || '').trim().toLowerCase();
    const matchingCode = (cart.discount_codes || cart.discountCodes || [])
      .find((discount) => String(discount.code || '').trim().toLowerCase() === normalizedCode);
    if (matchingCode?.applicable === true) return true;
    if (matchingCode?.applicable === false) return false;

    return [
      ...(cart.discount_applications || []),
      ...(cart.cart_level_discount_applications || []),
      ...(cart.items || []).flatMap((item) => (
        item.line_level_discount_allocations || []
      ).map((allocation) => allocation.discount_application || allocation)),
    ].some((application) => {
      const type = String(application.type || '').toLowerCase();
      return String(application.title || '').trim().toLowerCase() === normalizedCode
        && (!type || type === 'discount_code' || type === 'code');
    });
  };

  const updateDiscountCodes = async (codes) => {
    const response = await fetch(endpoint(state.drawer.dataset.cartUpdateUrl), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({ discount: codes.join(',') }),
    });
    const cart = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(cart.description || cart.message || state.drawer.dataset.cartDiscountError || 'Unable to update discount codes.');
    return cart;
  };

  const renderDiscountCodes = (cart) => {
    const list = state.drawer?.querySelector('[data-cart-drawer-discounts]');
    if (!list) return;
    const codes = getStoredDiscountCodes(cart);
    const discountIcon = state.drawer?.dataset.discountIcon || '';
    list.innerHTML = codes.map((code) => `<li><span class="cart-drawer__discount-code">${discountIcon}<span>${escapeHtml(code)}</span></span><button class="cart-drawer__discount-remove body-text body-xs link-underline" type="button" data-cart-drawer-discount-remove data-discount-code="${escapeHtml(code)}" aria-label="Remove ${escapeHtml(code)}">Remove</button></li>`).join('');
    list.hidden = codes.length === 0;
  };

  const updateCartUI = async (cart, { awaitRecommendations = true } = {}) => {
    if (!state.drawer || !cart?.items) return;
    const drawer = state.drawer;
    const revision = ++state.cartRevision;
    await hydrateVariantComparePrices(cart);
    if (state.drawer !== drawer || state.cartRevision !== revision) return;
    state.cart = cart;
    const currency = cart.currency || state.drawer.dataset.currency || 'USD';
    const items = state.drawer.querySelector('[data-cart-drawer-items]');
    const empty = state.drawer.querySelector('[data-cart-drawer-empty]');
    const footer = state.drawer.querySelector('[data-cart-drawer-footer]');
    const promotion = state.drawer.querySelector('[data-cart-drawer-promotion]');
    const subtotal = state.drawer.querySelector('[data-cart-drawer-subtotal]');
    const total = state.drawer.querySelector('[data-cart-drawer-total]');
    const savings = state.drawer.querySelector('[data-cart-drawer-savings]');
    const savingsValue = state.drawer.querySelector('[data-cart-drawer-savings-value]');
    const originalTotalElement = state.drawer.querySelector('[data-cart-drawer-original-total]');
    const discountCountElement = state.drawer.querySelector('[data-cart-drawer-discount-count]');
    const hasItems = Number(cart.item_count || 0) > 0;
    const computedOriginalTotal = cart.items.reduce((sum, item) => (
      sum + (originalUnitPrice(item) * Math.max(0, Number(item.quantity || 0)))
    ), 0);
    const originalTotal = Math.max(Number(cart.original_total_price || 0), computedOriginalTotal);
    const cartSavings = Math.max(0, originalTotal - Number(cart.total_price || 0));
    const discountCount = getAppliedDiscountCount(cart);

    if (items) {
      const currentLines = new Map(Array.from(items.querySelectorAll('[data-cart-line]'))
        .map((line) => [line.dataset.lineKey, line]));
      const nextKeys = new Set(cart.items.map((item) => String(item.key)));
      currentLines.forEach((line, key) => {
        if (!nextKeys.has(key)) line.remove();
      });
      cart.items.forEach((item, index) => {
        const template = document.createElement('template');
        template.innerHTML = renderCartLine(item, index + 1, currency).trim();
        const nextLine = template.content.firstElementChild;
        const currentLine = currentLines.get(String(item.key));
        if (currentLine) currentLine.replaceWith(nextLine);
        else items.append(nextLine);
      });
      items.hidden = !hasItems;
    }

    if (empty) empty.hidden = hasItems;
    if (footer) footer.hidden = !hasItems;
    if (promotion) promotion.hidden = !hasItems;
    if (subtotal) subtotal.textContent = formatMoneyWithCurrency(cart.items_subtotal_price ?? cart.total_price, currency);
    if (total) total.textContent = formatMoneyWithCurrency(cart.total_price, currency);
    if (savings) savings.hidden = cartSavings === 0;
    if (savingsValue) savingsValue.textContent = formatMoneyWithCurrency(cartSavings, currency);
    if (originalTotalElement) originalTotalElement.textContent = formatMoneyWithCurrency(originalTotal, currency);
    if (discountCountElement) {
      discountCountElement.textContent = String(discountCount);
      discountCountElement.hidden = discountCount === 0;
    }
    renderDiscountCodes(cart);

    updateHeaderCount(cart);
    updateShippingProgress(cart);
    const recommendationsPromise = loadRecommendations(cart);
    if (!awaitRecommendations) recommendationsPromise.catch(() => {});
    else await recommendationsPromise;
    if (state.drawer !== drawer || state.cartRevision !== revision) return;
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart, source: 'cart-drawer' } }));
  };

  const setMessage = (message = '', isError = false) => {
    const element = state.drawer?.querySelector('[data-cart-drawer-message]');
    if (!element) return;
    element.textContent = message;
    element.dataset.error = String(isError);
    element.hidden = !message;
  };

  const hideRecommendations = () => {
    const recommendations = state.drawer?.querySelector('[data-cart-drawer-recommendations]');
    if (recommendations) recommendations.hidden = true;
    state.recommendationProductId = null;
  };

  const renderRecommendations = (products, currency) => {
    const drawer = state.drawer;
    const recommendations = drawer?.querySelector('[data-cart-drawer-recommendations]');
    const list = drawer?.querySelector('[data-cart-drawer-recommendation-list]');
    if (!recommendations || !list) return;
    const recommendationIcon = drawer.dataset.recommendationIcon || '';
    const wrapper = list.querySelector(':scope > .swiper-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = products.map((product) => {
      const variantId = product.variants?.[0]?.id || '';
      const image = product.featured_image || product.images?.[0] || '';
      const imageMarkup = image
        ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" loading="lazy">`
        : '';
      return `<div class="swiper-slide">
        <article class="cart-drawer__recommendation">
          <a class="cart-drawer__recommendation-media" href="${escapeHtml(product.url)}" aria-label="${escapeHtml(product.title)}">${imageMarkup}</a>
          <div class="cart-drawer__recommendation-info">
            <a class="cart-drawer__recommendation-title card-title-text" href="${escapeHtml(product.url)}">${escapeHtml(product.title)}</a>
            <span class="cart-drawer__recommendation-price card-price-text body-sm">${formatMoney(product.price, currency)}</span>
          </div>
          <button class="icon-button cart-drawer__recommendation-add" type="button" data-cart-related-add data-variant-id="${escapeHtml(variantId)}" aria-label="Add ${escapeHtml(product.title)} to cart">${recommendationIcon}</button>
        </article>
      </div>`;
    }).join('');

    recommendations.hidden = false;
  };

  const loadRecommendations = async (cart) => {
    const drawer = state.drawer;
    if (!drawer || drawer.dataset.recommendationsEnabled !== 'true' || !cart?.items?.length) {
      hideRecommendations();
      return;
    }

    const productId = cart.items[0]?.product_id;
    if (!productId) {
      hideRecommendations();
      return;
    }

    const recommendations = drawer.querySelector('[data-cart-drawer-recommendations]');
    if (state.recommendationProductId === productId && recommendations && !recommendations.hidden) return;

    const limit = Math.min(8, Math.max(2, Number(drawer.dataset.recommendationsLimit || 4)));
    try {
      const response = await fetch(`/recommendations/products.json?product_id=${encodeURIComponent(productId)}&limit=${limit}&intent=related`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Recommendations unavailable');
      const data = await response.json();
      if (state.drawer !== drawer || state.cart !== cart) return;
      const products = (data.products || []).filter((product) => !cart.items.some((item) => item.product_id === product.id));
      if (!products.length) {
        hideRecommendations();
        return;
      }
      renderRecommendations(products.slice(0, limit), cart.currency || 'USD');
      state.recommendationProductId = productId;
    } catch (error) {
      if (state.drawer === drawer && state.cart === cart) hideRecommendations();
    }
  };

  const fetchCart = async () => {
    const cartUrl = state.drawer?.dataset.cartUrl || '/cart';
    const response = await fetch(`${endpoint(cartUrl)}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) throw new Error('Cart unavailable');
    return response.json();
  };

  const syncMutation = async (payload, options) => {
    const drawer = state.drawer;
    const cart = payload?.items && Number.isFinite(payload?.item_count) ? payload : await fetchCart();
    if (state.drawer !== drawer) return;
    await updateCartUI(cart, options);
  };

  const refresh = async () => {
    const drawer = state.drawer;
    if (!drawer || state.request) return;
    const revision = state.cartRevision;

    const cart = await fetchCart();
    if (state.drawer !== drawer || state.request || state.cartRevision !== revision) return;
    await updateCartUI(cart);
  };

  const findQuantityInput = (lineKey) => Array.from(state.drawer?.querySelectorAll('[data-cart-quantity-input]') || [])
    .find((input) => input.dataset.lineKey === lineKey);

  const setLineLoading = (lineKey, isLoading) => {
    const line = Array.from(state.drawer?.querySelectorAll('[data-cart-line]') || [])
      .find((item) => item.dataset.lineKey === lineKey);
    if (!line) return;
    line.classList.toggle('is-updating', isLoading);
    line.setAttribute('aria-busy', String(isLoading));
    line.querySelectorAll('[data-cart-remove], [data-cart-quantity-action], [data-cart-quantity-input]').forEach((control) => {
      control.disabled = isLoading;
    });
  };

  const updateLine = async (lineKey, quantity, lineIndex) => {
    if (!state.drawer || (!lineKey && !lineIndex) || state.request) return;
    const nextQuantity = Math.max(0, Number.parseInt(quantity, 10) || 0);
    const fallbackError = state.drawer.dataset.cartUpdateError || 'Unable to update your cart';
    const input = findQuantityInput(lineKey);
    const previousQuantity = Number.parseInt(input?.value, 10) || 0;
    if (input) input.value = nextQuantity;
    setLineLoading(lineKey, true);
    setError();
    state.request = fetch(endpoint(state.drawer.dataset.cartChangeUrl), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        ...(lineIndex ? { line: Number(lineIndex) } : { id: lineKey }),
        quantity: nextQuantity,
      }),
    });

    try {
      const response = await state.request;
      if (!response.ok) throw new Error((await parseError(response)) || fallbackError);
      await syncMutation(await response.json());
    } catch (error) {
      if (input?.isConnected) input.value = previousQuantity;
      setError(error.message || fallbackError);
    } finally {
      setLineLoading(lineKey, false);
      state.request = null;
    }
  };

  const addFormToCart = async (form, submitter) => {
    if (!state.drawer || state.request) return;
    if (form.dataset.variantAvailable === 'false' || submitter?.disabled) return;
    const formData = new FormData(form);
    if (!formData.get('id')) return;
    const drawer = state.drawer;
    const opener = submitter || document.activeElement;
    const buttons = Array.from(form.querySelectorAll('[type="submit"]'));
    const disabledStates = buttons.map((button) => button.disabled);
    const loadingDots = buttons.map((button) => button.querySelector('[data-loading-dots]'));
    let formError = form.querySelector('[data-cart-add-error]');
    if (formError) formError.hidden = true;
    const fallbackError = state.drawer.dataset.cartAddError || 'Unable to add this item';

    form.setAttribute('aria-busy', 'true');
    buttons.forEach((button, index) => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const dots = loadingDots[index];
      if (dots) {
        dots.hidden = false;
        dots.classList.remove('hidden');
        button.dataset.quickAddLoading = 'true';
      }
    });
    setLoading(true);
    setError();
    state.cartRevision += 1;
    state.request = fetch(endpoint(state.drawer.dataset.cartAddUrl), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    try {
      const response = await state.request;
      if (!response.ok) throw new Error((await parseError(response)) || fallbackError);
      const payload = await response.json();
      if (state.drawer !== drawer) return;
      await syncMutation(payload, { awaitRecommendations: false });
      if (state.drawer !== drawer) return;
      // Overlay owners close only after the cart DOM is ready and provide an
      // external opener so closing the drawer never focuses a hidden modal.
      const detail = { form, opener };
      document.dispatchEvent(new CustomEvent('cart:add:ready', { detail }));
      state.opener = detail.opener;
      setLoading(false);
      open({ refreshCart: false });
    } catch (error) {
      if (state.drawer === drawer) setError(error.message || fallbackError);
      if (form.isConnected) {
        if (!formError) {
          formError = document.createElement('p');
          formError.setAttribute('data-cart-add-error', '');
          formError.setAttribute('role', 'alert');
          form.append(formError);
        }
        formError.textContent = error.message || fallbackError;
        formError.hidden = false;
      }
    } finally {
      state.request = null;
      form.removeAttribute('aria-busy');
      buttons.forEach((button, index) => {
        button.disabled = button.dataset.variantAvailable != null
          ? button.dataset.variantAvailable !== 'true' : disabledStates[index];
        button.removeAttribute('aria-busy');
        delete button.dataset.quickAddLoading;
        const dots = loadingDots[index];
        if (dots) {
          dots.hidden = true;
          dots.classList.add('hidden');
        }
      });
      if (state.drawer === drawer) setLoading(false);
    }
  };

  const addRecommendation = async (button) => {
    if (!state.drawer || state.request || !button?.dataset.variantId) return;
    const formData = new FormData();
    formData.set('id', button.dataset.variantId);
    formData.set('quantity', '1');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const fallbackError = state.drawer.dataset.cartAddError || 'Unable to add this item';
    setLoading(true);
    setError();
    setMessage();
    state.request = fetch(endpoint(state.drawer.dataset.cartAddUrl), {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    try {
      const response = await state.request;
      if (!response.ok) throw new Error((await parseError(response)) || fallbackError);
      await syncMutation(await response.json());
    } catch (error) {
      setError(error.message || fallbackError);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    } finally {
      state.request = null;
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!state.drawer || state.request) return;
    const note = state.drawer.querySelector('[data-cart-drawer-note]')?.value || '';
    const fallbackError = state.drawer.dataset.cartNoteError || 'Unable to save order note.';
    setLoading(true);
    setError();
    setMessage();
    state.request = fetch(endpoint(state.drawer.dataset.cartUpdateUrl), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });

    try {
      const response = await state.request;
      if (!response.ok) throw new Error((await parseError(response)) || fallbackError);
      setMessage(state.drawer.dataset.cartNoteSaved || 'Order note saved.');
    } catch (error) {
      setMessage(error.message || fallbackError, true);
    } finally {
      state.request = null;
      setLoading(false);
    }
  };

  const applyDiscount = async (form) => {
    if (!state.drawer || state.request) return;
    const input = form.querySelector('input[name="discount"]');
    const code = input?.value.trim();
    if (!code) return;
    const fallbackError = state.drawer.dataset.cartDiscountError || 'Unable to apply discount code.';
    setLoading(true);
    setError();
    setMessage();

    try {
      const currentCart = state.cart?.items ? state.cart : await fetchCart();
      const previousCodes = getStoredDiscountCodes(currentCart);
      const requestedCodes = mergeDiscountCodes(previousCodes, [code]);
      state.request = updateDiscountCodes(requestedCodes);
      const cart = await state.request;
      if (!isDiscountApplied(cart, code)) {
        let restoredCart = cart;
        try {
          restoredCart = await updateDiscountCodes(previousCodes);
        } catch (rollbackError) {
          restoredCart = await fetchCart();
        }
        await updateCartUI(restoredCart);
        throw new Error(fallbackError);
      }
      await updateCartUI(cart);
      input.value = '';
      setMessage(state.drawer.dataset.cartDiscountApplied || 'Discount code applied.');
    } catch (error) {
      setMessage(error.message || fallbackError, true);
    } finally {
      state.request = null;
      setLoading(false);
    }
  };

  const removeDiscount = async (code) => {
    if (!state.drawer || state.request || !code) return;
    const fallbackError = state.drawer.dataset.cartDiscountError || 'Unable to remove discount code.';
    setLoading(true);
    setError();
    setMessage();
    try {
      const currentCart = state.cart?.items ? state.cart : await fetchCart();
      const normalizedCode = String(code).trim().toLowerCase();
      const nextCodes = getStoredDiscountCodes(currentCart)
        .filter((currentCode) => currentCode.toLowerCase() !== normalizedCode);
      state.request = updateDiscountCodes(nextCodes);
      await updateCartUI(await state.request);
    } catch (error) {
      setMessage(error.message || fallbackError, true);
    } finally {
      state.request = null;
      setLoading(false);
    }
  };

  const applyPromotionCode = () => {
    const drawer = state.drawer;
    if (!drawer) return;
    const form = drawer.querySelector('[data-cart-drawer-discount]');
    const input = form?.querySelector('input[name="discount"]');
    const code = drawer.dataset.promotionCode;
    if (!form || !input || !code) return;
    input.value = code;
    applyDiscount(form);
  };

  const setOrderOptionsOpen = (name = '') => {
    const drawer = state.drawer;
    const panel = drawer?.querySelector('[data-cart-drawer-order-options]');
    if (!drawer || !panel) return;
    const isOpen = Boolean(name);
    const previousTrigger = drawer.querySelector('[data-cart-drawer-order-options-open][aria-expanded="true"]');
    if (!isOpen && panel.contains(document.activeElement)) previousTrigger?.focus({ preventScroll: true });
    panel.inert = !isOpen;
    drawer.classList.toggle('is-order-options-open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    drawer.querySelectorAll('[data-cart-drawer-order-options-open]').forEach((trigger) => {
      trigger.setAttribute('aria-expanded', String(isOpen && trigger.dataset.cartDrawerOrderOptionsOpen === name));
    });
    if (!isOpen) return;
    state.orderOptionsDrag?.reset();
    drawer.querySelectorAll('[data-cart-drawer-order-options-content]').forEach((content) => {
      content.hidden = content.dataset.cartDrawerOrderOptionsContent !== name;
    });
    const trigger = drawer.querySelector(`[data-cart-drawer-order-options-open="${name}"]`);
    const title = panel.querySelector('[data-cart-drawer-order-options-title]');
    if (title) title.textContent = trigger?.dataset.cartDrawerOrderOptionsTitle || 'Cart options';
    window.requestAnimationFrame(() => panel.querySelector(`[data-cart-drawer-order-options-content="${name}"] input, [data-cart-drawer-order-options-content="${name}"] textarea, [data-cart-drawer-order-options-content="${name}"] select`)?.focus({ preventScroll: true }));
  };

  const beginOrderOptionsDrag = (event) => {
    const panel = event.target.closest?.('[data-cart-drawer-order-options]');
    const header = panel?.querySelector('[data-cart-drawer-order-options-sheet-header]');
    const backdrop = panel?.closest?.('[data-cart-drawer]')?.querySelector('[data-cart-drawer-order-options-backdrop]');
    if (!panel || !window.ThemeOverlay.mobile.matches) return;
    state.orderOptionsDrag?.destroy();
    state.orderOptionsDrag = new window.ThemeOverlay.SheetGesture({
      panel, header, backdrop, delegated: true,
      enabled: () => state.drawer?.classList.contains('is-order-options-open') && window.ThemeOverlay.mobile.matches,
      close: () => setOrderOptionsOpen(),
    });
    state.orderOptionsDrag.start(event);
  };

  const estimateShipping = async (form) => {
    if (!state.drawer || state.request) return;
    const country = form.querySelector('[name="country"]')?.value || '';
    const zip = form.querySelector('[name="zip"]')?.value.trim() || '';
    const output = state.drawer.querySelector('[data-cart-drawer-shipping-rates]');
    if (!country || !zip || !output) return;
    output.textContent = state.drawer.dataset.cartShippingCalculating || 'Calculating shipping…';
    output.removeAttribute('data-error');
    const query = new URLSearchParams({ 'shipping_address[country]': country, 'shipping_address[zip]': zip });
    const localeRoot = window.Shopify?.routes?.root || '/';
    const cartRoot = `${localeRoot.endsWith('/') ? localeRoot : `${localeRoot}/`}cart/`;
    const unavailableMessage = state.drawer.dataset.cartShippingUnavailable || 'Shipping rates unavailable.';
    setLoading(true);
    try {
      const prepare = await fetch(`${cartRoot}prepare_shipping_rates.json?${query.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!prepare.ok) throw new Error(unavailableMessage);

      let data = null;
      for (let attempt = 0; attempt < 8 && data == null; attempt += 1) {
        if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 500));
        const response = await fetch(`${cartRoot}async_shipping_rates.json?${query.toString()}`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(unavailableMessage);
        data = await response.json();
      }
      if (data == null) throw new Error(unavailableMessage);
      const rates = data.shipping_rates || data.rates || [];
      if (!rates.length) throw new Error(state.drawer.dataset.cartShippingNoRates || 'No shipping rates found.');
      output.innerHTML = rates.map((rate) => `<p>${escapeHtml(rate.presentment_name || rate.name)}: ${formatMoney(Math.round(Number(rate.price || 0) * 100), state.drawer.dataset.currency || 'USD')}</p>`).join('');
    } catch (error) {
      output.textContent = error.message || state.drawer.dataset.cartShippingUnavailable || 'Shipping rates unavailable.';
      output.dataset.error = 'true';
    } finally {
      setLoading(false);
    }
  };

  const open = ({ refreshCart = true } = {}) => {
    const drawer = state.drawer;
    if (!drawer) return;
    const shouldOpen = !state.overlay?.isOpen();
    if (!shouldOpen) return;
    const opener = state.editorSelected ? null : (state.opener || document.activeElement);
    drawer.classList.remove('is-closing');
    drawer.classList.add('is-open');
    state.overlay?.open({ opener, focus: !state.editorSelected, restoreFocus: !state.editorSelected });
    document.dispatchEvent(new CustomEvent('cart-drawer:open', { detail: { drawer } }));
    if (refreshCart) refresh().catch(() => {});
  };

  const close = ({ force = false } = {}) => {
    const drawer = state.drawer;
    if (!drawer || (state.editorSelected && !force)) return;
    setOrderOptionsOpen();
    if (!state.overlay?.isOpen()) return;
    drawer.classList.remove('is-open');
    drawer.classList.add('is-closing');
    state.overlay.close({ restoreFocus: !state.editorSelected });
  };

  const initialize = (nextDrawer) => {
    if (!nextDrawer || nextDrawer.dataset.cartDrawerReady === 'true') return;
    if (state.drawer && state.drawer !== nextDrawer) close({ force: true });
    state.drawer = nextDrawer;
    state.sectionRoot = nextDrawer.closest('.shopify-section') || nextDrawer;
    state.overlay = window.ThemeOverlay?.get(nextDrawer) || null;
    nextDrawer.dataset.cartDrawerReady = 'true';
    seedVariantComparePrices();

    nextDrawer.addEventListener('close', () => {
      nextDrawer.classList.remove('is-open', 'is-closing');
      document.querySelectorAll('[data-cart-drawer-open]').forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
      document.dispatchEvent(new CustomEvent('cart-drawer:close', { detail: { drawer: nextDrawer } }));
      state.opener = null;
    });

    nextDrawer.querySelector('[data-cart-drawer-order-options]')?.addEventListener('pointerdown', beginOrderOptionsDrag);

    nextDrawer.addEventListener('click', (event) => {
      const orderOptionsTrigger = event.target.closest('[data-cart-drawer-order-options-open]');
      if (orderOptionsTrigger) {
        event.preventDefault();
        setOrderOptionsOpen(orderOptionsTrigger.dataset.cartDrawerOrderOptionsOpen);
        return;
      }

      if (event.target.closest('[data-cart-drawer-order-options-close]')) {
        event.preventDefault();
        setOrderOptionsOpen();
        return;
      }

      if (event.target.closest('[data-cart-drawer-promotion-apply]')) {
        event.preventDefault();
        applyPromotionCode();
        return;
      }

      const discountRemove = event.target.closest('[data-cart-drawer-discount-remove]');
      if (discountRemove) {
        event.preventDefault();
        removeDiscount(discountRemove.dataset.discountCode);
        return;
      }

      const relatedAdd = event.target.closest('[data-cart-related-add]');
      if (relatedAdd) {
        event.preventDefault();
        addRecommendation(relatedAdd);
        return;
      }

      if (event.target.closest('[data-cart-drawer-save-note]')) {
        event.preventDefault();
        saveNote();
        return;
      }

      const removeButton = event.target.closest('[data-cart-remove]');
      if (removeButton) {
        event.preventDefault();
        updateLine(removeButton.dataset.lineKey, 0, removeButton.dataset.lineIndex);
        return;
      }

      const quantityButton = event.target.closest('[data-cart-quantity-action]');
      if (quantityButton) {
        event.preventDefault();
        const input = findQuantityInput(quantityButton.dataset.lineKey);
        if (!input) return;
        const delta = quantityButton.dataset.cartQuantityAction === 'increase' ? 1 : -1;
        const nextQuantity = Math.max(0, Number.parseInt(input.value, 10) + delta);
        updateLine(quantityButton.dataset.lineKey, nextQuantity, quantityButton.dataset.lineIndex);
      }
    });

    nextDrawer.addEventListener('change', (event) => {
      const input = event.target.closest('[data-cart-quantity-input]');
      if (input) updateLine(input.dataset.lineKey, input.value, input.dataset.lineIndex);
    });

    nextDrawer.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-cart-drawer-discount]');
      if (form) {
        event.preventDefault();
        applyDiscount(form);
        return;
      }
      const shippingForm = event.target.closest('[data-cart-drawer-shipping-estimator]');
      if (shippingForm) {
        event.preventDefault();
        estimateShipping(shippingForm);
      }
    });

    if (state.editorSelected) open();
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-cart-drawer-open]');
    if (!trigger) return;
    initialize(getDrawer());
    if (!state.drawer) return;
    event.preventDefault();
    state.opener = trigger;
    open();
  });

  document.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    const form = event.target.closest?.('form[action*="/cart/add"]');
    if (!form || !state.drawer) return;
    event.preventDefault();
    addFormToCart(form, event.submitter);
  });

  document.addEventListener('keydown', (event) => {
    const drawer = state.drawer;
    if (!drawer || drawer.hidden || !drawer.classList.contains('is-open') || event.key !== 'Escape') return;
    if (!drawer.classList.contains('is-order-options-open')) return;
    event.preventDefault();
    event.stopPropagation();
    setOrderOptionsOpen();
  }, true);

  document.addEventListener('shopify:section:load', (event) => {
    const nextDrawer = getDrawer(event.target);
    if (nextDrawer) initialize(nextDrawer);
  });

  document.addEventListener('shopify:section:unload', (event) => {
    if (!state.drawer) return;
    const target = event.target;
    if (target === state.sectionRoot || target?.contains?.(state.drawer)) {
      close({ force: true });
      state.orderOptionsDrag?.destroy();
      state.orderOptionsDrag = null;
      state.overlay?.destroy();
      state.drawer = null;
      state.sectionRoot = null;
      state.overlay = null;
      state.opener = null;
      state.editorSelected = false;
    }
  });

  const isDrawerEvent = (event) => {
    const target = event.target;
    return state.drawer && (target === state.sectionRoot || target === state.drawer || target?.contains?.(state.drawer) || state.drawer.contains(target));
  };

  document.addEventListener('shopify:section:select', (event) => {
    const nextDrawer = getDrawer(event.target);
    if (nextDrawer) initialize(nextDrawer);
    if (!isDrawerEvent(event)) return;
    state.editorSelected = true;
    open();
  });

  document.addEventListener('shopify:section:deselect', (event) => {
    if (!isDrawerEvent(event)) return;
    state.editorSelected = false;
    close({ force: true });
  });

  // Shared cart transport for surfaces such as /cart. Liquid section rendering
  // remains responsible for the page markup; this keeps drawer and badge state in sync.
  const mutate = async (operation, payload) => {
    const root = window.Shopify?.routes?.root || '/';
    const response = await fetch(`${root}cart/${operation}.js`, {
      method: 'POST', credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description || data.message || 'Unable to update your cart.');
    const cart = data.items && Number.isFinite(data.item_count) ? data : await fetchCart();
    if (state.drawer) await updateCartUI(cart);
    else updateHeaderCount(cart);
    return cart;
  };
  window[controllerKey] = {
    initialize: (root) => initialize(getDrawer(root)),
    mutate, getStoredDiscountCodes, mergeDiscountCodes, isDiscountApplied,
  };
  initialize(getDrawer());
})();
