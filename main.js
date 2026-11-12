(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ALIAS = { java: 'openjdk', gemini: 'googlegemini', sklearn: 'scikitlearn', css: 'css', css3: 'css', html: 'html5' };

  /* logo rows: [data-icons="react,fastapi"] becomes inline svg, unknown slugs are skipped */
  function icons() {
    var map = window.ICONS || {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-icons]'), function (ul) {
      ul.getAttribute('data-icons').split(',').forEach(function (raw) {
        var key = raw.trim();
        var ic = map[ALIAS[key] || key];
        if (!ic) return;
        var li = document.createElement('li');
        li.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" role="img" aria-label="' + ic.title +
          '"><title>' + ic.title + '</title><path d="' + ic.path + '" fill="currentColor"/></svg>';
        ul.appendChild(li);
      });
    });
  }

  function motion() {
    if (reduce || !window.gsap) return;
    var hasST = !!window.ScrollTrigger;
    if (hasST) gsap.registerPlugin(ScrollTrigger);

    /* first screen: name lines rise out of their clipped wrappers, then intro and buttons */
    gsap.fromTo('[data-rise]', { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 });

    if (!hasST) return;

    var cards = gsap.utils.toArray('.card');
    var wide = window.matchMedia('(min-width: 800px)').matches;
    var tilt = [-1.2, 0.9, -0.8, 1.1, -1, 0.7, -0.9, 1, -0.6];

    cards.forEach(function (card, i) {
      gsap.set(card, { transformOrigin: '50% 0%' });

      /* arrives with a small tilt and lies flat by the time it is mid-screen */
      gsap.fromTo(card, { rotation: tilt[i % tilt.length] }, {
        rotation: 0, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 45%', scrub: true }
      });

      /* on wide screens cards pile up; the one being covered shrinks and dims */
      var next = cards[i + 1];
      if (wide && next) {
        var nextTop = parseFloat(getComputedStyle(next).top) || 0;
        gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, {
          scale: 0.94, filter: 'brightness(0.8)', ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 60%', end: 'top ' + nextTop + 'px', scrub: true }
        });
      }

      /* parts of the card rise in one after another, once */
      gsap.from(card.querySelectorAll('h2, h3, .card-text > *, .statement, .skills > div, .now, .contact-list li'), {
        y: 28, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07,
        scrollTrigger: { trigger: card, start: 'top 80%', once: true }
      });
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  function boot() {
    icons();
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]).then(motion);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
