(() => {
  const root = document.querySelector('.gift-card');
  if (!root) return;
  const qr = root.querySelector('[data-gift-card-qr]');
  if (qr && typeof QRCode === 'function') {
    new QRCode(qr, { text: qr.dataset.identifier, width: 120, height: 120 });
    qr.removeAttribute('title');
    qr.querySelector('img')?.setAttribute('alt', '');
    qr.hidden = false;
  }
  const button = root.querySelector('[data-gift-card-copy]');
  const status = root.querySelector('[data-gift-card-status]');
  if (!button) return;
  button.hidden = false;
  const label = button.textContent;
  let feedbackTimer;
  const showSuccess = () => {
    button.textContent = button.dataset.copied;
    status.textContent = button.dataset.copied;
    feedbackTimer = setTimeout(() => {
      button.textContent = label;
      status.textContent = '';
    }, 3000);
  };
  button.addEventListener('click', async () => {
    clearTimeout(feedbackTimer);
    try {
      await navigator.clipboard.writeText(button.dataset.code);
      showSuccess();
    } catch {
      // Theme Editor iframes can deny Clipboard API but allow user-initiated copy.
      const input = document.createElement('textarea');
      input.value = button.dataset.code;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual selection stays available. */ }
      input.remove();
      if (copied) {
        button.focus();
        showSuccess();
      } else {
        const code = root.querySelector('#GiftCardCode');
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        code.focus();
        status.textContent = button.dataset.error;
      }
    }
  });
})();
