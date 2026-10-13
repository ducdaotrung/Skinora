(() => {
  const instances=new WeakMap(), tabInstances=new WeakSet();
  const initializeTabs=(parent)=>parent.querySelectorAll('[data-search-results-tabs]').forEach(root=>{
    if(tabInstances.has(root)) return;
    tabInstances.add(root);
    const tabs=Array.from(root.querySelectorAll('[data-search-page-tab]')), panels=root.querySelectorAll('[data-search-page-panel]');
    const select=(tab,focus=false)=>{tabs.forEach(item=>{const active=item===tab;item.setAttribute('aria-selected',String(active));item.tabIndex=active?0:-1;});panels.forEach(panel=>{panel.hidden=panel.dataset.searchPagePanel!==tab.dataset.searchPageTab;});if(focus)tab.focus();};
    tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{const next={ArrowRight:(index+1)%tabs.length,ArrowLeft:(index-1+tabs.length)%tabs.length,Home:0,End:tabs.length-1}[event.key];if(next===undefined)return;event.preventDefault();select(tabs[next],true);});});
    if(tabs.length) select(tabs.find(tab=>tab.getAttribute('aria-selected')==='true')||tabs[0]);
  });
  const initialize=root=>{
    initializeTabs(root);
    root.classList.add('search-page--enhanced');
    if(instances.has(root))return;
    const lifecycle=new AbortController(), options={signal:lifecycle.signal};
    const anchor=root.querySelector('[data-search-smart]'),input=anchor?.querySelector('input[name="q"]'),results=anchor?.querySelector('[data-search-smart-results]'),clear=root.querySelector('[data-search-page-clear]'),backdrop=root.querySelector('[data-search-smart-backdrop]'),form=clear?.form||clear?.closest('form');
    if(!input)return;
    let open=false,suppress=false,timer,request,revision=0;
    const syncClear=()=>{const hasQuery=Boolean(input.value);if(clear)clear.hidden=!hasQuery;if(form){if(hasQuery)form.classList.add('has-query');else form.classList.remove('has-query');}};
    const resize=()=>anchor.style.setProperty('--search-suggestions-height',`${Math.max(120,window.innerHeight-anchor.getBoundingClientRect().bottom-30)}px`);
    const close=(restore=false)=>{open=false;revision++;clearTimeout(timer);request?.abort();anchor.classList.remove('is-open');results.hidden=true;backdrop.hidden=true;input.setAttribute('aria-expanded','false');if(restore){suppress=true;input.focus({preventScroll:true});suppress=false;}};
    const update=()=>{
      syncClear(); if(!open)return;
      clearTimeout(timer);request?.abort();const version=++revision,query=input.value.trim();
      request=new AbortController();const signal=request.signal,service=window.ThemeSearchSuggestions;
      if(!service)return;
      results.hidden=false;results.setAttribute('aria-busy','true');results.innerHTML=`<p role="status">${service.escape(anchor.dataset.loadingLabel)}</p>`;
      timer=setTimeout(async()=>{try{
        if(query){const data=await service.request(anchor,query,signal);if(signal.aborted||version!==revision)return;await service.render(anchor,results,data,query,signal);}else await service.recent(anchor,results,signal);
      }catch(error){if(error.name!=='AbortError'&&version===revision){results.innerHTML=`<p role="status">${service.escape(anchor.dataset.errorLabel)}</p>`;results.hidden=false;}}finally{if(version===revision){results.setAttribute('aria-busy','false');input.setAttribute('aria-expanded',String(!results.hidden));}}},query?160:0);
    };
    const show=()=>{if(suppress||anchor.dataset.smartEnabled==='false'||open)return;open=true;anchor.classList.add('is-open');backdrop.hidden=false;input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',results.id);resize();update();};
    input.addEventListener('focus',show,options);input.addEventListener('click',show,options);input.addEventListener('input',update,options);
    clear?.addEventListener('click',()=>{input.value='';input.focus({preventScroll:true});update();},options);
    backdrop?.addEventListener('click',()=>close(true),options);
    anchor.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close(true);}if(event.key==='ArrowDown'&&event.target===input&&open){const first=results.querySelector('a,button');if(first){event.preventDefault();first.focus();}}},options);
    results.addEventListener('click',event=>{
      if(event.target.closest('[data-search-history-clear]')){window.ThemeSearchSuggestions?.clearHistory();input.focus({preventScroll:true});update();return;}
      const button=event.target.closest('[data-search-suggestion]');
      if(!button){const link=event.target.closest('a');if(link?.closest('.search-suggestions__footer'))window.ThemeSearchSuggestions?.recordSearch(input.value);if(event.target.closest('a,button[type="submit"]'))close();return;}
      input.value=button.dataset.searchSuggestion;input.focus({preventScroll:true});update();
    },options);
    form?.addEventListener('submit',()=>window.ThemeSearchSuggestions?.recordSearch(input.value),options);
    document.addEventListener('focusin',event=>{if(open&&!anchor.contains(event.target)&&event.target!==backdrop)close();},options);
    window.addEventListener('resize',resize,options);
    document.addEventListener('shopify:block:select',event=>{if(anchor.closest('[data-shopify-editor-block]')?.contains(event.target)||event.target.contains?.(anchor))show();},options);
    document.addEventListener('shopify:block:deselect',()=>close(),options);
    lifecycle.signal.addEventListener('abort',()=>close());syncClear();instances.set(root,lifecycle);
  };
  const roots=parent=>[...(parent.matches?.('[data-search-page]')?[parent]:[]),...parent.querySelectorAll('[data-search-page]')];
  const init=(parent=document)=>roots(parent).forEach(initialize);
  document.addEventListener('shopify:section:load',event=>init(event.target));
  document.addEventListener('collection:products-loaded',event=>initializeTabs(event.target.closest?.('[data-search-page]')||event.target));
  document.addEventListener('shopify:section:unload',event=>roots(event.target).forEach(root=>{instances.get(root)?.abort();instances.delete(root);}));
  init();
})();
