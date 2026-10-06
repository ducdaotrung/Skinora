/*
 * Load below-the-fold Theme Block modules when their script marker approaches
 * the viewport. Imports are cached by the browser; repeated markers
 * for the same carousel runtime resolve to one module evaluation.
 */
(() => {
  const loaderKey = Symbol.for('theme.moduleLoader');
  if (window[loaderKey]) return;
  window[loaderKey] = true;

  const selector = 'script[data-theme-module]';
  const modules = new Map();
  const observedTargets = new WeakSet();
  const scheduledTargets = new WeakMap();
  const markerInitializations = new WeakMap();
  const pendingSelections = new WeakMap();
  const replayedSelections = new WeakSet();
  let latestSelection = null;

  const moduleURL = (script) => {
    const source = script.dataset.themeModule?.trim();
    if (!source) throw new TypeError('Missing data-theme-module URL');
    // Resolve Liquid's protocol-relative CDN URLs and relative URLs before
    // importing. Preserve asset version queries and share fragment aliases.
    const url = new URL(source, document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !/\.(?:js|mjs)$/i.test(url.pathname)) {
      throw new TypeError(`Invalid theme module URL: ${source}`);
    }
    url.hash = '';
    return url.href;
  };

  const setState = (script, state, error) => {
    script.dataset.themeModuleState = state;
    if (error) script.dataset.themeModuleError = String(error.message || error);
    else delete script.dataset.themeModuleError;
  };

  const reportError = (src, error) => {
    console.error('[Theme modules] Failed to load', src, error);
    document.dispatchEvent(new CustomEvent('theme:module:error', { detail: { url: src, error } }));
  };

  const load = (script) => {
    if (!script?.isConnected) return Promise.resolve();
    let src;
    try {
      src = moduleURL(script);
    } catch (error) {
      setState(script, 'error', error);
      reportError(script.dataset.themeModule, error);
      return Promise.resolve();
    }

    const existing = modules.get(src);
    if (existing) {
      return initializeMarker(script, existing.promise, src);
    }

    const record = { state: 'loading', promise: null };
    // Store before importing so intersection, mutation and editor callbacks
    // share one attempt. A failed attempt may be retried by a later render.
    modules.set(src, record);
    record.promise = import(src).then((module) => {
      record.state = 'loaded';
      return module;
    }, (error) => {
      modules.delete(src);
      reportError(src, error);
      throw error;
    });
    return initializeMarker(script, record.promise, src);
  };

  // Module evaluation happens once; inserted storefront/editor markup still
  // needs initialization after that evaluation, even when the import is cached.
  const initializeMarker = (script, promise, src) => {
    const root = script.closest('.shopify-section') || script.parentElement;
    const existing = markerInitializations.get(script);
    if (existing?.src === src && existing.root === root) return existing.promise;
    setState(script, 'loading');
    const attempt = { src, root, promise: null };
    markerInitializations.set(script, attempt);
    const isCurrent = () => script.isConnected && markerInitializations.get(script) === attempt;
    attempt.promise = promise.then(async (module) => {
      if (!isCurrent()) return;
      try {
        await module?.initializeThemeModule?.(root);
        if (isCurrent()) setState(script, 'loaded');
      } catch (error) {
        if (!isCurrent()) return;
        markerInitializations.delete(script);
        setState(script, 'error', error);
        reportError(src, error);
      }
    }, (error) => {
      if (!isCurrent()) return;
      markerInitializations.delete(script);
      setState(script, 'error', error);
    });
    return attempt.promise;
  };

  const markersWithin = (root) => {
    const scripts = Array.from(root.querySelectorAll?.(selector) || []);
    if (root.matches?.(selector)) scripts.unshift(root);
    return scripts;
  };

  const loadTarget = (target) => {
    if (!observedTargets.has(target)) return;
    observer?.unobserve(target);
    cancelSchedule(target);
    observedTargets.delete(target);
    if (!target.isConnected) return;
    markersWithin(target).forEach(load);
  };

  const cancelSchedule = (target) => {
    const cancel = scheduledTargets.get(target);
    cancel?.();
    scheduledTargets.delete(target);
  };

  const schedule = (target) => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => loadTarget(target), { timeout: 2000 });
      scheduledTargets.set(target, () => window.cancelIdleCallback?.(id));
    } else {
      const id = window.setTimeout(() => loadTarget(target), 1000);
      scheduledTargets.set(target, () => window.clearTimeout(id));
    }
  };

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          loadTarget(entry.target);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  const observe = (script) => {
    if (!script.isConnected) return;
    // Theme Editor sections can be hidden or replaced before they intersect.
    // Load their runtime immediately, including markers added by a re-render.
    if (window.Shopify?.designMode) {
      load(script);
      return;
    }
    try {
      const existing = modules.get(moduleURL(script));
      if (existing) {
        load(script);
        return;
      }
    } catch {
      // Validate and report in load(), without throwing out of scan().
    }
    // Markers are siblings of their component. Their parent can be a
    // display:contents layout slot (featured collection on desktop), which
    // has no box for IntersectionObserver to intersect. Find a boxed ancestor.
    let target = script.parentElement;
    while (target && !Array.from(target.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0)) {
      target = target.parentElement;
    }
    if (!target) {
      load(script);
      return;
    }
    if (observedTargets.has(target)) return;
    observedTargets.add(target);
    if (observer) observer.observe(target);
    else schedule(target);
  };

  const scan = (root = document) => markersWithin(root).forEach(observe);

  const unobserve = (root) => {
    markersWithin(root).forEach((script) => {
      markerInitializations.delete(script);
      delete script.dataset.themeModuleState;
      delete script.dataset.themeModuleError;
    });
    // The observation target may be above the marker's immediate parent.
    [root, ...Array.from(root.querySelectorAll?.('*') || [])].forEach((target) => {
      if (observedTargets.has(target)) {
        observer?.unobserve(target);
        cancelSchedule(target);
        observedTargets.delete(target);
      }
    });
  };

  scan();

  if (document.documentElement && typeof MutationObserver === 'function') {
    const mutationObserver = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === 'attributes') {
          scan(record.target);
          return;
        }
        record.removedNodes.forEach((node) => {
          if (node.nodeType === 1) unobserve(node);
        });
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      });
    });
    mutationObserver.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme-module'],
    });
  }

  const loadEditorTarget = (event) => {
    if (event.type === 'shopify:block:select' && !replayedSelections.has(event)) latestSelection = event;
    // Block selection can target a slide, with its marker outside the block.
    const target = event.target.closest?.('.shopify-section') || event.target;
    const scripts = markersWithin(target);
    const needsSelection = event.type === 'shopify:block:select' && !replayedSelections.has(event) && scripts.some((script) => {
      try {
        moduleURL(script);
        return script.dataset.themeModuleState !== 'loaded';
      } catch {
        return false;
      }
    });
    const loads = scripts.map(load);
    if (!needsSelection) return;

    // A lazy module registers its selection listener after this event. Replay
    // only the latest selection once it is ready, so the selected slide opens.
    pendingSelections.set(target, event);
    Promise.all(loads).then(() => {
      if (pendingSelections.get(target) !== event) return;
      pendingSelections.delete(target);
      if (latestSelection !== event) return;
      latestSelection = null;
      if (!event.target.isConnected || !scripts.every((script) => script.dataset.themeModuleState === 'loaded')) return;
      const replay = new CustomEvent(event.type, { bubbles: true, detail: event.detail });
      replayedSelections.add(replay);
      event.target.dispatchEvent(replay);
    });
  };

  document.addEventListener('shopify:section:load', loadEditorTarget);
  document.addEventListener('shopify:section:select', loadEditorTarget);
  document.addEventListener('shopify:block:select', loadEditorTarget);
  document.addEventListener('shopify:block:deselect', (event) => {
    if (latestSelection?.target === event.target) latestSelection = null;
  });
  document.addEventListener('shopify:section:unload', (event) => {
    unobserve(event.target);
    if (pendingSelections.get(event.target) === latestSelection) latestSelection = null;
    pendingSelections.delete(event.target);
  });
})();
