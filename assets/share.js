(() => {
  const controllerKey = '__shareController';
  if (window[controllerKey]) return;

  const getStatus = (button) => {
    const nextElement = button.nextElementSibling;
    if (nextElement?.matches('[data-share-status]')) return nextElement;
    return button.parentElement?.querySelector('[data-share-status]') || null;
  };

  const setStatus = (button, message, isError = false) => {
    const status = getStatus(button);
    if (!status) return;
    status.textContent = message || '';
    status.dataset.error = String(isError);
  };

  const copyText = async (value) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch (error) {
        // Continue with the legacy fallback when clipboard permission is unavailable.
      }
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.insetInlineStart = '-9999px';
    document.body.append(input);
    input.select();
    const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Copy failed');
  };

  const resolveUrl = (value) => {
    try {
      return new URL(value || window.location.href, window.location.href).href;
    } catch (error) {
      return window.location.href;
    }
  };

  const share = async (button) => {
    if (!button || button.dataset.shareBusy === 'true') return;

    const url = resolveUrl(button.dataset.shareUrl);
    const title = button.dataset.shareTitle || document.title;
    const text = button.dataset.shareText || '';
    const copiedLabel = button.dataset.shareCopied || 'Link copied.';
    const errorLabel = button.dataset.shareError || 'Unable to share.';
    button.dataset.shareBusy = 'true';
    button.setAttribute('aria-busy', 'true');

    try {
      if (typeof navigator.share === 'function') {
        try {
          const shareData = { title, url };
          if (text) shareData.text = text;
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      await copyText(url);
      setStatus(button, copiedLabel);
    } catch (error) {
      setStatus(button, errorLabel, true);
    } finally {
      button.dataset.shareBusy = 'false';
      button.removeAttribute('aria-busy');
    }
  };

  const handleClick = (event) => {
    const button = event.target.closest?.('[data-share]');
    if (!button) return;
    event.preventDefault();
    share(button);
  };

  document.addEventListener('click', handleClick);
  window[controllerKey] = { share };
})();
