/* Shared block entrance lifecycle. Component-owned transforms remain untouched. */
(() => {
  const key = Symbol.for('theme.blockAnimations');
  if (window[key]) return;
  window[key] = true;
  const nodes = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => document.body.dataset.blockAnimations !== 'false' && !reduced.matches;
  const selector = '[data-block-animation], [data-component-reveal]';
  const cardSelector = 'article.testimonial-item, .product-card, .promo-card, .collection-card, .collection-card-kernel, .blog-card, .blog-first-card, article.image-card, .collection-thumbnail__link, .icon-text-cards__content > .group, .icon-text-cards__viewport > .swiper-wrapper > .swiper-slide > .group';
  const listSelector = '[data-product-list-mobile-promos], [data-product-carousel], .product-collection-grid, .collection-card-list__grid, .product-list__grid, [data-product-list], .image-cards-section__grid, [data-blog-list], .blog-grid, .collection-thumbnails__grid, .collection-thumbnails__carousel, .testimonial-carousel, .testimonials-cards__carousel, .icon-text-cards__content, .icon-text-cards__viewport > .swiper-wrapper';
  const scopeSelector = '[role="tabpanel"], .slideshow__swiper .swiper-slide';
  // Shopify's CSS compiler can shorten 500ms to .5s. Web Animations
  // always expects milliseconds, regardless of the CSS serialization.
  const durationMilliseconds = (value, fallback) => {
    const time = String(value).trim();
    const number = parseFloat(time);
    if (!Number.isFinite(number) || number < 0) return fallback;
    return number * (time.endsWith('s') && !time.endsWith('ms') ? 1000 : 1);
  };
  const active = element => {
    if (!element.isConnected || !element.getClientRects().length) return false;
    if (element.closest('[hidden], [aria-hidden="true"]')) return false;
    const inert = element.closest('[inert]');
    // Tab requests/exits lock commerce controls while the old cards stay visible.
    // Inert is an interaction state here, not panel deactivation.
    if (inert && !(inert.matches('[data-collection-tab-panel]') &&
        (inert.dataset.tabLoading === 'true' || inert.dataset.tabExiting === 'true'))) return false;
    const slide = element.closest('.slideshow__swiper .swiper-slide');
    return !slide || slide.classList.contains('swiper-slide-active');
  };
  const inView = element => {
    // A visible slideshow reveals its active slide as one story beat. Individual
    // content blocks can sit below a short editor viewport and still must play.
    const tabPanel = element.matches(cardSelector) && element.closest('[data-collection-tab-panel]');
    const r = (tabPanel || element.closest('.slideshow') || element).getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const stop = state => {state.animations.forEach(a => a.cancel()); state.animations = [];};
  const show = element => {
    const state = nodes.get(element);
    if (!state || state.played || !active(element)) return;
    state.played = true;
    element.classList.remove('reveal-pending');
    if (!enabled()) return;
    const tokens = getComputedStyle(element);
    const tabMotion = element.closest('[data-collection-tab-panel]') && element.matches(cardSelector);
    const stagger = Number(element.dataset.animationStagger) || 0;
    const delay = Math.min(1500, Math.max(0, (Number(element.dataset.animationDelay) || 0) +
      (tabMotion ? Number(element.dataset.animationTabDelay) || 0 : stagger)));
    const duration = tabMotion ? durationMilliseconds(tokens.getPropertyValue('--tab-card-duration'), 500) :
      Math.max(700, durationMilliseconds(tokens.getPropertyValue('--motion-duration-slow'), 700));
    const distance = tabMotion ? parseFloat(tokens.getPropertyValue('--tab-card-distance')) || 50 : 32;
    const options = {duration, delay, easing:tabMotion ? 'ease' : tokens.getPropertyValue('--motion-ease-standard').trim() || 'cubic-bezier(.22,1,.36,1)', fill:'backwards'};
    const type = element.dataset.blockAnimation || 'slide-bottom';
    const from = {opacity:element.dataset.animationPreserveOpacity === 'true' ? 1 : 0};
    if (type === 'scale') from.transform = 'scale(.94)';
    if (type === 'slide-left') from.transform = 'translateX(-32px)';
    if (type === 'slide-right') from.transform = 'translateX(32px)';
    if (type === 'slide-bottom') from.transform = `translateY(${distance}px)`;
    if (type === 'rotate-words') {
      element.querySelectorAll('.reveal-word').forEach((word, index) => {
        state.animations.push(word.animate([{opacity:0,transform:'translateY(.7em) rotateX(45deg)'},{opacity:1,transform:'none'}], {...options,delay:delay + index * 35}));
      });
    } else {
      // Opacity-only cards must not write a transform onto a Swiper-owned slide.
      const to = {opacity:1};
      if (from.transform) to.transform = 'none';
      state.animations.push(element.animate([from,to],options));
    }
    // No forwards fill: release the opacity/transform layer, especially for backdrop blur.
    state.animations.forEach(animation => animation.finished.then(() => animation.cancel()).catch(() => {}));
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const panel = entry.target.matches(cardSelector) && entry.target.closest('[data-collection-tab-panel]');
      if (panel) {
        nodes.forEach((state, element) => {
          if (element.matches(cardSelector) && element.closest('[data-collection-tab-panel]') === panel) show(element);
        });
      } else show(entry.target);
    });
  }, {threshold:0.05, rootMargin:'0px 0px -40px 0px'});
  const splitWords = element => {
    if (element.querySelector('.reveal-word')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) if (walker.currentNode.textContent.trim() && !walker.currentNode.parentElement.closest('svg,script,style')) texts.push(walker.currentNode);
    texts.forEach(text => {
      const fragment = document.createDocumentFragment();
      text.textContent.split(/(\s+)/).filter(Boolean).forEach(part => {
        if (/^\s+$/.test(part)) fragment.append(document.createTextNode(part));
        else {const span = document.createElement('span');span.className='reveal-word';span.textContent=part;fragment.append(span);}
      });
      text.replaceWith(fragment);
    });
  };
  const initialize = element => {
    // The stack controller owns media motion. Inert back cards are still visible.
    if (element.closest('[data-multi-image]')) {
      const state = nodes.get(element);
      if (state) {stop(state);observer.unobserve(element);nodes.delete(element);}
      element.classList.remove('reveal-pending');
      return;
    }
    const previous = nodes.get(element);
    const configuration = `${element.dataset.blockAnimation}:${element.dataset.animationDelay}`;
    // Explicitly animated parents own the entrance; avoid nested double transforms.
    const parent = element.parentElement?.closest('[data-block-animation]:not([data-block-animation="none"]),[data-component-reveal]');
    if (element.dataset.blockAnimation === 'none' || (parent && parent.dataset.blockAnimation !== 'none')) {
      if (previous) {stop(previous);observer.unobserve(element);nodes.delete(element);}
      element.classList.remove('reveal-pending');
      return;
    }
    if (previous?.configuration === configuration) return;
    if (previous) {stop(previous);observer.unobserve(element);nodes.delete(element);}
    if (element.dataset.blockAnimation === 'rotate-words') splitWords(element);
    nodes.set(element,{played:false,animations:[],configuration});
    if (enabled()) element.classList.add('reveal-pending');
    observer.observe(element);
    if (!enabled() || (active(element) && inView(element))) show(element);
  };
  const scan = (root = document) => {
    const cards = root.querySelectorAll?.(cardSelector) || [];
    cards.forEach(card => {
      if (card.closest('.slideshow, .announcement-bar, dialog')) return;
      card.dataset.componentReveal = '';
      if (!card.dataset.blockAnimation) card.dataset.blockAnimation = card.matches('article.testimonial-item') ? 'fade' : 'slide-bottom';
      const list = card.closest(listSelector);
      if (list) {
        const siblings = [...list.querySelectorAll(cardSelector)].filter(e => e.closest(listSelector) === list);
        // Stagger within the visible row; later rows must not inherit a long list-wide wait.
        // Measure the layout item so an in-flight card transform cannot change its row.
        const rowTop = element => (element.closest('.product-collection-grid__item') || element.closest('.blog-list__item, .swiper-slide') || element).getBoundingClientRect().top;
        const top = rowTop(card);
        const row = siblings.filter(sibling => Math.abs(rowTop(sibling) - top) < 8);
        // Section headings lead the cards. Explicit merchant delay is an offset,
        // not overwritten by row staggering; later rows start their own beat.
        const section = card.closest('.shopify-section');
        const intro = section ? [...section.querySelectorAll(selector)].filter(element =>
          element.dataset.blockAnimation !== 'none' && !element.closest(cardSelector) &&
          active(element) && (element.compareDocumentPosition(card) & 4)
        ) : [];
        const introDelay = Math.max(0, ...intro.map(element => Number(element.dataset.animationDelay) || 0));
        // Concept animates the complete tab list in DOM order, including slides
        // beyond the horizontal viewport, with the same curve on every reveal.
        card.dataset.animationTabDelay = String(Math.max(0, siblings.indexOf(card)) * (parseFloat(getComputedStyle(card).getPropertyValue('--tab-card-stagger')) || 100));
        card.dataset.animationRowDelay = String(Math.max(0, row.indexOf(card)) * (parseFloat(getComputedStyle(card).getPropertyValue('--tab-card-stagger')) || 100));
        card.dataset.animationStagger = card.dataset.animationPreserveOpacity === 'true' ? '0' :
          String(Math.min(900, introDelay + 150 + Math.max(0, row.indexOf(card)) * 75));
      }
    });
    // Resource actions and forms share the entrance order of their content blocks.
    root.querySelectorAll?.('.collection-list-view-all, .email-signup-block, .product-callout__content').forEach(element => {
      if (element.closest('dialog, .announcement-bar')) return;
      element.dataset.componentReveal = '';
      if (!element.dataset.blockAnimation || element.dataset.blockAnimation === 'none') element.dataset.blockAnimation = 'fade';
      const section = element.closest('.shopify-section');
      const preceding = section ? [...section.querySelectorAll('[data-block-animation]:not([data-block-animation="none"])')].filter(other =>
        other !== element && !other.closest(cardSelector) && (other.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
      ).length : 0;
      element.dataset.animationStagger = String(Math.min(750, 150 + preceding * 75));
    });
    if (root.matches?.(selector)) initialize(root);
    root.querySelectorAll?.(selector).forEach(initialize);
  };
  const resetScope = root => {
    nodes.forEach((state, element) => {
      if (!root.contains(element)) return;
      stop(state);state.played = false;
      if (enabled()) element.classList.add('reveal-pending');
      if (active(element) && inView(element)) show(element);
    });
  };
  const mutations = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'childList') record.addedNodes.forEach(node => {if (node instanceof Element) scan(node);});
      else if (record.attributeName === 'data-block-animation' || record.attributeName === 'data-animation-delay') {
        initialize(record.target);
        record.target.querySelectorAll(selector).forEach(initialize);
      }
      else if (record.target.matches?.(scopeSelector)) {
        // Deactivation arms this scope. Subsequent activation replays its own contents.
        if (!active(record.target)) resetScope(record.target);
        else {
          // Hidden tab panels have no row geometry until activation.
          if (record.target.matches('[role="tabpanel"]')) scan(record.target);
          nodes.forEach((state, element) => {if (record.target.contains(element) && !state.played && inView(element)) show(element);});
        }
      }
    });
    nodes.forEach((state, element) => {if (!element.isConnected) {stop(state);observer.unobserve(element);nodes.delete(element);}});
  });
  scan();
  mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','inert','class','data-block-animation','data-animation-delay']});
  document.addEventListener('shopify:section:load',event => scan(event.target));
  // Responsive row changes update future stagger without replaying visible cards.
  let resizeFrame;
  window.addEventListener?.('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => scan());
  });
  // Reconcile after all Item accessibility and visibility changes are complete.
  document.addEventListener('multiple-images-text:change',event => {
    scan(event.target);
    nodes.forEach((state, element) => {
      const item = element.closest('[data-multi-item]');
      if (!item || !event.target.contains(item)) return;
      if (event.detail.previous !== event.detail.index || !active(element)) {
        stop(state);state.played = false;
        element.classList.toggle('reveal-pending', enabled());
      }
      if (active(element) && inView(element)) show(element);
    });
  });
  document.addEventListener('shopify:block:select',event => {
    requestAnimationFrame(() => nodes.forEach((state, element) => {
      if (event.target.contains(element) || element.contains(event.target)) {
        stop(state);state.played = true;element.classList.remove('reveal-pending');
      }
    }));
  });
  document.addEventListener('focusin',event => {
    const element = event.target.closest('.reveal-pending');
    if (element) show(element);
  });
  reduced.addEventListener('change',() => nodes.forEach((state,element) => {
    stop(state);state.played = true;element.classList.remove('reveal-pending');
  }));
})();
