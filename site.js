(() => {
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
  document.querySelectorAll('.hero-visual .f45 img, .hero-visual .f217 img').forEach(img => {
    const loaded = () => {
      img.classList.remove('image-failed');
      img.closest('.f45, .f217').style.backgroundImage = 'none';
    };
    img.addEventListener('load', loaded);
    const failed = () => {
      img.classList.add('image-failed');
      // A new responsive candidate can fail after a smaller one has loaded.
      // Restore the embedded portrait in that case as well.
      img.closest('.f45, .f217').style.backgroundImage = '';
    };
    img.addEventListener('error', failed);
    if (img.complete) {
      if (img.naturalWidth) loaded();
      else failed();
    }
  });
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(entries => entries.forEach(entry => resize(entry.target)));
    scenes.forEach(scene => observer.observe(scene));
  } else {
    window.addEventListener('resize', () => scenes.forEach(resize));
  }
  document.querySelectorAll('.faq-list').forEach(list => {
    list.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        list.querySelectorAll('.faq-item[open]').forEach(other => {
          if (other !== item) other.open = false;
        });
      });
    });
  });
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#mobile-menu');
  const closeMenu = () => {
    if (!menu || !toggle) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
  };
  toggle?.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
    toggle.setAttribute('aria-label', menu.hidden ? 'Открыть меню' : 'Закрыть меню');
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu && !menu.hidden) {
      closeMenu();toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link) {
      link.classList.add('is-pressed');
      setTimeout(() => link.classList.remove('is-pressed'), 700);
      closeMenu();
    } else if (menu && !menu.hidden && !event.target.closest('.site-header')) closeMenu();
  });
  window.addEventListener('resize', closeMenu);
  // Every image has a real URL in HTML. Native lazy loading still works without
  // JavaScript; this observer additionally wakes whole layered illustrations
  // before scrolling to them, including Safari's transformed image layers.
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
