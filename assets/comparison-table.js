(() => {
  // Section rendering can request this classic asset more than once.
  class ComparisonTableTooltip extends HTMLElement {
    connectedCallback() {
      if (this.abortController) return;
      this.abortController = new AbortController();
      this.trigger = this.querySelector('[data-comparison-table-tooltip-trigger]');
      this.dialog = this.querySelector('[data-comparison-table-tooltip-dialog]');
      this.overlay = window.ThemeOverlay?.get(this.dialog);
      this.trigger?.addEventListener('click', () => {
        if (window.ThemeOverlay?.mobile?.matches) this.overlay?.open({ opener: this.trigger });
      }, { signal: this.abortController.signal });
    }

    disconnectedCallback() {
      this.overlay?.destroy();
      this.abortController?.abort();
      this.abortController = null;
      this.overlay = null;
    }
  }

  const rowSelector = '.comparison-table__row[data-comparison-table-row]';
  const normalize = (value) => String(value || '').replace(/\uFEFF/g, '').trim();

  class ComparisonTableRows extends HTMLElement {
    connectedCallback() {
      if (this.observer) return;
      this.observer = new MutationObserver(() => this.update());
      this.observer.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-comparison-table-row', 'data-comparison-table-feature-label'],
      });
      this.update();
    }

    disconnectedCallback() {
      this.observer?.disconnect();
      this.observer = null;
    }

    update() {
      const table = this.querySelector('.comparison-table__scroll--with-feature');
      if (!table) return;
      const featureRows = [...table.querySelectorAll(`.comparison-table__col--feature ${rowSelector}`)];
      let lastFeatureRow = 0;
      featureRows.forEach((row) => {
        const index = Number(row.dataset.comparisonTableRow);
        if (normalize(row.dataset.comparisonTableFeatureLabel) && Number.isInteger(index) && index > 0) {
          lastFeatureRow = Math.max(lastFeatureRow, index);
        }
      });

      // Keep authored slot alignment, but do not reserve unused trailing tracks.
      this.style.setProperty('--comparison-table-track-count', String(lastFeatureRow + 1));
      table.style.setProperty('--comparison-table-track-count', String(lastFeatureRow + 1));
      table.setAttribute('aria-rowcount', String(lastFeatureRow + 1));
      table.querySelectorAll(rowSelector).forEach((row) => {
        const index = Number(row.dataset.comparisonTableRow);
        row.hidden = !Number.isInteger(index) || index < 1 || index > lastFeatureRow;
        if (row.hidden) row.removeAttribute('aria-rowindex');
        else row.setAttribute('aria-rowindex', String(index + 1));
      });
    }
  }

  if (!customElements.get('comparison-table-tooltip')) {
    customElements.define('comparison-table-tooltip', ComparisonTableTooltip);
  }
  if (!customElements.get('comparison-table-rows')) {
    customElements.define('comparison-table-rows', ComparisonTableRows);
  }
})();
