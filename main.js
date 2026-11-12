(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cs = getComputedStyle(root);

  /* Hollerith code. rows: 0 = zone 12, 1 = zone 11, 2 = digit 0, 3..11 = digits 1..9 */
  function hollerith(ch) {
    ch = String(ch).toUpperCase();
    var d = function (n) { return 2 + n; };
    var c = ch.charCodeAt(0);
    if (ch >= '0' && ch <= '9') return [d(+ch)];
    if (ch >= 'A' && ch <= 'I') return [0, d(c - 64)];
    if (ch >= 'J' && ch <= 'R') return [1, d(c - 73)];
    if (ch >= 'S' && ch <= 'Z') return [2, d(c - 81)];
    switch (ch) {
      case '&': return [0];
      case '-': return [1];
      case '.': return [0, d(3), d(8)];
      case ',': return [2, d(3), d(8)];
      case '/': return [2, d(1)];
      case '@': return [d(4), d(8)];
    }
    return [];
  }
  window.__hollerith = hollerith;

  function model(punch, seq) {
    var chars = String(punch || '').toUpperCase().slice(0, 72).split('');
    var holes = [];
    chars.forEach(function (ch, i) {
      hollerith(ch).forEach(function (r) { holes.push([i, r]); });
    });
    var s = ('00000000' + String(seq || '').replace(/\D/g, '')).slice(-8);
    for (var i = 0; i < 8; i++) holes.push([72 + i, 2 + Number(s[i])]);
    return { chars: chars, holes: holes };
  }

  /* Each strip gets an svg mask (holes are transparent) and an svg print (the title line). viewBox 800x140. */
  function uri(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function buildStrip(el, ink) {
    var m = model(el.getAttribute('data-punch'), el.getAttribute('data-seq'));
    var p = 'M0 0H800V140H0Z';
    m.holes.forEach(function (h) {
      var x = h[0] * 10 + 2.25, y = 25 + h[1] * 9;
      p += 'M' + (x + 1) + ' ' + y + 'h3.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-3.5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z';
    });
    var mask = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 140" preserveAspectRatio="none"><path fill-rule="evenodd" d="' + p + '"/></svg>';

    var xs = [], tx = '';
    m.chars.forEach(function (ch, i) {
      if (ch !== ' ') { xs.push(i * 10 + 5); tx += ch; }
    });
    // svg used as an image cannot load page fonts, so the printed line uses a system stack
    var f = ' font-family="Arial Narrow, Helvetica Neue, Arial, sans-serif" text-anchor="middle" fill="' + ink + '"';
    var print = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 140"><text x="' + xs.join(' ') + '" y="14" font-size="9" font-weight="700"' + f + '>' + esc(tx) + '</text></svg>';

    el.style.setProperty('--mask', uri(mask));
    el.style.setProperty('--print', uri(print));
  }

  function motion() {
    if (reduce || !window.gsap) return;
    var hasST = !!window.ScrollTrigger;
    if (hasST) gsap.registerPlugin(ScrollTrigger);

    /* first screen: name and intro rise, then the card slides in and settles */
    var tl = gsap.timeline();
    tl.fromTo('[data-rise]', { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 });
    tl.from('#card-fallback', { y: 90, rotation: -9, opacity: 0, duration: 1.3, ease: 'expo.out' }, 0.25);

    if (!hasST) return;

    /* every card tilts a little, then lies flat as it reaches the middle of the screen */
    var tilt = [-1.2, 0.9, -0.8, 1.1, -1, 0.7, -0.9, 1, -0.6];
    var cards = gsap.utils.toArray('.card');
    var wide = window.matchMedia('(min-width: 800px)').matches;
    cards.forEach(function (card, i) {
      gsap.set(card, { transformOrigin: '50% 0%' });
      /* on wide screens the cards pile up; the one being covered shrinks and dims */
      var next = cards[i + 1];
      if (wide && next) {
        var nextTop = parseFloat(getComputedStyle(next).top) || 0;
        gsap.fromTo(card, { scale: 1, filter: 'brightness(1)' }, {
          scale: 0.94, filter: 'brightness(0.8)', ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 60%', end: 'top ' + nextTop + 'px', scrub: true }
        });
      }
      gsap.fromTo(card, { rotation: tilt[i % tilt.length] }, {
        rotation: 0, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'top 45%', scrub: true }
      });
      gsap.from(card.querySelectorAll('h2, h3, .card-text > *'), {
        y: 28, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: card, start: 'top 80%', once: true }
      });
    });

  }

  function boot() {
    var ink = cs.getPropertyValue('--ink').trim() || '#12141c';
    Array.prototype.forEach.call(document.querySelectorAll('.strip[data-punch][data-seq]'), function (el) {
      buildStrip(el, ink);
    });
    root.classList.add('is-ready');
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
      motion();
      if (window.ScrollTrigger && !reduce) window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
