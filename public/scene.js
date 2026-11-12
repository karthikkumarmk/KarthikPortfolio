(function () {
  'use strict';

  var canvas = document.getElementById('scene');
  if (!canvas || !window.THREE) return;
  var THREE = window.THREE;

  var narrow = window.innerWidth < 700;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !narrow });
    if (!renderer.getContext()) return;
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(narrow ? 62 : 56, 1, 0.1, 200);
  var cs = getComputedStyle(document.documentElement);
  var seed = 0x4b415254;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  /* any CSS colour the page declares -> 'rgb(r,g,b)' */
  var probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  var pctx = probe.getContext('2d', { willReadFrequently: true });
  function col(name, fallback) {
    var v = cs.getPropertyValue(name).trim() || fallback;
    pctx.clearRect(0, 0, 1, 1);
    pctx.fillStyle = '#000';
    pctx.fillStyle = v;
    pctx.fillRect(0, 0, 1, 1);
    var d = pctx.getImageData(0, 0, 1, 1).data;
    return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
  }

  /* ---------- decorative code, six short generic snippets ---------- */
  var SNIPPETS = [
    ['from fastapi import FastAPI, Depends', 'from pydantic import BaseModel', '', 'class Quote(BaseModel):', '    sku: str', '    demand: float', '    price: float', '', 'app = FastAPI()', '', '@app.post("/quote")', 'async def quote(body: Quote, db=Depends(get_db)):', '    row = await db.fetch_one(', '        "SELECT base FROM items WHERE sku = :s",', '        {"s": body.sku},', '    )', '    if row is None:', '        raise HTTPException(404, "unknown sku")', '    return {"price": round(row["base"] * 1.04, 2)}'],
    ['import { useEffect, useState } from "react";', '', 'export function Tasks({ userId }) {', '  const [items, setItems] = useState([]);', '  const [error, setError] = useState(null);', '', '  useEffect(() => {', '    const ctrl = new AbortController();', '    fetch(`/api/tasks?user=${userId}`, {', '      signal: ctrl.signal,', '    })', '      .then((r) => r.json())', '      .then(setItems)', '      .catch(setError);', '    return () => ctrl.abort();', '  }, [userId]);', '', '  return items.map((t) => <Row key={t.id} {...t} />);', '}'],
    ['def update(q, state, action, reward, nxt,', '           lr=0.1, gamma=0.95):', '    best_next = max(q[nxt])', '    target = reward + gamma * best_next', '    q[state][action] += lr * (target - q[state][action])', '    return q', '', 'for episode in range(5000):', '    s = env.reset()', '    done = False', '    while not done:', '        a = pick(q, s, epsilon)', '        s2, r, done = env.step(a)', '        q = update(q, s, a, r, s2)', '        s = s2', '    epsilon = max(0.05, epsilon * 0.999)'],
    ['SELECT c.name,', '       COUNT(m.id) AS meetings,', '       MAX(m.starts_at) AS last_seen', 'FROM mentors c', 'JOIN meetings m ON m.mentor_id = c.id', "WHERE m.status = 'confirmed'", 'GROUP BY c.name', 'HAVING COUNT(m.id) > 2', 'ORDER BY meetings DESC', 'LIMIT 20;'],
    ['import tensorflow as tf', '', 'model = tf.keras.Sequential([', '    tf.keras.layers.Input(shape=(24,)),', '    tf.keras.layers.Dense(64, activation="relu"),', '    tf.keras.layers.Dropout(0.2),', '    tf.keras.layers.Dense(32, activation="relu"),', '    tf.keras.layers.Dense(1),', '])', '', 'model.compile(optimizer="adam", loss="mse")', 'model.fit(x_train, y_train, epochs=30,', '          validation_split=0.2, batch_size=64)'],
    ['from celery import Celery', '', 'app = Celery("worker",', '             broker="redis://localhost:6379/0")', '', '@app.task(bind=True, max_retries=3)', 'def send_digest(self, user_id):', '    try:', '        items = load_items(user_id)', '        mail.send(user_id, render(items))', '    except ConnectionError as exc:', '        raise self.retry(exc=exc, countdown=30)']
  ];
  var HL = [10, 23, 35, 47, 17, 29]; /* one highlighted line per texture */
  var LINES = 60;

  var S = narrow ? 0.5 : 1;
  var TW = 1024 * S, TH = 2048 * S, FONT = 26 * S, LH = TH / LINES;
  var codeCanvases = SNIPPETS.map(function () {
    var c = document.createElement('canvas');
    c.width = TW; c.height = TH;
    return c;
  });

  function drawCode(colors) {
    codeCanvases.forEach(function (c, k) {
      var ctx = c.getContext('2d');
      var src = SNIPPETS[k];
      ctx.clearRect(0, 0, TW, TH);
      ctx.font = FONT + 'px Menlo, Consolas, monospace';
      ctx.textBaseline = 'middle';
      var hl = HL[k];
      for (var i = 0; i < LINES; i++) {
        var n = src.length + 1; /* one blank line between repeats */
        var line = i % n === src.length ? '' : src[i % n];
        if (i === hl && !line) hl++;
        var hot = i === hl;
        ctx.globalAlpha = hot ? 0.85 : 1;
        ctx.fillStyle = hot ? colors.accent : colors.code;
        ctx.fillText(line, 24 * S, (i + 0.5) * LH);
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ---------- logos ---------- */
  var icons = window.ICONS && typeof window.ICONS === 'object' ? window.ICONS : {};
  var slugs = Object.keys(icons);
  var iconCanvases = {};
  function drawIcons(logo) {
    slugs.forEach(function (slug) {
      var c = iconCanvases[slug] || (iconCanvases[slug] = document.createElement('canvas'));
      c.width = c.height = 256;
      var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, 256, 256);
      ctx.setTransform(256 / 24, 0, 0, 256 / 24, 0, 0);
      ctx.fillStyle = logo;
      try { ctx.fill(new Path2D(icons[slug].path)); } catch (e) { /* bad path: leave blank */ }
    });
  }

  /* ---------- build ---------- */
  var L = 170; /* tunnel length; objects that fall behind the camera jump forward by this */
  var panelGeo = new THREE.PlaneGeometry(14, 7);
  var panels = [], sprites = [], textures = [], materials = [];
  var anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  var baseTex = codeCanvases.map(function (c) {
    var t = new THREE.CanvasTexture(c);
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  });

  var N = narrow ? 14 : 28;
  for (var i = 0; i < N; i++) {
    var k = i % SNIPPETS.length;
    var tex = baseTex[k].clone(); /* clones share one image, so one GPU upload per snippet */
    tex.repeat.set(1, 0.25);
    tex.offset.y = Math.random();
    tex.needsUpdate = true;
    var mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.32,
      roughness: 0.72,
      metalness: 0.08,
      transparent: true,
      alphaTest: 0.015,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    var p = new THREE.Mesh(panelGeo, mat);
    var z = -6 - (i + rnd() * 0.6) * (164 / N);
    var side = i % 5; /* 0..2 walls, 3 ceiling, 4 floor */
    if (side < 3) {
      var s = i % 2 ? 1 : -1;
      p.position.set(s * (5.5 + rnd() * 3.5), (rnd() - 0.5) * 3, z);
      p.rotation.y = -s * (Math.PI / 2 - 0.15);
    } else {
      var up = side === 3 ? 1 : -1;
      p.position.set((rnd() - 0.5) * 8, up * (4.5 + rnd() * 2), z);
      p.rotation.x = up * (Math.PI / 2);
    }
    p.userData = { speed: 0.04 + rnd() * 0.1, wrapAt: 8 };
    scene.add(p);
    panels.push(p); textures.push(tex); materials.push(mat);
  }

  var iconTex = {}, iconMat = {};
  drawIcons('#888');
  slugs.forEach(function (slug) {
    var t = new THREE.CanvasTexture(iconCanvases[slug]);
    t.colorSpace = THREE.SRGBColorSpace;
    iconTex[slug] = t;
    iconMat[slug] = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  });
  var copies = [];
  slugs.forEach(function (slug) { copies.push(slug, slug); });
  for (var ci = copies.length - 1; ci > 0; ci--) {
    var cj = Math.floor(rnd() * (ci + 1));
    var tmp = copies[ci]; copies[ci] = copies[cj]; copies[cj] = tmp;
  }
  copies.forEach(function (slug, j) {
    var sp = new THREE.Sprite(iconMat[slug].clone());
    var size = 1.4 + rnd() * 0.7;
    var sx = rnd() < 0.5 ? -1 : 1;
    var bx = sx * (2.5 + rnd() * 5.5);
    sp.scale.set(size, size, 1);
    sp.position.set(bx, (rnd() - 0.5) * 8, -8 - (j + rnd() * 0.8) * (162 / copies.length));
    /* about one in six drifts toward the middle of the corridor and back */
    sp.userData = { bx: bx, by: sp.position.y, ph: rnd() * 6.28, near: rnd() < 0.17, wrapAt: 4 };
    scene.add(sp);
    sprites.push(sp);
  });

  scene.fog = new THREE.Fog(0x000000, 8, 110);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x243247, 0.7));
  var cameraLight = new THREE.PointLight(0x78a7ff, 14, 28, 2);
  cameraLight.position.set(0, 0, -4);
  cam.add(cameraLight);
  scene.add(cam);

  function applyTheme() {
    var colors = { code: col('--code', '#2c3039'), accent: col('--accent', '#f3d34a') };
    scene.fog.color.set(col('--ground', '#0c0d10'));
    drawCode(colors);
    textures.forEach(function (t) { t.needsUpdate = true; });
    drawIcons(col('--logo', '#6f7685'));
    slugs.forEach(function (slug) { iconTex[slug].needsUpdate = true; });
  }
  applyTheme();

  /* ---------- size ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  resize();

  /* ---------- loop ---------- */
  var px = 0, py = 0, speed = 9, sv = 0, lastY = window.pageYOffset, last = 0, raf = 0, first = true;
  function onPointer(e) {
    px = (e.clientX / window.innerWidth) * 2 - 1;
    py = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function draw(dt, t) {
    var y = window.pageYOffset;
    var safeDt = Math.max(dt, 1 / 120);
    sv += ((y - lastY) / safeDt - sv) * Math.min(1, dt * 8);
    lastY = y;
    var target = 9 + 30 * Math.min(1, Math.abs(sv) / 2500);
    speed += (target - speed) * Math.min(1, dt * 4);
    cam.position.z -= speed * dt;
    cam.position.x += (px * 0.4 - cam.position.x) * Math.min(1, dt * 3);
    cam.position.y += (-py * 0.4 - cam.position.y) * Math.min(1, dt * 3);
    cam.rotation.z = Math.max(-1, Math.min(1, sv / 3000)) * 0.03;
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var progress = y / maxScroll;
    cam.rotation.y += ((progress - 0.5) * 0.035 - cam.rotation.y) * Math.min(1, dt * 2);

    var flow = 1 + (speed - 9) / 20;
    panels.forEach(function (p, n) {
      if (p.position.z > cam.position.z + p.userData.wrapAt) p.position.z -= L;
      textures[n].offset.y -= p.userData.speed * flow * dt;
    });
    sprites.forEach(function (sp) {
      var u = sp.userData;
      if (sp.position.z > cam.position.z + u.wrapAt) sp.position.z -= L;
      /* fade logos out as they come close so none ever fills the screen */
      sp.material.opacity = Math.max(0, Math.min(1, (cam.position.z - sp.position.z - 14) / 16));
      sp.position.y = u.by + Math.sin(t * 0.8 + u.ph) * 0.25;
      sp.position.x = u.near ? u.bx * (1 - 0.35 * (0.5 + 0.5 * Math.sin(t * 0.4 + u.ph))) : u.bx;
    });
    renderer.render(scene, cam);
  }

  function frame(now) {
    raf = 0;
    if (document.hidden) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    draw(dt, now / 1000);
    if (first) { first = false; window.__sceneReady = true; }
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function onTheme() { applyTheme(); if (reduce) renderer.render(scene, cam); }
  function onResize() { resize(); if (reduce) renderer.render(scene, cam); }
  window.addEventListener('themechange', onTheme);
  window.addEventListener('resize', onResize);

  if (reduce) {
    renderer.render(scene, cam);
    window.__sceneReady = true;
  } else {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', kick);
    kick();
  }

  window.addEventListener('pagehide', function () {
    cancelAnimationFrame(raf);
    window.removeEventListener('themechange', onTheme);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', kick);
    panelGeo.dispose();
    materials.forEach(function (m) { m.dispose(); });
    sprites.forEach(function (sp) { sp.material.dispose(); });
    textures.forEach(function (t) { t.dispose(); });
    baseTex.forEach(function (t) { t.dispose(); });
    slugs.forEach(function (s) { iconMat[s].dispose(); iconTex[s].dispose(); });
    renderer.dispose();
  });
})();
