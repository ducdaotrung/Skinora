(() => {
  if (window.__cartPageController) return;
  let busy = false;
  let refreshRevision = 0;
  const rootPath = () => window.Shopify?.routes?.root || '/';
  const service = () => window.__cartDrawerController;
  const page = () => document.querySelector('[data-cart-page]');
  const getCart = async () => {
    const response = await fetch(`${rootPath()}cart.js`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(page()?.dataset.updateError);
    return response.json();
  };
  const message = (text, error = false) => {
    const output = page()?.querySelector('[data-cart-page-message]');
    if (!output) return;
    output.textContent = text;
    output.hidden = !text;
    output.setAttribute('role', error ? 'alert' : 'status');
  };
  const refresh = async () => {
    const current = page();
    if (!current) return;
    const revision = ++refreshRevision;
    const url = new URL(window.location.href);
    url.searchParams.set('section_id', current.dataset.sectionId);
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(current.dataset.updateError);
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (revision !== refreshRevision || current !== page()) return;
    const next = html.querySelector('[data-cart-page]');
    if (!next) throw new Error(current.dataset.updateError);
    const openTools = Array.from(current.querySelectorAll('details[open]')).map(el => el.querySelector('summary')?.textContent.trim());
    const focused = document.activeElement?.id;
    current.querySelectorAll('[data-cart-page-edit]').forEach(form => window.ThemeOverlay?.get(form.closest('[data-component-overlay]'))?.destroy());
    window.__themeAccordionDetailsController?.cleanupRoot(current);
    current.replaceWith(next);
    next.querySelectorAll('details').forEach(el => {
      if (openTools.includes(el.querySelector('summary')?.textContent.trim())) {
        el.open = true;
        if (el.hasAttribute('data-accordion-details')) el.dataset.accordionState = 'open';
      }
    });
    window.__themeAccordionDetailsController?.initializeRoot(next);
    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  };
  const perform = async (action, rerender = true) => {
    if (busy || !page()) return;
    busy = true;
    refreshRevision += 1;
    page().setAttribute('aria-busy', 'true');
    message('');
    try {
      await action();
      if (rerender) await refresh();
    } catch (error) {
      page()?.querySelectorAll?.('[data-cart-page-quantity]').forEach(input => { input.value = input.dataset.currentQuantity; });
      message(error.message || page()?.dataset.updateError, true);
      const editError = page()?.querySelector('[data-component-overlay][data-state="open"] [data-cart-page-edit-error]');
      if (editError) { editError.textContent = error.message; editError.hidden = false; }
    } finally {
      busy = false;
      page()?.removeAttribute('aria-busy');
    }
  };
  const changeQuantity = (line, quantity) => {
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed < 0) return;
    perform(() => service().mutate('change', { id: line.dataset.lineKey, quantity: parsed }));
  };
  document.addEventListener('click', event => {
    const editTrigger = event.target.closest('[data-cart-page-edit-open]');
    if (editTrigger?.closest('[data-cart-page]')) {
      window.ThemeOverlay?.get(document.getElementById(editTrigger.dataset.cartPageEditOpen))?.open({ opener: editTrigger });
      return;
    }
    const target = event.target.closest('[data-cart-page-step], [data-cart-page-remove], [data-cart-page-discount-remove]');
    if (!target?.closest('[data-cart-page]')) return;
    event.preventDefault();
    if (busy) return;
    const line = target.closest('[data-cart-page-line]');
    if (target.hasAttribute('data-cart-page-remove')) changeQuantity(line, 0);
    else if (target.hasAttribute('data-cart-page-step')) changeQuantity(line, Number(line.querySelector('[data-cart-page-quantity]').value) + Number(target.dataset.cartPageStep));
    else perform(async () => {
      const cart = await getCart();
      const codes = service().getStoredDiscountCodes(cart).filter(code => code.toLowerCase() !== target.dataset.cartPageDiscountRemove.toLowerCase());
      await service().mutate('update', { discount: codes.join(',') });
    });
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-cart-page-quantity]')) changeQuantity(event.target.closest('[data-cart-page-line]'), event.target.value);
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form.matches('[data-cart-page-discount], [data-cart-page-note], [data-cart-page-shipping], [data-cart-page-edit]')) return;
    event.preventDefault();
    if (busy) return;
    const data = new FormData(form);
    if (form.hasAttribute('data-cart-page-note')) {
      perform(async () => {
        await service().mutate('update', { note: data.get('note') });
        message(page().dataset.noteSaved);
      }, false);
    } else if (form.hasAttribute('data-cart-page-discount')) {
      perform(async () => {
        const oldCart = await getCart();
        const oldCodes = service().getStoredDiscountCodes(oldCart);
        const code = String(data.get('discount') || '').trim();
        const cart = await service().mutate('update', { discount: service().mergeDiscountCodes(oldCodes, [code]).join(',') });
        if (!service().isDiscountApplied(cart, code)) {
          await service().mutate('update', { discount: oldCodes.join(',') });
          throw new Error(page().dataset.discountError);
        }
      });
    } else if (form.hasAttribute('data-cart-page-edit')) {
      perform(async () => {
        const cart = await getCart();
        const original = cart.items.find(item => item.key === form.dataset.lineKey);
        if (!original) return;
        const quantity = Math.max(1, Number(data.get('quantity') || original.quantity));
        if (String(original.variant_id) === String(data.get('id'))) {
          await service().mutate('change', { id: original.key, quantity });
          return;
        }
        // Add first; an unavailable replacement leaves the original line intact.
        const propertiesKey = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
        const isReplacement = item => String(item.variant_id) === String(data.get('id'))
          && propertiesKey(item.properties) === propertiesKey(original.properties)
          && item.selling_plan_allocation?.selling_plan?.id === original.selling_plan_allocation?.selling_plan?.id;
        const previousReplacement = cart.items.find(isReplacement);
        const addedCart = await service().mutate('add', { items: [{ id: Number(data.get('id')), quantity, properties: original.properties || {}, ...(original.selling_plan_allocation ? { selling_plan: original.selling_plan_allocation.selling_plan.id } : {}) }] });
        try {
          await service().mutate('change', { id: original.key, quantity: 0 });
        } catch (error) {
          const addedLine = addedCart.items.find(isReplacement);
          if (addedLine) await service().mutate('change', { id: addedLine.key, quantity: previousReplacement?.quantity || 0 });
          throw error;
        }
      });
    } else {
      perform(async () => {
        const query = new URLSearchParams();
        ['country', 'province', 'zip'].forEach(key => query.set(`shipping_address[${key}]`, data.get(key) || ''));
        const response = await fetch(`${rootPath()}cart/shipping_rates.json?${query}`, { headers: { Accept: 'application/json' } });
        const result = await response.json();
        if (!response.ok) throw new Error(page().dataset.shippingError);
        const output = form.querySelector('[data-cart-page-rates]');
        output.textContent = result.shipping_rates?.length ? result.shipping_rates.map(rate => `${rate.name}: ${rate.price} ${rate.currency || ''}`).join('\n') : page().dataset.noRates;
      }, false);
    }
  });
  document.addEventListener('cart:updated', event => {
    if (!busy && page() && event.detail?.source === 'cart-drawer') refresh().catch(error => message(error.message, true));
  });
  window.__cartPageController = { refresh };
})();
