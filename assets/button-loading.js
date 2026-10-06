export function setButtonLoadingState(button, isLoading, {
  buttonStateKey,
  wrapper,
  wrapperStateKey,
  showDots = true,
  hideLabel = true,
} = {}) {
  if (!button) return;

  button.classList.toggle('btn--loading', isLoading && hideLabel);
  if (buttonStateKey) {
    if (isLoading) button.dataset[buttonStateKey] = 'true';
    else delete button.dataset[buttonStateKey];
  }
  if (isLoading) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');

  const dots = showDots ? button.querySelector('[data-loading-dots]') : null;
  if (dots) {
    dots.hidden = !isLoading;
    dots.classList.toggle('hidden', !isLoading);
  }

  if (wrapper && wrapperStateKey) {
    if (isLoading) wrapper.dataset[wrapperStateKey] = 'true';
    else delete wrapper.dataset[wrapperStateKey];
  }
}
