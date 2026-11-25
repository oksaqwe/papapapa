"use strict";
(function () {
  const { Engine, Render, Runner, Common, MouseConstraint, Mouse, Composite, Bodies, Body } = Matter;
  const W = 512;
  const FS = window.FACES || {};
  for (let n = 1; n <= 10; n++) if (!FS[n]) FS[n] = "Face" + n + ".png";
  const faces = Object.keys(FS).map(Number);
  const HEART_D = "M384,46.469c-70.688,0-128,57.313-128,128.016c0-70.703-57.313-128.016-128-128.016S0,103.781,0,174.484c0,66.484,31.313,193.391,218.563,276.234c11.844,5.25,35.703,14.469,35.703,14.469c0.547,0.219,1.141,0.344,1.734,0.344s1.188-0.125,1.734-0.344c0,0,23.859-9.219,35.703-14.469C480.688,367.875,512,240.969,512,174.484C512,103.781,454.688,46.469,384,46.469z";
  const COLORS = ["pink", "deeppink", "deeppink", "hotpink", "hotpink", "lightpink", "magenta", "orchid"];
  const CX = 256, HEART_SCALE = 0.25, CIRCLE_R = 19, BIG_HEARTS = 2;

  //PURE-START
  function heartPoints() {
    const raw = [];
    const N = 180;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      raw.push({
        x: 16 * Math.pow(Math.sin(t), 3),
        y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
      });
    }
    const xs = raw.map(function (p) { return p.x; }), ys = raw.map(function (p) { return p.y; });
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    const s = 486 / (maxX - minX);
    return raw.map(function (p) {
      return { x: 256 + (p.x - (minX + maxX) / 2) * s, y: 256 + (p.y - (minY + maxY) / 2) * s };
    });
  }
  function polyArea(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; }
    return Math.abs(s) / 2;
  }
  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function buildWalls(pts) {
    const T = 80, walls = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      let nx = -dy / len, ny = dx / len;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (inside({ x: mx + nx * 3, y: my + ny * 3 }, pts)) { nx = -nx; ny = -ny; }
      walls.push(Bodies.rectangle(mx + (nx * T) / 2, my + (ny * T) / 2, len + 2, T, {
        isStatic: true, angle: Math.atan2(dy, dx), render: { visible: false }
      }));
    }
    return walls;
  }
  function makeHeart() {
    const o = { render: { visible: false } };
    const c1 = Bodies.circle(128, 174.5, 128, o, 40), c2 = Bodies.circle(384, 174.5, 128, o, 40);
    const tri = Bodies.fromVertices(256, 315, [[{ x: 12, y: 240 }, { x: 500, y: 240 }, { x: 256, y: 465 }]], o);
    const b = Body.create({ parts: [c1, c2, tri], restitution: 0, friction: 0, frictionStatic: 0, frictionAir: 0 });
    Body.scale(b, HEART_SCALE, HEART_SCALE);
    Body.setMass(b, 20);
    Body.setPosition(b, { x: CX, y: 300 });
    b.heartInfo = {
      w: b.bounds.max.x - b.bounds.min.x,
      h: b.bounds.max.y - b.bounds.min.y,
      dx: (b.bounds.min.x + b.bounds.max.x) / 2 - b.position.x,
      dy: (b.bounds.min.y + b.bounds.max.y) / 2 - b.position.y
    };
    return b;
  }
  //PURE-END

  function start() {
    const engine = Engine.create(), world = engine.world;
    engine.gravity.scale = 0; engine.gravity.x = 0; engine.gravity.y = 0;
    const render = Render.create({
      element: document.body, engine: engine,
      options: { width: W, height: W, wireframes: false, background: "transparent", pixelRatio: 1 }
    });
    Runner.run(Runner.create(), engine);
    const poly = heartPoints();
    Composite.add(world, buildWalls(poly));
    const CY = 256 - 14;
    const COUNT = Math.round(((polyArea(poly) - BIG_HEARTS * 9400) * 0.72) / (Math.PI * CIRCLE_R * CIRCLE_R));
    const ctex = {}, urls = {}, photoCircles = [];
    let loaded = 0;
    function applyBubbles() {
      const ok = faces.filter(function (k) { return urls[k]; });
      if (!ok.length) return;
      const items = [];
      document.querySelectorAll("img[data-face]").forEach(function (img) {
        const b = img.parentNode;
        items.push({ img: img, x: b.offsetLeft + b.offsetWidth / 2, y: b.offsetTop + b.offsetHeight / 2, face: 0 });
      });
      const area = document.querySelector(".bubbles");
      const lim = 0.3 * Math.min(area.offsetWidth, area.offsetHeight);
      const cnt = {};
      ok.forEach(function (k) { cnt[k] = 0; });
      items.forEach(function (it) {
        const used = {};
        items.forEach(function (o) {
          if (o.face && Math.hypot(o.x - it.x, o.y - it.y) < lim) used[o.face] = 1;
        });
        const opts = ok.filter(function (k) { return !used[k]; });
        const pool = opts.length ? opts : ok;
        pool.sort(function (a, b) { return cnt[a] - cnt[b]; });
        it.face = pool[0]; cnt[it.face]++;
        it.img.dataset.face = it.face;
        it.img.src = urls[it.face];
      });
    }

    // photo hearts
    const tex = {}, hearts = [];
    const HP = new Path2D(HEART_D);
    faces.forEach(function (k) {
      const im = new Image();
      im.onload = function () {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 420;
        const x = c.getContext("2d");
        x.translate(0, -46.469);
        x.clip(HP);
        try { x.filter = "blur(14px)"; } catch (err) {}
        x.drawImage(im, -70, -30, 652, 652);
        x.filter = "none";
        const fc = document.createElement("canvas");
        fc.width = fc.height = 400;
        const fx = fc.getContext("2d");
        fx.drawImage(im, 0, 0, 400, 400);
        const gr = fx.createRadialGradient(200, 200, 135, 200, 200, 200);
        gr.addColorStop(0, "rgba(0,0,0,1)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        fx.globalCompositeOperation = "destination-in";
        fx.fillStyle = gr;
        fx.fillRect(0, 0, 400, 400);
        x.drawImage(fc, 56, 80);
        tex[k] = c;
        const cc = document.createElement("canvas");
        cc.width = cc.height = 192;
        const cx2 = cc.getContext("2d");
        cx2.beginPath(); cx2.arc(96, 96, 96, 0, Math.PI * 2); cx2.clip();
        cx2.drawImage(im, im.width * 0.1, im.height * 0.1, im.width * 0.8, im.height * 0.8, 0, 0, 192, 192);
        ctex[k] = cc.toDataURL();
        urls[k] = c.toDataURL();
        if (++loaded === faces.length) applyBubbles();
      };
      im.onerror = function () {
        console.warn("Foto tidak ketemu:", FS[k]);
        if (++loaded === faces.length) applyBubbles();
      };
      im.src = FS[k];
    });
    Matter.Events.on(render, "afterRender", function () {
      const ctx = render.context;
      hearts.forEach(function (b) {
        const im = tex[b.face];
        if (!im) return;
        const I = b.heartInfo;
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);
        ctx.drawImage(im, I.dx - I.w / 2, I.dy - I.h / 2, I.w, I.h);
        ctx.restore();
      });
    });
    setTimeout(function () {
      let t = 0;
      const iv = setInterval(function () {
        const av = faces.filter(function (f2) { return tex[f2]; });
        if (!av.length) return;
        const b = makeHeart();
        b.face = av[(t * 4 + Math.floor(Math.random() * 3)) % av.length];
        const left = t % 2 === 0;
        Body.setPosition(b, { x: left ? 128 : 384, y: 225 });
        Body.setAngle(b, Common.random(-0.3, 0.3));
        Body.setVelocity(b, { x: left ? 1.2 : -1.2, y: Common.random(-0.8, 0.8) });
        Composite.add(world, b);
        hearts.push(b);
        if (++t >= BIG_HEARTS) clearInterval(iv);
      }, 780);
    }, 2000 + Math.round(COUNT * 90 * 0.85)); // muncul di akhir, saat bulatan kecil hampir penuh

    // photo circles
    setTimeout(function () {
      let t = 0;
      const iv = setInterval(function () {
        const avail = faces.filter(function (f2) { return ctex[f2]; });
        if (!avail.length) return;
        const k = avail[t % avail.length];
        const col = Common.choose(COLORS);
        const render2 = ctex[k]
          ? { sprite: { texture: ctex[k], xScale: (2 * CIRCLE_R) / 192, yScale: (2 * CIRCLE_R) / 192 } }
          : { fillStyle: col, strokeStyle: col, lineWidth: 0 };
        const c = Bodies.circle(CX, CY, CIRCLE_R, {
          restitution: 0, friction: 0, frictionStatic: 0, frictionAir: 0.012, mass: 10, render: render2
        }, 40);
        Body.setVelocity(c, { x: Common.random(-1.5, 1.5), y: Common.random(-1.5, 1.5) });
        c.face = k;
        photoCircles.push(c);
        Composite.add(world, c);
        if (++t >= COUNT) clearInterval(iv);
      }, 90);
    }, 2000);

    setInterval(function () {
      const cnt = {};
      faces.forEach(function (k) { cnt[k] = 0; });
      photoCircles.forEach(function (c) { cnt[c.face]++; });
      photoCircles.forEach(function (c) {
        if (!c.render.sprite || !c.render.sprite.texture) return;
        const used = {};
        let clash = false;
        photoCircles.forEach(function (o) {
          if (o === c) return;
          if (Math.hypot(o.position.x - c.position.x, o.position.y - c.position.y) < 2 * CIRCLE_R + 8) {
            used[o.face] = 1;
            if (o.face === c.face) clash = true;
          }
        });
        if (!clash) return;
        const opts = faces.filter(function (k) { return !used[k] && ctex[k]; });
        if (!opts.length) return;
        opts.sort(function (a, b) { return cnt[a] - cnt[b]; });
        cnt[c.face]--; c.face = opts[0]; cnt[c.face]++;
        c.render.sprite.texture = ctex[c.face];
      });
    }, 300);

    const mouse = Mouse.create(render.canvas);
    Composite.add(world, MouseConstraint.create(engine, { mouse: mouse, constraint: { stiffness: 0.2, render: { visible: false } } }));
    render.mouse = mouse;
    Render.lookAt(render, { min: { x: 0, y: 0 }, max: { x: W, y: W } });
    Render.run(render);
  }
  // musik latar: taruh file music.mp3 di folder yang sama dengan index.html
  (function () {
    const audio = new Audio("music.mp3");
    audio.loop = true;
    audio.preload = "auto";
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "musik");
    btn.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:1000;width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;font-size:20px;cursor:pointer;backdrop-filter:blur(6px)";
    function icon() { btn.textContent = audio.paused ? "\uD83D\uDD07" : "\uD83D\uDD0A"; }
    function play() { const p = audio.play(); if (p && p.catch) p.catch(function () {}); }
    btn.onclick = function () { if (audio.paused) play(); else audio.pause(); };
    ["play", "pause"].forEach(function (ev) { audio.addEventListener(ev, icon); });
    audio.addEventListener("error", function () { btn.style.display = "none"; });
    ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, play, { once: true });
    });
    window.addEventListener("load", function () { document.body.appendChild(btn); icon(); play(); });
  })();

  window.onload = start;
})();
