(() => {
  if (customElements.get('password-page')) return;
  class PasswordPage extends HTMLElement {
    connectedCallback() {
      this.controller?.abort();
      this.controller = new AbortController();
      this.dialog = this.querySelector('[data-password-dialog]');
      this.opener = this.querySelector('[data-password-open]');
      this.overlay = window.ThemeOverlay?.get(this.dialog);
      if (!this.overlay) return;
      this.opener?.addEventListener('click', () => this.open(), { signal: this.controller.signal });
      this.dialog.addEventListener('close', () => this.opener?.setAttribute('aria-expanded', 'false'), { signal: this.controller.signal });
      if (this.dialog.querySelector('[data-password-error]')) this.open();
    }
    open() {
      this.overlay.open({ opener: this.opener });
      this.opener?.setAttribute('aria-expanded', 'true');
      this.dialog.querySelector('input[type="password"]')?.focus({ preventScroll: true });
    }
    disconnectedCallback() {
      this.controller?.abort();
      this.overlay?.destroy();
      this.overlay = null;
    }
  }
  customElements.define('password-page', PasswordPage);
})();
