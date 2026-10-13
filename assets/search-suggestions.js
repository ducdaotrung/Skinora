(() => {
  const escape = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const historyKey = 'spinel:recent-searches:v1';
  const normalizeQuery = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 200) : '';
  const readHistory = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(historyKey) || '[]');
      if (!Array.isArray(stored)) return [];
      const seen = new Set();
      return stored.map(normalizeQuery).filter(query => {
        const key = query.toLocaleLowerCase();
        if (!query || seen.has(key)) return false;
        seen.add(key); return true;
      }).slice(0, 5);
    } catch { return []; }
  };
  const recordSearch = value => {
    const query = normalizeQuery(value);
    if (!query) return;
    try { localStorage.setItem(historyKey, JSON.stringify([query, ...readHistory().filter(item => item.toLocaleLowerCase() !== query.toLocaleLowerCase())].slice(0, 5))); } catch {}
  };
  const clearHistory = () => { try { localStorage.removeItem(historyKey); } catch {} };
  const types = (root) => ['query', ...[['showProducts','product'],['showCollections','collection'],['showBlogPosts','article'],['showPages','page']].filter(([flag]) => root.dataset[flag] !== 'false').map(([,type]) => type)].join(',');
  const request = async (root, query, signal, limit = 5) => {
    const params = new URLSearchParams({q:query,'resources[type]':types(root),'resources[limit]':String(limit),'resources[limit_scope]':'each'});
    const response = await fetch(`${root.dataset.predictiveSearchUrl}?${params}`, {signal,headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('Predictive search failed');
    return (await response.json()).resources?.results || {};
  };
  const highlight = (text, query) => {
    const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
    return index < 0 ? escape(text) : `${escape(text.slice(0,index))}<strong>${escape(text.slice(index,index+query.length))}</strong>${escape(text.slice(index+query.length))}`;
  };
  const bindTabs = (root, target) => {
    const tabs = Array.from(target.querySelectorAll('[data-search-smart-tab]'));
    const panels = target.querySelectorAll('[data-search-smart-panel]');
    const select = (tab, focus = false) => {
      root.dataset.smartActiveGroup = tab.dataset.searchSmartTab;
      tabs.forEach(item => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
      });
      panels.forEach(panel => { panel.hidden = panel.dataset.searchSmartPanel !== root.dataset.smartActiveGroup; });
      if (focus) tab.focus({ preventScroll: true });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', event => {
        const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[next], true);
      });
    });
    if (tabs.length) select(tabs.find(tab => tab.dataset.searchSmartTab === root.dataset.smartActiveGroup) || tabs[0]);
  };
  const render = async (root, target, data, query, signal) => {
    if (signal.aborted) return;
    const labels = root.dataset;
    const groups = [['products',labels.productsLabel],['collections',labels.collectionsLabel],['articles',labels.blogPostsLabel],['pages',labels.pagesLabel]].filter(([key]) => data[key]?.length);
    const queries = data.queries || [];
    const suggestions = queries.length ? `<section><h2 class="heading-text heading-sm">${escape(labels.suggestionsLabel)}</h2><div class="search-suggestions__chips">${queries.map(item => `<button type="button" data-search-suggestion="${escape(item.text)}">${highlight(item.text || '',query)}</button>`).join('')}</div></section>` : '';
    const groupId = key => `${target.id}-${key}`;
    const tablist = groups.length ? `<div class="search-suggestions__tabs" role="tablist" aria-label="${escape(labels.searchTypesLabel || labels.suggestionsLabel)}">${groups.map(([key,label]) => `<button class="search-suggestions__tab body-text body-sm" type="button" role="tab" id="${escape(groupId(key))}-tab" aria-controls="${escape(groupId(key))}-panel" aria-selected="false" tabindex="-1" data-search-smart-tab="${key}">${escape(label)}</button>`).join('')}</div>` : '';
    const panels = groups.map(([key]) => `<div class="search-suggestions__tabpanel" role="tabpanel" id="${escape(groupId(key))}-panel" aria-labelledby="${escape(groupId(key))}-tab" data-search-smart-panel="${key}" hidden><div data-search-group="${key}">${data[key].map(item => `<a class="search-suggestions__link body-text body-sm" href="${escape(item.url)}">${escape(item.title)}</a>`).join('')}</div></div>`).join('');
    target.innerHTML = suggestions + tablist + panels;
    if (!target.innerHTML) target.innerHTML = `<p role="status">${escape(labels.noResultsLabel)}</p>`;
    target.innerHTML += `<div class="search-suggestions__footer"><a class="btn btn--primary" href="${escape(labels.searchUrl)}?q=${encodeURIComponent(query)}&options%5Bprefix%5D=last">${escape(labels.viewAllLabel)}</a></div>`;
    bindTabs(root, target);
    const paths = (data.products || []).map(item => {try {const url=new URL(item.url,location.origin);return url.origin===location.origin ? url.pathname : '';} catch {return '';}});
    const rows = await window.ThemeRecentlyViewed?.load(paths,'[data-recently-viewed-row]',signal) || [];
    if (signal.aborted) return;
    const group = target.querySelector('[data-search-group="products"]');
    rows.forEach((row,index) => {if(row && group?.children[index]) group.children[index].replaceWith(row);});
    target.dispatchEvent(new CustomEvent('collection:products-loaded',{bubbles:true}));
  };
  const recent = async (root,target,signal) => {
    const history = readHistory();
    const paths = root.dataset.showRecent === 'false' ? [] : window.ThemeRecentlyViewed?.read().slice(0,Number(root.dataset.recentLimit)||5) || [];
    const rows = await window.ThemeRecentlyViewed?.load(paths,'[data-recently-viewed-row]',signal) || [];
    if(signal.aborted) return;
    const valid=rows.filter(Boolean);
    const clock = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 7M3 4v7h7M12 7v5l3 2"/></svg>';
    target.innerHTML = history.length ? `<section class="search-suggestions__history"><div class="search-suggestions__history-heading"><h2 class="heading-text heading-sm">${escape(root.dataset.recentSearchesLabel)}</h2><button class="body-text body-sm" type="button" data-search-history-clear>${escape(root.dataset.clearHistoryLabel)}</button></div><ul role="list">${history.map(query => `<li><button class="body-text body-sm" type="button" data-search-suggestion="${escape(query)}">${clock}<span>${escape(query)}</span></button></li>`).join('')}</ul></section>` : '';
    if (valid.length) target.innerHTML += `<h2 class="heading-text heading-sm">${escape(root.dataset.recentLabel)}</h2>`;
    target.append(...valid);
    target.hidden=!valid.length && !history.length;
    target.dispatchEvent(new CustomEvent('collection:products-loaded',{bubbles:true}));
  };
  window.ThemeSearchSuggestions={escape,types,request,render,recent,bindTabs,readHistory,recordSearch,clearHistory};
  // This shared deferred asset follows the section controller in document order.
  // Capture landed searches here after the history service is available.
  const searchRoot = typeof document !== 'undefined' && document.querySelector('[data-search-smart]');
  if (searchRoot && location.pathname === searchRoot.dataset.searchUrl) recordSearch(new URLSearchParams(location.search).get('q'));
})();
