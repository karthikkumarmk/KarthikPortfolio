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

      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        card.addEventListener('pointermove', function (event) {
          var rect = card.getBoundingClientRect();
          var x = (event.clientX - rect.left) / rect.width - 0.5;
          var y = (event.clientY - rect.top) / rect.height - 0.5;
          gsap.to(card, { rotationY: x * 1.8, rotationX: y * -1.8, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
        });
        card.addEventListener('pointerleave', function () {
          gsap.to(card, { rotationY: 0, rotationX: 0, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
        });
      }
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }

  /* Six traced keyframes from the reference clip, one <svg> each so the browser can
     composite them. The loop keeps the clip's 6 x 0.24s timing and dissolves between
     frames instead of cutting. */
  function character() {
    var host = document.getElementById('character');
    if (!host || !window.fetch || !window.DOMParser) return;
    fetch('assets/character-animation.svg').then(function (r) {
      if (!r.ok) throw new Error('character asset');
      return r.text();
    }).then(function (text) {
      var NS = 'http://www.w3.org/2000/svg';
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      var frames = [];
      for (var i = 1; i <= 6; i++) {
        var clip = doc.getElementById('c' + i), group = doc.getElementById('f' + i);
        if (!clip || !group) throw new Error('character frame ' + i);
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 736 736');
        svg.setAttribute('aria-hidden', 'true');
        var defs = document.createElementNS(NS, 'defs');
        defs.appendChild(document.importNode(clip, true));
        svg.appendChild(defs);
        svg.appendChild(document.importNode(group, true));
        host.appendChild(svg);
        frames.push(svg);
      }
      host.setAttribute('role', 'img');
      if (reduce || !window.gsap) { frames[3].classList.add('on'); return; }

      var STEP = 0.24, FADE = 0.12, z = 1;
      gsap.set(frames, { opacity: 0 });
      gsap.set(frames[0], { opacity: 1 });
      var tl = gsap.timeline({ repeat: -1, paused: true });
      for (var k = 0; k < 6; k++) {
        (function (cur, nxt, at) {
          tl.call(function () { frames[nxt].style.zIndex = ++z; }, null, at)
            .to(frames[nxt], { opacity: 1, duration: FADE, ease: 'sine.inOut' }, at)
            .to(frames[cur], { opacity: 0, duration: FADE * 0.4, ease: 'none' }, at + FADE * 0.6);
        })(k, (k + 1) % 6, (k + 1) * STEP - FADE);
      }
      tl.play();
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (entries) {
          entries[0].isIntersecting ? tl.play() : tl.pause();
        }).observe(host);
      }
    }).catch(function () { /* hero still reads without the illustration */ });
  }

  function contactForm() {
    var form = document.getElementById('contact-form');
    var status = document.getElementById('form-status');
    if (!form || !status) return;
    var button = form.querySelector('button[type="submit"]');
    var lastSuccessfulPayload = '';

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!form.reportValidity() || button.disabled) return;

      var data = new FormData(form);
      var payload = {
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        message: String(data.get('message') || '').trim(),
        website: String(data.get('website') || '')
      };
      var fingerprint = JSON.stringify(payload);
      if (fingerprint === lastSuccessfulPayload) {
        status.textContent = 'This message has already been sent.';
        return;
      }

      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      status.textContent = 'Sending your message…';
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);

      try {
        var response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: fingerprint,
          signal: controller.signal
        });
        if (!response.ok) {
          status.textContent = response.status === 422
            ? 'Please check the form and try again.'
            : 'The message could not be sent. Please try again shortly.';
          return;
        }
        lastSuccessfulPayload = fingerprint;
        form.reset();
        status.textContent = 'Your message was accepted for delivery. Thank you.';
      } catch (error) {
        status.textContent = error.name === 'AbortError'
          ? 'Sending took too long. Please try again.'
          : 'Could not reach the server. Check your connection and try again.';
      } finally {
        clearTimeout(timeout);
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }

  function boot() {
    icons();
    character();
    contactForm();
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 1200); })]).then(motion);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
