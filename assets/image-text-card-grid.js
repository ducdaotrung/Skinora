export const initializeThemeModule = (root = document) => {
    root.querySelectorAll?.('[data-image-text-card-heading-tag]').forEach((carousel) => {
      const tag = carousel.dataset.imageTextCardHeadingTag;
      if (!['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return;
      carousel.querySelectorAll('[data-image-text-card] .image-text-card-grid-item__heading').forEach((heading) => {
        if (heading.tagName.toLowerCase() === tag) return;
        const replacement = document.createElement(tag);
        [...heading.attributes].forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
        replacement.innerHTML = heading.innerHTML;
        heading.replaceWith(replacement);
      });
    });
};

(() => {

  const toggleCard = (event) => {
    const target = event.target instanceof Element ? event.target : event.composedPath?.().find((node) => node instanceof Element);
    const toggle = target?.closest('[data-image-text-card-toggle]');
    if (!toggle) return;

    const card = toggle.closest('[data-image-text-card]');
    const visual = card?.querySelector('[data-image-text-card-visual]');
    const content = card?.querySelector('[data-image-text-card-content]');
    if (!card || !visual) return;

    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    visual.classList.toggle('is-open', !open);
    content?.setAttribute('aria-hidden', String(open));
  };

  initializeThemeModule();
  document.addEventListener('click', toggleCard, true);
  document.addEventListener('shopify:section:load', (event) => initializeThemeModule(event.target));
})();
