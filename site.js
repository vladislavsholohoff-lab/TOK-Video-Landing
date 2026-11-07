(() => {
  const desktopView = window.matchMedia('(min-width: 1280px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const loader = document.getElementById('initial-loader');
  if (loader) {
    const root = document.documentElement;
    const layout = desktopView.matches ? '.desktop-view' : '.compact-view';
    const portrait = document.querySelector(`${layout} .hero-visual img[fetchpriority="high"]`);
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const minimum = new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 700)));
    const ready = Promise.allSettled([portrait?.decode(), document.fonts?.ready]);
    Promise.all([minimum, Promise.race([ready, pause(2200)])]).then(() => {
      root.classList.remove('tok-loading');
    });
  }
  const setMobileScale = () => {
    const scale = window.innerWidth / 360;
    const viewport = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--mobile-scale', scale);
    document.documentElement.style.setProperty('--mobile-hero-height', `${viewport / scale - 85}px`);
    document.documentElement.classList.toggle('short-mobile-hero', viewport / scale < 610);
  };
  setMobileScale();
  window.addEventListener('resize', setMobileScale);
  const scenes = document.querySelectorAll('[data-scene-width]');
  const resize = scene => {
    // CSS zoom already scales the complete mobile composition. Scene transforms
    // use the unzoomed layout width so artwork is never enlarged twice.
    const width = scene.getClientRects().length ? parseFloat(getComputedStyle(scene).width) : 0;
    if (width > 0) {
      let scale = width / Number(scene.dataset.sceneWidth);
      if (window.innerWidth < 700 && scene.matches('.hero-visual')) {
        scale = Math.min(scale, parseFloat(getComputedStyle(scene).height) / 284);
      }
      scene.style.setProperty('--scene-scale', scale);
    }
  };
  scenes.forEach(resize);
  // Flex layout reserves room for the copy and button; contain the complete
  // portrait in the remaining space instead of collapsing its width to 50px.
  const fitHero = () => {
    setMobileScale();
    const art = document.querySelector('.compact-view .hero-visual');
    if (art) resize(art);
  };
  fitHero();
  document.fonts.ready.then(fitHero);
  window.addEventListener('resize', fitHero);
  window.visualViewport?.addEventListener('resize', fitHero);
  // Reuse the small portrait if a high-resolution candidate fails.
  document.querySelectorAll('.hero-visual img[fetchpriority="high"]').forEach(img => {
    const recover = () => {
      if (!img.hasAttribute('srcset')) return;
      img.closest('picture')?.querySelector('source')?.removeAttribute('srcset');
      img.removeAttribute('srcset');
      img.src = desktopView.matches ? 'assets/baked/hero-desktop-320.b18c63b628cf.png' : 'assets/baked/hero-mobile-320.af4e69cfc272.png';
    };
    img.addEventListener('error', recover);
    if (img.complete && !img.naturalWidth) recover();
  });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(entries => entries.forEach(entry => resize(entry.target)));
    scenes.forEach(scene => observer.observe(scene));
  } else {
    window.addEventListener('resize', () => scenes.forEach(resize));
  }
  const faqTransitions = new WeakMap();
  const faqTarget = item => faqTransitions.get(item)?.open ?? item.open;
  const setFaq = (item, open) => {
    const previous = faqTransitions.get(item);
    if (!previous && item.open === open) return;
    // offsetHeight is in CSS pixels, unlike the zoomed mobile client rect.
    const from = item.offsetHeight;
    previous?.animation.cancel();
    faqTransitions.delete(item);
    item.open = open;
    const to = item.offsetHeight;
    const summary = item.querySelector('summary');
    if (reducedMotion.matches || typeof item.animate !== 'function' || from === to) {
      item.classList.remove('is-faq-animating');
      delete item.dataset.faqExpanded;
      summary?.removeAttribute('aria-expanded');
      return;
    }
    // Keep the answer in layout until the closing animation finishes.
    item.open = true;
    item.classList.add('is-faq-animating');
    item.dataset.faqExpanded = String(open);
    summary?.setAttribute('aria-expanded', String(open));
    const animation = item.animate([{height: `${from}px`}, {height: `${to}px`}], {
      duration: 650, easing: 'cubic-bezier(.25,.7,.2,1)', fill: 'both',
    });
    faqTransitions.set(item, {animation, open});
    animation.onfinish = () => {
      if (faqTransitions.get(item)?.animation !== animation) return;
      faqTransitions.delete(item);
      item.open = open;
      item.classList.remove('is-faq-animating');
      delete item.dataset.faqExpanded;
      summary?.removeAttribute('aria-expanded');
      animation.cancel();
    };
  };
  document.querySelectorAll('.faq-list').forEach(list => {
    const items = [...list.querySelectorAll('.faq-item')];
    items.forEach(item => item.querySelector('summary')?.addEventListener('click', event => {
      event.preventDefault();
      const open = !faqTarget(item);
      if (open) items.forEach(other => {
        if (other !== item && faqTarget(other)) setFaq(other, false);
      });
      setFaq(item, open);
    }));
  });
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-menu');
  let menuOpen = false;
  let menuCloseTimer;
  const finishMenuClose = () => {
    if (!menu || menuOpen) return;
    menu.hidden = true;
    menu.classList.remove('is-closing');
  };
  const setMenu = (open, {restoreFocus = false, immediate = false} = {}) => {
    if (!menu || !toggle || menuOpen === open) return;
    menuOpen = open;
    clearTimeout(menuCloseTimer);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.inert = !open;
    document.documentElement.classList.toggle('is-mobile-menu-open', open);
    if (open) {
      const wasHidden = menu.hidden;
      menu.hidden = false;
      menu.classList.remove('is-closing');
      // Establish the initial below-viewport position before transitioning.
      if (wasHidden) menu.getBoundingClientRect();
      menu.classList.add('is-open');
    } else {
      const fade = !immediate && !reducedMotion.matches;
      menu.classList.toggle('is-closing', fade);
      menu.classList.remove('is-open');
      if (fade) menuCloseTimer = setTimeout(finishMenuClose, 250);
      else finishMenuClose();
      if (restoreFocus) toggle.focus({preventScroll: true});
    }
  };
  const closeMenu = options => setMenu(false, options);
  toggle?.addEventListener('click', () => setMenu(!menuOpen, {restoreFocus: true}));
  menu?.querySelector('[data-menu-veil]')?.addEventListener('click', () => closeMenu({restoreFocus: true}));
  document.addEventListener('keydown', event => {
    if (!menuOpen || !menu || !toggle) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu({restoreFocus: true});
    }
    if (event.key === 'Tab') {
      const targets = [toggle, ...menu.querySelectorAll('a[href], button:not([disabled])')];
      const current = targets.indexOf(document.activeElement);
      if (current < 0 || (event.shiftKey ? current === 0 : current === targets.length - 1)) {
        event.preventDefault();
        targets[event.shiftKey ? targets.length - 1 : 0].focus();
      }
    }
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      link.classList.add('is-pressed');
      setTimeout(() => link.classList.remove('is-pressed'), 700);
      closeMenu();
    }
  });
  desktopView.addEventListener('change', () => closeMenu({immediate: true}));

  const initRegistration = () => {
    const dialog = document.getElementById('video-registration-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    const mount = dialog.querySelector('[data-getcourse-mount]');
    const status = dialog.querySelector('[data-getcourse-status]');
    const retry = dialog.querySelector('[data-getcourse-retry]');
    const close = dialog.querySelector('[data-getcourse-close]');
    if (!mount || !status || !retry || !close) return;
    const widgetId = '7b4a913845cc71a0e32ab1f46b5f57545ca0fd54';
    let widgetState = 'idle';
    let opener;
    const loadWidget = () => {
      if (widgetState === 'loading' || widgetState === 'ready') return;
      widgetState = 'loading';
      status.textContent = 'Загружаем форму…';
      status.hidden = false;
      retry.hidden = true;
      const script = document.createElement('script');
      script.id = widgetId;
      script.src = 'https://opgc-tok.ru/pl/lite/widget/script?id=1679794';
      const fail = () => {
        script.remove();
        widgetState = 'error';
        status.textContent = 'Не удалось загрузить форму.';
        retry.hidden = false;
      };
      script.addEventListener('error', fail, {once: true});
      script.addEventListener('load', () => {
        // The vendor removes its script after inserting the iframe. If its
        // DOMContentLoaded handler already ran, do not start it a second time.
        if (document.getElementById(widgetId) === script) {
          document.dispatchEvent(new Event(`StartWidget${widgetId}`));
        }
        const frame = mount.querySelector('iframe');
        if (!frame) { fail(); return; }
        frame.title = 'Регистрация на видео «Системный отдел продаж»';
        widgetState = 'ready';
        status.hidden = true;
      }, {once: true});
      mount.append(script);
    };
    document.querySelectorAll('[data-getcourse-open]').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        if (dialog.open) return;
        closeMenu();
        opener = menu?.contains(trigger) ? toggle : trigger;
        dialog.showModal();
        document.documentElement.classList.add('is-video-dialog-open');
        close.focus({preventScroll: true});
        loadWidget();
      });
    });
    close.addEventListener('click', () => dialog.close());
    retry.addEventListener('click', loadWidget);
    let backdropPointer = false;
    dialog.addEventListener('pointerdown', event => { backdropPointer = event.target === dialog; });
    dialog.addEventListener('click', event => {
      if (backdropPointer && event.target === dialog) dialog.close();
      backdropPointer = false;
    });
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('is-video-dialog-open');
      opener?.focus({preventScroll: true});
    });
  };
  if (document.readyState === 'complete') initRegistration();
  else document.addEventListener('DOMContentLoaded', initRegistration, {once: true});
  // Fetch heavy illustrations near the viewport to reserve bandwidth for the hero.
  const deferredArt = document.querySelectorAll('img[data-src]');
  const pendingMobileArt = new Set(document.querySelectorAll('.compact-view img[data-src]'));
  const revealArt = img => {
    if (!img.dataset.src) return;
    pendingMobileArt.delete(img);
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.loading = 'eager';
    img.src = img.dataset.src;
    delete img.dataset.src;
    delete img.dataset.srcset;
  };
  // WebKit may clip the observer's prefetch margin inside the zoomed mobile view.
  // Read viewport coordinates directly for its artwork, at most once per frame.
  let mobileArtFrame = 0;
  const scheduleMobileArt = () => {
    if (mobileArtFrame || !pendingMobileArt.size || window.innerWidth >= 700) return;
    mobileArtFrame = requestAnimationFrame(() => {
      mobileArtFrame = 0;
      const margin = 600;
      for (const img of pendingMobileArt) {
        const {top, bottom, width} = img.getBoundingClientRect();
        if (width > 0 && top <= window.innerHeight + margin && bottom >= -margin) revealArt(img);
      }
    });
  };
  let watchingArt = false;
  const watchArt = () => {
    if (watchingArt) return;
    watchingArt = true;
    if (typeof IntersectionObserver !== 'function') {
      deferredArt.forEach(revealArt);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.boundingClientRect.width === 0) return;
        observer.unobserve(entry.target);
        revealArt(entry.target);
      });
    }, {rootMargin: '160px 0px'});
    deferredArt.forEach(img => observer.observe(img));
    scheduleMobileArt();
    window.addEventListener('scroll', scheduleMobileArt, {passive: true});
    window.addEventListener('resize', scheduleMobileArt);
  };
  // Give the portrait the connection until the visitor starts scrolling.
  const view = desktopView.matches ? '.desktop-view' : '.compact-view';
  const portrait = document.querySelector(`${view} .hero-visual img[fetchpriority="high"]`);
  if (!portrait || portrait.complete || window.scrollY > 0) watchArt();
  else {
    portrait.addEventListener('load', watchArt, {once: true});
    portrait.addEventListener('error', watchArt, {once: true});
    window.addEventListener('scroll', watchArt, {passive: true, once: true});
  }
  // Keep native lazy loading for the remaining small assets.
  const loadImages = block => {
    block.querySelectorAll('[data-assets-pending]').forEach(scene => scene.removeAttribute('data-assets-pending'));
    block.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  };
  let imageObserver;
  let activeView;
  const watchImages = () => {
    const view = window.innerWidth >= 1280 ? '.desktop-view' : '.compact-view';
    if (view === activeView) return;
    activeView = view;
    imageObserver?.disconnect();
    const root = document.querySelector(view);
    if (typeof IntersectionObserver !== 'function') { loadImages(root); return; }
    imageObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadImages(entry.target);
        imageObserver.unobserve(entry.target);
      });
    }, {rootMargin: '600px 0px', threshold: 0});
    root.querySelectorAll(':scope > *, .feature-card, .audience-card, .founder').forEach(block => {
      if (!block.querySelector('img[loading="lazy"], [data-assets-pending]')) return;
      // Card grids are loaded card by card; long sections must not fetch every
      // image just because their heading enters the prefetch margin.
      if (block.querySelector('.feature-card, .audience-card, .founder')) return;
      imageObserver.observe(block);
    });
  };
  watchImages();
  window.addEventListener('resize', watchImages);
})();
