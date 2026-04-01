/* ============================================================================
   nav.js — Conference Navigation & Interactions
   Handles: 3-level dropdowns, mobile drawer, scroll header,
            edition nav reveal (on PASC26 click), palette toggle switch
   ============================================================================ */
(function () {
  'use strict';

  const isMobile = () => window.innerWidth < 1024;

  /* ── Dropdown Navigation ──────────────────────────────────────────────── */
  function initDropdowns() {
    document.querySelectorAll('.nav-primary, .nav-edition').forEach(nav => {
      setupDropdownsInNav(nav);
    });
    document.addEventListener('click', e => {
      document.querySelectorAll('.nav-primary, .nav-edition').forEach(nav => {
        if (!nav.contains(e.target)) closeAllInNav(nav);
      });
    });
  }

  function setupDropdownsInNav(nav) {
    nav.querySelectorAll('.menu-item-has-children').forEach(item => {
      const trigger = item.querySelector(':scope > a');
      const submenu = item.querySelector(':scope > .sub-menu');
      if (!trigger || !submenu) return;

      const id = 'dd-' + Math.random().toString(36).slice(2, 8);
      submenu.id = id;
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', id);
      submenu.setAttribute('role', 'menu');
      submenu.querySelectorAll('a').forEach(a => a.setAttribute('role', 'menuitem'));

      let timer;
      item.addEventListener('mouseenter', () => {
        if (isMobile()) return;
        clearTimeout(timer);
        closeAllInNav(nav, item);
        openItem(item, trigger, submenu);
      });
      item.addEventListener('mouseleave', () => {
        if (isMobile()) return;
        timer = setTimeout(() => closeItem(item, trigger, submenu), 160);
      });

      trigger.addEventListener('keydown', e => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          expanded ? closeItem(item, trigger, submenu) : openItem(item, trigger, submenu);
          if (!expanded) { const first = submenu.querySelector('[role="menuitem"]'); if (first) first.focus(); }
        }
        if (e.key === 'Escape') { closeItem(item, trigger, submenu); trigger.focus(); }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          openItem(item, trigger, submenu);
          const first = submenu.querySelector('[role="menuitem"]');
          if (first) first.focus();
        }
      });

      const subItems = Array.from(submenu.querySelectorAll(':scope > .menu-item > [role="menuitem"]'));
      subItems.forEach((link, i) => {
        link.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); subItems[i + 1]?.focus(); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); (i === 0 ? trigger : subItems[i - 1]).focus(); }
          if (e.key === 'Escape')    { closeItem(item, trigger, submenu); trigger.focus(); }
          if (e.key === 'Tab')       { setTimeout(() => { if (!item.contains(document.activeElement)) closeItem(item, trigger, submenu); }, 0); }
        });
      });
    });
  }

  function openItem(item, trigger, submenu)  { item.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); }
  function closeItem(item, trigger, submenu) { item.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); }
  function closeAllInNav(nav, exceptItem) {
    nav.querySelectorAll('.menu-item-has-children.is-open').forEach(item => {
      if (!exceptItem || (item !== exceptItem && !item.contains(exceptItem))) {
        const t = item.querySelector(':scope > a');
        const s = item.querySelector(':scope > .sub-menu');
        if (t && s) closeItem(item, t, s);
      }
    });
  }

  /* ── Edition Nav Reveal ───────────────────────────────────────────────
     Clicking "PASC 2026" in global nav reveals the edition-specific nav.
     Works for all 4 layout patterns: dual-bar, sidebar, mega, inline.    */
  function initEditionNavReveal() {
    const trigger = document.querySelector('[data-edition-trigger]');
    if (!trigger) return;

    // Target all possible edition containers for this layout
    const editionEls = Array.from(document.querySelectorAll(
      '.header-edition, .edition-sidebar, .edition-mega-panel, .edition-inline-nav'
    ));
    if (!editionEls.length) return;

    // Restore persisted state
    const wasOpen = sessionStorage.getItem('editionNavOpen') === 'true';
    if (wasOpen) {
      editionEls.forEach(el => el.classList.add('is-active'));
      trigger.setAttribute('aria-expanded', 'true');
      if (document.querySelector('.edition-sidebar')) document.body.classList.add('sidebar-open');
      _syncDemoBar(true);
    }

    trigger.addEventListener('click', e => {
      e.preventDefault();
      const isOpen = editionEls[0].classList.contains('is-active');
      const next   = !isOpen;

      editionEls.forEach(el => el.classList.toggle('is-active', next));
      trigger.setAttribute('aria-expanded', String(next));
      sessionStorage.setItem('editionNavOpen', String(next));

      if (document.querySelector('.edition-sidebar')) {
        document.body.classList.toggle('sidebar-open', next);
      }

      _syncDemoBar(next);
      showToast(next
        ? 'PASC 26 edition navigation is now visible'
        : 'Returned to global PASC site view'
      );
    });
  }

  function _syncDemoBar(isOpen) {
    const viewLabel = document.querySelector('[data-demo-view]');
    const btnLabel  = document.querySelector('[data-demo-btn]');
    if (viewLabel) viewLabel.textContent = isOpen ? 'Inside PASC 26 edition page' : 'Global PASC site';
    if (btnLabel)  btnLabel.textContent  = isOpen ? 'Hide edition nav' : 'Click PASC 2026 to show edition nav';
  }

  /* ── Mobile Nav Drawer ───────────────────────────────────────────────── */
  function initMobileNav() {
    const toggle  = document.querySelector('.nav-mobile-toggle');
    const drawer  = document.querySelector('.mobile-nav-drawer');
    const overlay = document.querySelector('.mobile-overlay');
    const close   = document.querySelector('.mobile-nav-close');
    if (!toggle || !drawer) return;

    const open = () => { drawer.classList.add('is-open'); overlay?.classList.add('visible'); document.body.style.overflow = 'hidden'; toggle.setAttribute('aria-expanded', 'true'); drawer.querySelector('a,button')?.focus(); };
    const shut = () => { drawer.classList.remove('is-open'); overlay?.classList.remove('visible'); document.body.style.overflow = ''; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); };

    toggle.addEventListener('click', () => drawer.classList.contains('is-open') ? shut() : open());
    close?.addEventListener('click', shut);
    overlay?.addEventListener('click', shut);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) shut(); });
    initMobileAccordion(drawer);
  }

  function initMobileAccordion(drawer) {
    drawer.querySelectorAll('.menu-item-has-children > a').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const parent  = link.parentElement;
        const submenu = parent.querySelector(':scope > .sub-menu');
        if (!submenu) return;
        const isOpen = parent.classList.contains('is-open');
        parent.parentElement?.querySelectorAll(':scope > .menu-item-has-children.is-open').forEach(sib => {
          if (sib !== parent) {
            sib.classList.remove('is-open');
            const s = sib.querySelector(':scope > .sub-menu');
            if (s) s.style.maxHeight = '0';
          }
        });
        if (isOpen) {
          parent.classList.remove('is-open');
          submenu.style.maxHeight = '0';
        } else {
          parent.classList.add('is-open');
          submenu.style.maxHeight = submenu.scrollHeight + 'px';
          setTimeout(() => { if (parent.classList.contains('is-open')) submenu.style.maxHeight = '2000px'; }, 350);
        }
      });
    });
  }

  /* ── Scroll Header (transparent → solid, used by apex) ──────────────── */
  function initScrollHeader() {
    const header = document.querySelector('.site-header--transparent');
    if (!header) return;
    let lastY = 0;
    const update = () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 80);
      header.classList.toggle('hidden', y > lastY && y > 200);
      lastY = y;
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ── Sticky Inline Edition Nav (Layout 4) ────────────────────────────
     Pins the edition nav just below the global header when scrolled past it  */
  function initStickyInlineNav() {
    const inlineNav = document.querySelector('.edition-inline-nav');
    const header    = document.querySelector('.site-header');
    if (!inlineNav || !header) return;

    const update = () => {
      if (!inlineNav.classList.contains('is-active')) {
        inlineNav.classList.remove('is-sticky');
        return;
      }
      const navRect    = inlineNav.getBoundingClientRect();
      const headerH    = header.offsetHeight;
      const shouldStick = navRect.top <= headerH;
      inlineNav.classList.toggle('is-sticky', shouldStick);
      if (shouldStick) inlineNav.style.top = headerH + 'px';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  /* ── Palette Toggle Switch ────────────────────────────────────────────
     Swaps only the edition CSS tokens; global nav colours stay unchanged  */
  function initPaletteToggle() {
    const toggle = document.getElementById('palette-toggle');
    if (!toggle) return;
    const live = document.getElementById('switcher-live');

    toggle.addEventListener('change', () => {
      const edition = toggle.checked ? 'pasc27' : 'pasc26';
      document.documentElement.setAttribute('data-edition', edition);
      if (live) live.textContent = 'Edition palette: ' + (toggle.checked ? 'B (alternate)' : 'A (default)');
    });
  }

  /* ── Demo Bar (bottom strip for client demo) ─────────────────────────── */
  function initDemoBar() {
    const bar = document.querySelector('.demo-bar');
    if (!bar) return;
    // Sync initial state
    const wasOpen = sessionStorage.getItem('editionNavOpen') === 'true';
    _syncDemoBar(wasOpen);
  }

  /* ── Toast ───────────────────────────────────────────────────────────── */
  function showToast(msg) {
    let toast = document.querySelector('.nav-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'nav-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  /* ── Smooth Anchor Scroll ────────────────────────────────────────────── */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      });
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initMobileNav();
    initScrollHeader();
    initEditionNavReveal();
    initPaletteToggle();
    initStickyInlineNav();
    initDemoBar();
    initSmoothScroll();
  });

})();
