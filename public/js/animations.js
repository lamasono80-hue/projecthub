/**
 * ProjectHub — animations.js
 * Scoped Scroll-reveal (IntersectionObserver) + Dynamic MutationObserver + Button ripple
 * 
 * DESIGN PRINCIPLES:
 * - Event-driven & scoped: No setInterval polling, no global DOM flooding.
 * - Dynamic support: Observes newly inserted cards/tasks automatically.
 * - Accessibility: Honors prefers-reduced-motion immediately.
 * - Deduplication: Prevents re-animating or double-observing nodes.
 */
(function () {
  'use strict';

  // Prevent multiple executions if script is loaded twice
  if (window.__PH_ANIMATIONS_INITIALIZED__) return;
  window.__PH_ANIMATIONS_INITIALIZED__ = true;

  let _revealObserver = null;
  let _dynamicObserver = null;
  let _navbarObserver = null;

  const AUTO_REVEAL_CONFIG = [
    { sel: '.feature-card',    attr: '' },
    { sel: '.stat-card',       attr: '' },
    { sel: '.choice-card',     attr: '' },
    { sel: '.project-card',    attr: '' },
    { sel: '.kanban-task-card',attr: '' },
    { sel: '.form-section',    attr: '' },
    { sel: '.step-content',    attr: '' },
    { sel: '.testimonial-card',attr: '' },
    { sel: 'section > .container > .text-center', attr: 'scale' },
    { sel: '.col-lg-6:first-child .hero-section', attr: 'left' }
  ];

  const DYNAMIC_SELECTOR = [
    '.feature-card',
    '.stat-card',
    '.choice-card',
    '.project-card',
    '.kanban-task-card',
    '.form-section',
    '.step-content',
    '.testimonial-card',
    '[data-reveal]'
  ].join(', ');

  /* ─── ACCESSIBILITY HELPER ───────────────────────────────────── */
  function isReducedMotion() {
    return typeof window !== 'undefined' &&
           window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ─── 1. INTERSECTION OBSERVER SINGLETON ─────────────────────── */
  function getRevealObserver() {
    if (_revealObserver) return _revealObserver;
    _revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const target = entry.target;
          target.classList.add('is-visible');
          target.setAttribute('data-animated', 'true');

          // Free GPU layer memory after transition completes
          const onTransitionEnd = () => {
            target.style.willChange = 'auto';
            target.removeEventListener('transitionend', onTransitionEnd);
          };
          target.addEventListener('transitionend', onTransitionEnd, { once: true });

          obs.unobserve(target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.08 });
    return _revealObserver;
  }

  function observeElement(el, attr = '') {
    if (!el || el.nodeType !== 1) return;
    if (el.classList.contains('is-visible') || el.getAttribute('data-animated') === 'true') return;

    if (isReducedMotion() || el.closest('.no-stagger') || el.closest('#projects-grid')) {
      el.classList.add('is-visible');
      el.setAttribute('data-animated', 'true');
      return;
    }

    if (!el.hasAttribute('data-reveal') && !el.closest('[data-reveal]')) {
      el.setAttribute('data-reveal', attr);
    }

    // Hardware accelerate element right before scrolling into view
    el.style.willChange = 'transform, opacity';
    getRevealObserver().observe(el);
  }

  /* ─── 2. STATIC SCROLL REVEAL ────────────────────────────────── */
  function initScrollReveal() {
    if (isReducedMotion()) {
      document.querySelectorAll('[data-reveal], [data-reveal-stagger], ' + DYNAMIC_SELECTOR)
        .forEach(el => {
          el.classList.add('is-visible');
          el.setAttribute('data-animated', 'true');
        });
      return;
    }

    // Auto-inject data-reveal on initial static elements
    AUTO_REVEAL_CONFIG.forEach(({ sel, attr }) => {
      document.querySelectorAll(sel).forEach(el => observeElement(el, attr));
    });

    // Stagger grids (exclude .no-stagger containers)
    const staggerSels = ['.row.g-4:not(.no-stagger)', '.row.g-3:not(.no-stagger)'];
    staggerSels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.hasAttribute('data-reveal-stagger') &&
            el.querySelectorAll('.card, .feature-card, .stat-card, .project-card, .kanban-task-card').length > 1) {
          el.setAttribute('data-reveal-stagger', '');
        }
        if (!el.getAttribute('data-animated')) {
          getRevealObserver().observe(el);
        }
      });
    });

    // Observe any explicit data-reveal tags
    document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach(el => {
      if (!el.getAttribute('data-animated')) {
        getRevealObserver().observe(el);
      }
    });
  }

  /* ─── 3. DYNAMIC MUTATION OBSERVER (SCOPED) ──────────────────── */
  function initDynamicObserver() {
    if (_dynamicObserver || typeof MutationObserver === 'undefined') return;

    // Scope to main content area to avoid monitoring extraneous script/head changes
    const rootScope = document.querySelector('main, #main-content, .main-content') || document.body;
    if (!rootScope) return;

    _dynamicObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'childList') continue;
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          // Check if added node itself matches
          if (node.matches && node.matches(DYNAMIC_SELECTOR)) {
            observeElement(node);
          }

          // Check if children of added node match
          if (node.querySelectorAll) {
            const children = node.querySelectorAll(DYNAMIC_SELECTOR);
            for (let i = 0; i < children.length; i++) {
              observeElement(children[i]);
            }
          }
        }
      }
    });

    _dynamicObserver.observe(rootScope, { childList: true, subtree: true });
  }

  /* ─── 4. BUTTON RIPPLE ──────────────────────────────────────── */
  function initRipple() {
    document.addEventListener('click', function (e) {
      if (isReducedMotion()) return;
      const btn = e.target.closest('.btn');
      if (!btn) return;

      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple-effect';
      Object.assign(ripple.style, {
        width:  size + 'px',
        height: size + 'px',
        left:   x    + 'px',
        top:    y    + 'px',
      });

      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* ─── 5. SMOOTH NAV ACTIVE (EVENT-DRIVEN) ─────────────────────── */
  function initNavActive() {
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.navbar a.nav-link, .navbar a.dropdown-item').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href === page || (page === '' && href === 'index.html')) {
        a.classList.add('active', 'fw-semibold');
        a.style.color = 'var(--primary, #4F46E5)';
      }
    });
  }

  function setupNavbarWatcher() {
    const placeholder = document.getElementById('navbar-placeholder');
    if (!placeholder) {
      initNavActive();
      return;
    }

    if (placeholder.querySelector('nav')) {
      initNavActive();
      return;
    }

    if (typeof MutationObserver !== 'undefined' && !_navbarObserver) {
      _navbarObserver = new MutationObserver((mutations, obs) => {
        if (placeholder.querySelector('nav')) {
          initNavActive();
          obs.disconnect();
          _navbarObserver = null;
        }
      });
      _navbarObserver.observe(placeholder, { childList: true, subtree: true });
      // Safety timeout: auto disconnect after 5 seconds
      setTimeout(() => {
        if (_navbarObserver) {
          _navbarObserver.disconnect();
          _navbarObserver = null;
        }
      }, 5000);
    }
  }

  /* ─── 6. STEP PANEL TRANSITIONS ─────────────────────────────── */
  window.animateStepChange = function (outPanel, inPanel, callback) {
    if (!outPanel || !inPanel) { if (callback) callback(); return; }
    if (isReducedMotion()) {
      outPanel.classList.add('d-none');
      inPanel.classList.remove('d-none');
      if (callback) callback();
      return;
    }
    outPanel.classList.add('leaving');
    setTimeout(() => {
      outPanel.classList.add('d-none');
      outPanel.classList.remove('leaving');
      inPanel.classList.remove('d-none');
      inPanel.classList.add('entering');
      setTimeout(() => {
        inPanel.classList.remove('entering');
        if (callback) callback();
      }, 320);
    }, 220);
  };

  /* ─── 7. COUNT-UP FOR STAT COUNTERS (60FPS rAF) ─────────────── */
  function initCounters() {
    const counters = document.querySelectorAll('.stat-counter[data-target]');
    if (!counters.length) return;

    if (isReducedMotion()) {
      counters.forEach(el => {
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        el.innerText = target.toLocaleString('vi-VN');
      });
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseInt(el.getAttribute('data-target'), 10) || 0;
        const startTime = performance.now();
        const duration = 1200;

        function updateCounter(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out cubic: 1 - Math.pow(1 - progress, 3)
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(easeOut * target);
          el.innerText = current.toLocaleString('vi-VN');
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            el.innerText = target.toLocaleString('vi-VN');
          }
        }

        requestAnimationFrame(updateCounter);
        obs.unobserve(el);
      });
    }, { threshold: 0.3 });

    counters.forEach(el => io.observe(el));
  }

  /* ─── PUBLIC API ────────────────────────────────────────────── */
  window.ProjectHubAnimations = {
    observe: observeElement,
    refresh: function () {
      initScrollReveal();
    },
    isReducedMotion: isReducedMotion
  };

  /* ─── INIT ──────────────────────────────────────────────────── */
  function init() {
    initRipple();
    initCounters();
    setupNavbarWatcher();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initScrollReveal();
        initDynamicObserver();
      }, { once: true });
    } else {
      initScrollReveal();
      initDynamicObserver();
    }
  }

  init();
})();
