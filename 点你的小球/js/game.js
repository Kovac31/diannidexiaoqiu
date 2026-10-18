/* ============================================================
   CS: FACE STRIKE — main game
   ============================================================ */
window.CS = window.CS || {};
(function () {
  'use strict';
  var T = window.THREE;
  var CS = window.CS;
  var Audio = CS.Audio;
  CS.PLAYER_IMAGES = window.PLAYER_IMAGES || [];

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function nowMs() { return performance.now(); }

  /* =================== SETTINGS =================== */
  var DEFAULTS = {
    ballSize: 0.45,
    sens: 1.0,
    fov: 90,
    volume: 0.55,
    textureStyle: 'random',
    faceIndex: 0,
    crossStyle: 'classic',
    crossColor: '#3ef07a',
    crossSize: 1.0,
    hudOpacity: 1.0,
    showFps: false,
    punch: true,
    weapon: 'ak47'
  };
  var S = (function () {
    var s = {};
    for (var k in DEFAULTS) s[k] = DEFAULTS[k];
    try {
      var raw = localStorage.getItem('csfs.settings');
      if (raw) {
        var o = JSON.parse(raw);
        for (var kk in o) if (kk in s) s[kk] = o[kk];
      }
    } catch (e) { }
    return s;
  })();
  function saveSettings() {
    try { localStorage.setItem('csfs.settings', JSON.stringify(S)); } catch (e) { }
  }

  /* =================== GLOBALS =================== */
  var renderer, scene, camera, world;
  var viewScene, viewCamera, vmHolder, vmFlash, vmModels = {}, flashSprite;
  var state = 'menu';
  var clock = new T.Clock();
  var raycaster = new T.Raycaster();
  var tmpV = new T.Vector3(), tmpV2 = new T.Vector3(), tmpV3 = new T.Vector3();
  var images = [], ballGeo, ballTexCache = {};
  var balls = [], ballMeshes = [];
  var muzzleLight;
  var settingsReturn = 'menu';

  var P = {
    pos: new T.Vector3(0, 0, 12.5),
    vel: new T.Vector3(),
    onGround: true,
    yaw: 0, pitch: 0,
    eye: 1.68, radius: 0.36, height: 1.8,
    bob: 0,
    lastHurt: -99,
    hp: 100, armor: 100,
    jumpLatch: false,
    punchP: 0, punchY: 0, punchRoll: 0
  };

  var W = {
    def: null, model: null, ammo: 0, reserve: 0,
    nextFire: 0, reloading: false, reloadStart: 0, reloadEnd: 0,
    scoped: false, drawUntil: 0, boltT: 0, slideT: 0, lastEmpty: 0
  };
  var ammoState = {};

  var stats = { score: 0, kills: 0, hs: 0, shots: 0, hits: 0, wave: 0 };
  var waveState = 'idle', waveCountdown = 0;

  /* ---- CS2 sensitivity specification -------------------------------
     CS2 converts raw mouse counts to view angles with:
        degrees = counts * sensitivity * m_yaw   (m_yaw default 0.022)
        degrees = counts * sensitivity * m_pitch (m_pitch default 0.022)
     i.e. 1 sensitivity unit = 0.022 degrees per mouse count on both axes.
     Scoped weapons use zoom_sensitivity_ratio_mouse = 1.0, which scales the
     angle so the crosshair travels the same screen distance as unscoped
     (tangent FOV ratio) — the CS2 default behaviour.                      */
  var CS2_M_YAW = 0.022;
  var CS2_M_PITCH = 0.022;
  var CS2_ZOOM_RATIO = 1.0;
  var DEG2RAD = Math.PI / 180;
  var SCOPE_H_FOV = 24;

  var keys = {};
  var mouseDown = false;
  var lookDX = 0, lookDY = 0;
  var kickZ = 0, kickRot = 0, swayX = 0, swayY = 0, bobT = 0;
  var recoilP = 0, recoilY = 0;
  var fpsAcc = 0, fpsFrames = 0, fpsTimer = 0;

  /* =================== BALL TEXTURES =================== */
  function cvs(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function drawCover(ctx, img, x, y, w, h, scale) {
    var ir = img.width / img.height, rr = w / h;
    var dw, dh;
    if (ir > rr) { dh = h * scale; dw = dh * ir; }
    else { dw = w * scale; dh = dw / ir; }
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function makeBallTexture(img, variant) {
    var Wd = 512, H = 256;
    var c = cvs(Wd, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, Wd, H);

    // blurred photographic backdrop
    ctx.save();
    try {
      ctx.filter = (variant === 'gray' ? 'grayscale(1) ' : '') + 'blur(15px) brightness(.95) saturate(1.25)';
    } catch (e) { }
    drawCover(ctx, img, -24, -24, Wd + 48, H + 48, 1.25);
    ctx.restore();

    // vignette
    var vg = ctx.createRadialGradient(Wd / 2, H / 2, H * 0.15, Wd / 2, H / 2, Wd * 0.55);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.58)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, Wd, H);

    // two photo decals (front / back of the sphere)
    for (var k = 0; k < 2; k++) {
      var cx = Wd * (0.25 + k * 0.5), cy = H * 0.5, rad = H * 0.405;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, 6.2832);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#050505';
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.save();
      if (variant === 'gray') { try { ctx.filter = 'grayscale(1) contrast(1.06)'; } catch (e) { } }
      drawCover(ctx, img, cx - rad, cy - rad, rad * 2, rad * 2, 1.02);
      ctx.restore();
      // inner shadow
      var ig = ctx.createRadialGradient(cx, cy, rad * 0.55, cx, cy, rad);
      ig.addColorStop(0, 'rgba(0,0,0,0)');
      ig.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = ig;
      ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      ctx.restore();

      // sticker ring
      ctx.strokeStyle = 'rgba(235,196,126,.9)';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, rad + 2.4, 0, 6.2832); ctx.stroke();

      if (variant === 'ring') {
        var rr = [rad * 0.86, rad * 0.66, rad * 0.44];
        for (var r2 = 0; r2 < rr.length; r2++) {
          ctx.strokeStyle = r2 === 1 ? 'rgba(255,255,255,.85)' : 'rgba(224,161,60,.8)';
          ctx.lineWidth = r2 === 0 ? 5 : 3;
          ctx.beginPath(); ctx.arc(cx, cy, rr[r2], 0, 6.2832); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(224,161,60,.9)';
        ctx.lineWidth = 2.4;
        [0, 1, 2, 3].forEach(function (i2) {
          var a = i2 * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * rad * 0.05, cy + Math.sin(a) * rad * 0.05);
          ctx.lineTo(cx + Math.cos(a) * rad * 0.20, cy + Math.sin(a) * rad * 0.20);
          ctx.stroke();
        });
      }
    }

    // horizontal seam lines
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(Wd, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H - 8); ctx.lineTo(Wd, H - 8); ctx.stroke();

    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function getBallTexture(i, style) {
    var variant = (style === 'gray' || style === 'ring') ? style : 'color';
    if (!ballTexCache[variant]) ballTexCache[variant] = [];
    if (!ballTexCache[variant][i]) {
      ballTexCache[variant][i] = makeBallTexture(images[i], variant);
    }
    return ballTexCache[variant][i];
  }
  function pickBallIndex() {
    if (S.textureStyle === 'fixed') return clamp(Math.round(S.faceIndex), 0, 7);
    return Math.floor(Math.random() * 8);
  }

  /* =================== FX =================== */
  var FX = (function () {
    var MAXP = 420;
    var pGeo, pPos, pCol, pVel = [], pLife = [], pMax = [], pColr = [], pHead = 0, points;
    var tracers = [], decals = [], casings = [];
    var decalTex;

    function init() {
      pGeo = new T.BufferGeometry();
      pPos = new Float32Array(MAXP * 3);
      pCol = new Float32Array(MAXP * 3);
      for (var i = 0; i < MAXP; i++) {
        pPos[i * 3 + 1] = -999;
        pLife.push(0); pMax.push(1); pVel.push(new T.Vector3()); pColr.push(new T.Color());
      }
      pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3));
      pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
      points = new T.Points(pGeo, new T.PointsMaterial({
        size: 0.075, vertexColors: true, transparent: true, opacity: 1,
        depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
      }));
      points.frustumCulled = false;
      scene.add(points);

      var tg = new T.BoxGeometry(0.014, 0.014, 1);
      for (var k = 0; k < 22; k++) {
        var m = new T.Mesh(tg, new T.MeshBasicMaterial({
          color: 0xffd9a3, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false
        }));
        m.visible = false;
        m.frustumCulled = false;
        scene.add(m);
        tracers.push({ mesh: m, life: 0, max: 0.07 });
      }

      decalTex = (function () {
        var c = cvs(64, 64), ctx = c.getContext('2d');
        var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
        g.addColorStop(0, 'rgba(255,240,210,.95)');
        g.addColorStop(.18, 'rgba(120,105,88,.95)');
        g.addColorStop(.5, 'rgba(30,26,22,.88)');
        g.addColorStop(1, 'rgba(20,18,15,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(32, 32, 31, 0, 6.2832); ctx.fill();
        for (var i = 0; i < 10; i++) {
          ctx.fillStyle = 'rgba(10,9,8,' + rand(.2, .5) + ')';
          ctx.beginPath();
          ctx.arc(32 + rand(-20, 20), 32 + rand(-20, 20), rand(1, 4), 0, 6.2832);
          ctx.fill();
        }
        var t = new T.CanvasTexture(c);
        t.colorSpace = T.SRGBColorSpace;
        return t;
      })();

      var dg = new T.PlaneGeometry(0.11, 0.11);
      var dm = new T.MeshBasicMaterial({ map: decalTex, transparent: true, opacity: .95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
      for (var d = 0; d < 34; d++) {
        var dm2 = new T.Mesh(dg, dm);
        dm2.visible = false;
        scene.add(dm2);
        decals.push({ mesh: dm2, life: 0 });
      }

      var cg = new T.BoxGeometry(0.012, 0.012, 0.03);
      var cm = new T.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.28 });
      for (var c2 = 0; c2 < 16; c2++) {
        var cm2 = new T.Mesh(cg, cm);
        cm2.visible = false;
        cm2.castShadow = false;
        scene.add(cm2);
        casings.push({ mesh: cm2, vel: new T.Vector3(), life: 0, spin: new T.Vector3(), bounced: false });
      }
    }

    function burst(pos, color, count, speed, size) {
      var col = new T.Color(color);
      for (var i = 0; i < count; i++) {
        var idx = pHead;
        pHead = (pHead + 1) % MAXP;
        var v = pVel[idx];
        v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(speed * .3, speed));
        pPos[idx * 3] = pos.x; pPos[idx * 3 + 1] = pos.y; pPos[idx * 3 + 2] = pos.z;
        pCol[idx * 3] = col.r; pCol[idx * 3 + 1] = col.g; pCol[idx * 3 + 2] = col.b;
        pColr[idx].copy(col);
        pLife[idx] = rand(.25, .55); pMax[idx] = pLife[idx];
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
      if (size) points.material.size = size;
    }

    function tracer(from, to) {
      var t = null;
      for (var i = 0; i < tracers.length; i++) if (tracers[i].life <= 0) { t = tracers[i]; break; }
      if (!t) t = tracers[Math.floor(Math.random() * tracers.length)];
      var mid = from.clone().add(to).multiplyScalar(.5);
      var d = from.distanceTo(to);
      t.mesh.position.copy(mid);
      t.mesh.scale.set(1, 1, Math.max(0.02, d));
      t.mesh.lookAt(to);
      t.mesh.material.opacity = .85;
      t.mesh.visible = true;
      t.life = t.max;
    }

    function impact(point, normal) {
      var d = null;
      for (var i = 0; i < decals.length; i++) if (decals[i].life <= 0) { d = decals[i]; break; }
      if (!d) d = decals[0];
      d.mesh.position.copy(point).addScaledVector(normal, 0.012);
      d.mesh.lookAt(point.clone().add(normal));
      d.mesh.rotation.z = Math.random() * 6.28;
      d.mesh.visible = true;
      d.mesh.material.opacity = .9;
      d.life = 12;
      burst(point, 0xffcf8a, 7, 3.2, 0.05);
    }

    function casing(pos, dir) {
      var c = null;
      for (var i = 0; i < casings.length; i++) if (casings[i].life <= 0) { c = casings[i]; break; }
      if (!c) return;
      c.mesh.position.copy(pos);
      c.vel.copy(dir).multiplyScalar(rand(1.4, 2.4)).add(new T.Vector3(rand(-.5, .5), rand(1.6, 2.8), rand(-.5, .5)));
      c.spin.set(rand(-14, 14), rand(-14, 14), rand(-14, 14));
      c.life = 3.2;
      c.bounced = false;
      c.mesh.visible = true;
      c.mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    }

    function update(dt) {
      var changed = false;
      for (var i = 0; i < MAXP; i++) {
        if (pLife[i] <= 0) continue;
        pLife[i] -= dt;
        changed = true;
        if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; }
        var v = pVel[i];
        v.y -= 9.5 * dt;
        pPos[i * 3] += v.x * dt;
        pPos[i * 3 + 1] += v.y * dt;
        pPos[i * 3 + 2] += v.z * dt;
        if (pPos[i * 3 + 1] < 0.02) { pPos[i * 3 + 1] = 0.02; v.y *= -0.35; v.x *= .7; v.z *= .7; }
        var f = pLife[i] / pMax[i];
        pCol[i * 3] = pColr[i].r * f;
        pCol[i * 3 + 1] = pColr[i].g * f;
        pCol[i * 3 + 2] = pColr[i].b * f;
      }
      if (changed) {
        pGeo.attributes.position.needsUpdate = true;
        pGeo.attributes.color.needsUpdate = true;
      }
      for (var k = 0; k < tracers.length; k++) {
        var t = tracers[k];
        if (t.life > 0) {
          t.life -= dt;
          t.mesh.material.opacity = Math.max(0, t.life / t.max) * .85;
          if (t.life <= 0) t.mesh.visible = false;
        }
      }
      for (var d = 0; d < decals.length; d++) {
        if (decals[d].life > 0) {
          decals[d].life -= dt;
          if (decals[d].life <= 0) decals[d].mesh.visible = false;
        }
      }
      for (var c = 0; c < casings.length; c++) {
        var cc = casings[c];
        if (cc.life <= 0) continue;
        cc.life -= dt;
        cc.vel.y -= 12 * dt;
        cc.mesh.position.addScaledVector(cc.vel, dt);
        cc.mesh.rotation.x += cc.spin.x * dt;
        cc.mesh.rotation.y += cc.spin.y * dt;
        cc.mesh.rotation.z += cc.spin.z * dt;
        if (cc.mesh.position.y < 0.03) {
          cc.mesh.position.y = 0.03;
          cc.vel.y *= -0.32;
          cc.vel.x *= .55; cc.vel.z *= .55;
          cc.spin.multiplyScalar(.5);
        }
        if (cc.life <= 0) cc.mesh.visible = false;
      }
    }

    return { init: init, burst: burst, tracer: tracer, impact: impact, casing: casing, update: update };
  })();

  /* =================== HUD =================== */
  var hudCache = {};
  function setHudText(id, val) {
    if (hudCache[id] === val) return;
    hudCache[id] = val;
    var el = $(id);
    if (el) el.textContent = val;
  }
  function updateStatsHUD() {
    setHudText('scoreVal', String(stats.score));
    setHudText('waveNum', String(Math.max(1, stats.wave)));
    setHudText('targetsLeft', String(balls.length));
    setHudText('accVal', (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%');
  }
  function updateAmmoHUD() {
    if (!W.def) return;
    setHudText('ammoMag', String(W.ammo));
    setHudText('ammoRes', String(W.reserve));
    setHudText('weaponName', W.def.en);
    setHudText('weaponTag', W.def.tag);
    $('ammoMag').parentNode.classList.toggle('low', W.ammo <= Math.max(1, Math.floor(W.def.mag * .25)));
    var pct = W.def.mag ? (W.ammo / W.def.mag) : 0;
    $('ammoPips').style.opacity = String(0.25 + pct * 0.6);
  }
  function updateVitals() {
    setHudText('hpVal', String(Math.max(0, Math.round(P.hp))));
    setHudText('apVal', String(Math.max(0, Math.round(P.armor))));
    $('hpFill').style.width = clamp(P.hp, 0, 100) + '%';
    $('hpFill').style.background = P.hp > 55 ? 'linear-gradient(90deg,#4fd985,#b6e86a)'
      : P.hp > 25 ? 'linear-gradient(90deg,#e0a13c,#f0c36a)' : 'linear-gradient(90deg,#e2564c,#ff8a6a)';
    var bl = document.querySelector('.hud-bl');
    bl.classList.toggle('low', P.hp <= 30);
  }
  function addKillfeed(wep, victim, head) {
    var el = document.createElement('div');
    el.className = 'kf-item';
    el.innerHTML = '<span class="wep">' + wep + '</span><span style="opacity:.5">✕</span>' +
      '<span class="face">' + victim + '</span>' + (head ? '<span class="hs">爆头</span>' : '');
    $('killfeed').appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2900);
  }
  function showDamageNumber(point, val, cls) {
    tmpV3.copy(point).project(camera);
    if (tmpV3.z > 1) return;
    var x = (tmpV3.x * .5 + .5) * window.innerWidth + rand(-14, 14);
    var y = (-tmpV3.y * .5 + .5) * window.innerHeight + rand(-8, 8);
    var el = document.createElement('div');
    el.className = 'dmg-num ' + (cls || '');
    el.textContent = val;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('dmgNumbers').appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
  }
  function hitmarker(head) {
    var el = $('hitmarker');
    el.classList.remove('show');
    el.classList.toggle('hs', !!head);
    void el.offsetWidth;
    el.classList.add('show');
  }
  function announce(kicker, title, sub) {
    var el = $('announce');
    el.innerHTML = '<div class="an-kicker">' + kicker + '</div><div class="an-title">' + title + '</div>' +
      (sub ? '<div class="an-sub">' + sub + '</div>' : '');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  function flashDamage(amount) {
    var el = $('flash');
    el.style.transition = 'none';
    el.style.opacity = String(clamp(amount / 45, .25, .9));
    void el.offsetWidth;
    el.style.transition = 'opacity .5s ease-out';
    el.style.opacity = '0';
  }

  /* =================== CAMERA / VIEWMODEL =================== */
  /* CS2 zoom_sensitivity_ratio_mouse = 1.0 : 1:1 monitor-distance matching */
  function zoomSensFactor() {
    if (!W.scoped) return 1;
    return CS2_ZOOM_RATIO *
      Math.tan(SCOPE_H_FOV * DEG2RAD / 2) / Math.tan(S.fov * DEG2RAD / 2);
  }

  var fovCurrent = 90;
  function updateFov(dt) {
    var aspect = window.innerWidth / window.innerHeight;
    var targetH = W.scoped ? SCOPE_H_FOV : S.fov;
    var hRad = targetH * Math.PI / 180;
    var vRad = 2 * Math.atan(Math.tan(hRad / 2) / aspect);
    var v = vRad * 180 / Math.PI;
    if (dt) fovCurrent = lerp(fovCurrent, v, Math.min(1, dt * 18));
    else fovCurrent = v;
    if (Math.abs(camera.fov - fovCurrent) > 0.005) {
      camera.fov = fovCurrent;
      camera.updateProjectionMatrix();
    }
  }
  function updateCamera() {
    if (state === 'menu' || state === 'attract') return;
    camera.position.set(P.pos.x, P.pos.y + P.eye, P.pos.z);
    var roll = P.punchRoll + Math.sin(bobT * 2) * 0.002 * clamp(Math.hypot(P.vel.x, P.vel.z) / 5, 0, 1);
    camera.rotation.set(P.pitch + recoilP + P.punchP, P.yaw + recoilY + P.punchY, roll, 'YXZ');
  }

  function updateViewmodel(dt, now) {
    vmHolder.visible = !W.scoped && state !== 'menu' && !!W.model;
    if (!W.model) return;
    var v = W.def.view;
    var spd = Math.hypot(P.vel.x, P.vel.z);
    var moving = P.onGround && spd > 0.4;
    if (moving) bobT += dt * Math.min(spd, 6) * 1.6;
    else bobT += dt * 0.6;
    var amp = clamp(spd / 5.4, 0, 1);
    var bobX = Math.sin(bobT) * 0.009 * amp;
    var bobY = Math.abs(Math.cos(bobT)) * 0.007 * amp;

    swayX += (-lookDX * 0.00055 - swayX) * Math.min(1, dt * 10);
    swayY += (lookDY * 0.00055 - swayY) * Math.min(1, dt * 10);
    lookDX = 0; lookDY = 0;

    kickZ += (0 - kickZ) * Math.min(1, dt * 13);
    kickRot += (0 - kickRot) * Math.min(1, dt * 13);

    var reloadP = 0;
    if (W.reloading) {
      var pr = clamp((now - W.reloadStart) / (W.reloadEnd - W.reloadStart), 0, 1);
      reloadP = Math.sin(pr * Math.PI);
    }
    var drawP = clamp((now - (W.drawUntil - 320)) / 320, 0, 1);
    var drawOff = (1 - easeOut(drawP)) * 0.34;

    vmHolder.position.set(
      v.pos[0] + swayX + bobX,
      v.pos[1] + swayY + bobY - drawOff - reloadP * 0.115,
      v.pos[2] + kickZ * 0.045
    );
    vmHolder.rotation.set(
      v.rot[0] + kickRot * 0.11 - reloadP * 0.55 + swayY * 1.6,
      v.rot[1] + swayX * 2.4 + reloadP * 0.12,
      v.rot[2] + Math.sin(bobT * .5) * 0.006
    );

    // part animations
    var md = W.model.userData;
    if (md.slide) {
      W.slideT += (0 - W.slideT) * Math.min(1, dt * 16);
      md.slide.position.z = W.slideT * 0.035;
    }
    if (md.mag) {
      md.mag.position.y = -reloadP * 0.13;
      md.mag.rotation.z = reloadP * 0.12;
    }
    if (md.bolt) {
      var b = clamp(W.boltT, 0, 1);
      md.bolt.rotation.z = -b * 0.85;
      md.bolt.position.z = b * 0.02;
      W.boltT += (0 - W.boltT) * Math.min(1, dt * 4.5);
    }
  }

  /* =================== PLAYER =================== */
  function circleOverlap(x, z, r, b) {
    var cx = clamp(x, b.min.x, b.max.x);
    var cz = clamp(z, b.min.z, b.max.z);
    var dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < r * r;
  }

  function updatePlayer(dt) {
    var f = 0, r = 0;
    if (keys['KeyW'] || keys['ArrowUp']) f += 1;
    if (keys['KeyS'] || keys['ArrowDown']) f -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) r += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) r -= 1;
    var walking = !!(keys['ShiftLeft'] || keys['ShiftRight']);

    var speedMul = (W.def ? W.def.moveSpeed : 1) * (W.scoped ? 0.42 : 1) * (walking ? 0.5 : 1);
    var maxSpeed = 5.35 * speedMul;

    var sinY = Math.sin(P.yaw), cosY = Math.cos(P.yaw);
    var wishX = (-sinY) * f + cosY * r;
    var wishZ = (-cosY) * f + (-sinY) * r;
    var wl = Math.hypot(wishX, wishZ);
    if (wl > 0) { wishX /= wl; wishZ /= wl; }

    var accel = P.onGround ? 66 : 14;
    P.vel.x += wishX * accel * dt;
    P.vel.z += wishZ * accel * dt;

    if (P.onGround && wl === 0) {
      var damp = Math.max(0, 1 - 11 * dt);
      P.vel.x *= damp;
      P.vel.z *= damp;
    }

    var hs = Math.hypot(P.vel.x, P.vel.z);
    if (hs > maxSpeed && hs > 0) {
      var k = maxSpeed / hs;
      P.vel.x *= k; P.vel.z *= k;
    }

    if (keys['Space'] && P.onGround && !P.jumpLatch) {
      P.vel.y = 5.55;
      P.onGround = false;
      P.jumpLatch = true;
      Audio.jump();
    }
    if (!keys['Space']) P.jumpLatch = false;

    P.vel.y -= 17.2 * dt;

    P.pos.x += P.vel.x * dt;
    P.pos.z += P.vel.z * dt;

    /* horizontal collision */
    var pr = P.radius;
    var headY = P.pos.y + P.height;
    for (var i = 0; i < world.solids.length; i++) {
      var b = world.solids[i];
      if (b.max.y <= P.pos.y + 0.34) continue;
      if (b.min.y >= headY) continue;
      if (!(P.pos.x > b.min.x - pr && P.pos.x < b.max.x + pr &&
            P.pos.z > b.min.z - pr && P.pos.z < b.max.z + pr)) continue;

      var dx1 = (b.max.x + pr) - P.pos.x;
      var dx2 = P.pos.x - (b.min.x - pr);
      var dz1 = (b.max.z + pr) - P.pos.z;
      var dz2 = P.pos.z - (b.min.z - pr);
      var m = Math.min(dx1, dx2, dz1, dz2);
      if (m === dx1) { P.pos.x = b.max.x + pr; if (P.vel.x < 0) P.vel.x = 0; }
      else if (m === dx2) { P.pos.x = b.min.x - pr; if (P.vel.x > 0) P.vel.x = 0; }
      else if (m === dz1) { P.pos.z = b.max.z + pr; if (P.vel.z < 0) P.vel.z = 0; }
      else { P.pos.z = b.min.z - pr; if (P.vel.z > 0) P.vel.z = 0; }
    }

    /* vertical */
    var prevY = P.pos.y;
    P.pos.y += P.vel.y * dt;
    var ground = 0;
    for (var j = 0; j < world.solids.length; j++) {
      var sb = world.solids[j];
      if (sb.max.y < -0.5) continue;
      if (!circleOverlap(P.pos.x, P.pos.z, pr * 0.92, sb)) continue;
      var top = sb.max.y;
      if (top <= prevY + 0.36 && top > ground) ground = top;
    }
    if (P.pos.y <= ground) {
      if (P.vel.y < -5.5 && !P.onGround) {
        Audio.land(clamp(-P.vel.y / 9, .3, 1));
        P.punchP += 0.012;
      }
      P.pos.y = ground;
      P.vel.y = 0;
      P.onGround = true;
    } else {
      P.onGround = false;
    }

    /* keep inside arena */
    P.pos.x = clamp(P.pos.x, -world.bounds.x + 0.6, world.bounds.x - 0.6);
    P.pos.z = clamp(P.pos.z, -world.bounds.z + 0.6, world.bounds.z - 0.6);

    /* recoil recovery */
    var rec = Math.min(1, dt * 8.5);
    recoilP = lerp(recoilP, 0, rec);
    recoilY = lerp(recoilY, 0, rec);
    P.punchP = lerp(P.punchP, 0, Math.min(1, dt * 7));
    P.punchY = lerp(P.punchY, 0, Math.min(1, dt * 7));
    P.punchRoll = lerp(P.punchRoll, 0, Math.min(1, dt * 7));

    /* health regen */
    if (nowMs() / 1000 - P.lastHurt > 6 && P.hp < 100 && state === 'playing') {
      P.hp = Math.min(100, P.hp + 7 * dt);
      updateVitals();
    }
  }

  function damagePlayer(amount) {
    if (state !== 'playing') return;
    var dmg = amount;
    if (P.armor > 0) {
      var absorbed = Math.min(P.armor, dmg * 0.5);
      P.armor -= absorbed;
      dmg -= absorbed * 0.85;
    }
    P.hp -= dmg;
    P.lastHurt = nowMs() / 1000;
    P.punchP += rand(0.012, 0.03);
    P.punchY += rand(-0.02, 0.02);
    P.punchRoll += rand(-0.02, 0.02);
    flashDamage(dmg * 3);
    Audio.hurt();
    updateVitals();
    if (P.hp <= 0) {
      P.hp = 0;
      updateVitals();
      gameOver();
    }
  }

  /* =================== WEAPONS =================== */
  function saveAmmo() {
    if (!W.def) return;
    ammoState[W.def.id] = { ammo: W.ammo, reserve: W.reserve };
  }

  function equip(id, instant) {
    var def = CS.getWeapon(id);
    if (W.def && W.def.id === def.id && W.model) return;
    saveAmmo();
    if (W.model) { W.model.visible = false; }
    W.def = def;
    var model = vmModels[def.id];
    if (!model) {
      model = CS.buildWeapon(def);
      model.position.set(def.view.pos[0], def.view.pos[1], def.view.pos[2]);
      model.rotation.set(def.view.rot[0], def.view.rot[1], def.view.rot[2]);
      model.scale.setScalar(def.view.scale);
      if (model.userData.muzzle && flashSprite) model.userData.muzzle.add(flashSprite);
      vmModels[def.id] = model;
    }
    model.visible = true;
    vmHolder.add(model);
    if (model.userData.muzzle && flashSprite) model.userData.muzzle.add(flashSprite);
    W.model = model;
    W.scoped = false;
    $('scope').classList.remove('on');
    W.reloading = false;
    $('reloadBar').classList.remove('on');
    var st = ammoState[def.id];
    W.ammo = st ? st.ammo : def.mag;
    W.reserve = st ? st.reserve : def.reserve;
    W.drawUntil = nowMs() + (instant ? 0 : 320);
    W.nextFire = nowMs() + (instant ? 0 : 300);
    updateAmmoHUD();
    updateFov();
    if (!instant) Audio.draw();
  }

  function reload() {
    if (state !== 'playing') return;
    if (W.reloading || W.ammo >= W.def.mag || W.reserve <= 0) return;
    W.reloading = true;
    W.reloadStart = nowMs();
    W.reloadEnd = W.reloadStart + W.def.reload * 1000;
    $('reloadBar').classList.add('on');
    $('reloadFill').style.width = '0%';
    Audio.reload(W.def);
    W.scoped = false;
    $('scope').classList.remove('on');
    updateFov();
  }

  function finishReload() {
    var need = W.def.mag - W.ammo;
    var take = Math.min(need, W.reserve);
    W.ammo += take;
    W.reserve -= take;
    W.reloading = false;
    $('reloadBar').classList.remove('on');
    updateAmmoHUD();
  }

  function toggleScope() {
    if (!W.def || !W.def.zoom) return;
    W.scoped = !W.scoped;
    $('scope').classList.toggle('on', W.scoped);
    Audio.scope();
    updateFov();
  }

  function currentSpread() {
    var def = W.def;
    if (W.scoped) return def.scopedSpread || 0.0004;
    var hs = Math.hypot(P.vel.x, P.vel.z);
    var s = def.spread + def.moveSpread * clamp(hs / 5.4, 0, 1.3);
    if (!P.onGround) s += def.spread * 3 + 0.02;
    if (keys['ShiftLeft'] || keys['ShiftRight']) s *= 0.72;
    return s;
  }

  function fire(now) {
    var def = W.def;
    W.ammo--;
    stats.shots++;
    W.nextFire = now + 60000 / def.rpm;
    W.slideT = 1;
    if (def.id === 'awp') W.boltT = 1;

    Audio.shot(def);
    if (flashSprite) {
      flashSprite.visible = true;
      flashSprite.material.rotation = Math.random() * 6.28;
      flashSprite.scale.setScalar(rand(0.16, 0.26));
      clearTimeout(flashSprite.userData.t);
      flashSprite.userData.t = setTimeout(function () { flashSprite.visible = false; }, 45);
    }
    if (vmFlash) {
      vmFlash.intensity = 3.2;
      clearTimeout(vmFlash.userData.t);
      vmFlash.userData.t = setTimeout(function () { vmFlash.intensity = 0; }, 45);
    }

    var fwd = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion).clone();
    var right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    var up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

    // player recoil
    recoilP += def.kick * (W.scoped ? 0.75 : 1);
    recoilY += (Math.random() - 0.35) * def.kickYaw * 1.6;
    kickZ = 1; kickRot = 1;
    P.punchP += def.kick * 0.28;
    P.punchY += (Math.random() - .5) * def.kickYaw * 0.5;

    // muzzle world light
    muzzleLight.position.copy(camera.position)
      .addScaledVector(fwd, 1.05)
      .addScaledVector(right, 0.22)
      .addScaledVector(up, -0.1);
    muzzleLight.intensity = 26;
    muzzleLight.userData.t = now;

    // casing
    if (def.id !== 'awp' || true) {
      var cp = camera.position.clone().addScaledVector(right, 0.20).addScaledVector(up, -0.12).addScaledVector(fwd, 0.42);
      FX.casing(cp, right.clone().multiplyScalar(1.1).addScaledVector(up, 0.4));
    }

    var muzzleWorld = camera.position.clone()
      .addScaledVector(right, 0.19)
      .addScaledVector(up, -0.13)
      .addScaledVector(fwd, 0.62);

    var spread = currentSpread();
    var hitAny = false;
    var pellets = def.pellets || 1;
    for (var p = 0; p < pellets; p++) {
      var dir = fwd.clone();
      if (spread > 0) {
        var sx = (Math.random() * 2 - 1) * spread;
        var sy = (Math.random() * 2 - 1) * spread;
        dir.addScaledVector(right, sx).addScaledVector(up, sy).normalize();
      }
      raycaster.set(camera.position, dir);
      raycaster.far = def.range || 120;
      var bHits = raycaster.intersectObjects(ballMeshes, false);
      var eHits = raycaster.intersectObjects(world.hittables, false);
      var end = camera.position.clone().addScaledVector(dir, 60);
      var ballHit = bHits.length ? bHits[0] : null;
      var envHit = eHits.length ? eHits[0] : null;

      if (ballHit && (!envHit || ballHit.distance <= envHit.distance)) {
        hitAny = true;
        end.copy(ballHit.point);
        FX.tracer(muzzleWorld, end);
        applyBallDamage(ballHit, def);
      } else if (envHit) {
        end.copy(envHit.point);
        var n = envHit.face ? envHit.face.normal.clone().transformDirection(envHit.object.matrixWorld) : new T.Vector3(0, 1, 0);
        FX.impact(envHit.point, n);
        FX.tracer(muzzleWorld, end);
      } else {
        FX.tracer(muzzleWorld, end);
      }
    }
    if (hitAny) stats.hits++;
    if (W.ammo === 0) W.lastEmpty = now;
    updateAmmoHUD();
    updateStatsHUD();
  }

  function tryShoot() {
    if (state !== 'playing') return;
    var now = nowMs();
    if (now < W.drawUntil || W.reloading || now < W.nextFire) return;
    if (W.ammo <= 0) {
      if (now - W.lastEmpty > 300) { Audio.empty(); W.lastEmpty = now; }
      return;
    }
    fire(now);
  }

  /* =================== BALLS =================== */
  function ballRadius() {
    return clamp(S.ballSize, 0.18, 1.2);
  }

  function spawnBall(opts) {
    opts = opts || {};
    var idx = opts.index !== undefined ? opts.index : pickBallIndex();
    var radius = ballRadius() * (opts.scale || 1);
    var variant = (S.textureStyle === 'gray' || S.textureStyle === 'ring') ? S.textureStyle : 'color';
    var mat = new T.MeshStandardMaterial({
      map: getBallTexture(idx, S.textureStyle),
      roughness: 0.45,
      metalness: 0.05,
      emissive: opts.hostile ? 0x2a0400 : 0x2a2a2a,
      emissiveMap: getBallTexture(idx, S.textureStyle),
      emissiveIntensity: 1
    });
    var mesh = new T.Mesh(ballGeo, mat);
    mesh.scale.setScalar(radius);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    var pos = opts.pos || findSpawnPos(radius);
    mesh.position.copy(pos);
    scene.add(mesh);

    var b = {
      mesh: mesh,
      mat: mat,
      radius: radius,
      baseScale: opts.scale || 1,
      index: idx,
      pos: pos.clone(),
      vel: new T.Vector3(),
      target: new T.Vector3(),
      speed: opts.hostile ? rand(1.5, 2.0) : rand(1.0, 2.0),
      hostile: !!opts.hostile,
      hp: opts.hp || 90,
      maxHp: opts.hp || 90,
      bobPhase: Math.random() * 6.28,
      bobFreq: rand(1.1, 2.0),
      thinkT: 0,
      spawnT: 0.3,
      ring: null,
      dead: false
    };
    b.hp = b.maxHp = 90 + Math.max(0, stats.wave - 1) * 15;

    if (b.hostile) {
      var ringMat = new T.MeshStandardMaterial({
        color: 0xff4433, emissive: 0xff2211, emissiveIntensity: 1.6,
        roughness: .4, metalness: .2, transparent: true, opacity: .95
      });
      var ring = new T.Mesh(new T.TorusGeometry(1.035, 0.022, 8, 40), ringMat);
      ring.scale.setScalar(radius);
      ring.position.copy(b.pos);
      scene.add(ring);
      b.ring = ring;
      b.speed = rand(1.7, 2.3) + stats.wave * 0.05;
    }

    pickWaypoint(b);
    balls.push(b);
    ballMeshes.push(mesh);
    mesh.userData.ball = b;
    updateStatsHUD();
    return b;
  }

  function findSpawnPos(radius) {
    var best = new T.Vector3(0, 2, -6);
    for (var tries = 0; tries < 40; tries++) {
      var x = rand(-10.8, 10.8);
      var z = rand(-14, 8.5);
      var y = rand(1.6, 4.6);
      var dx = x - P.pos.x, dz = z - P.pos.z;
      if (dx * dx + dz * dz < 36) continue;
      var p = new T.Vector3(x, y, z);
      var blocked = false;
      for (var i = 0; i < world.solids.length; i++) {
        var s = world.solids[i];
        if (x > s.min.x - radius && x < s.max.x + radius &&
            z > s.min.z - radius && z < s.max.z + radius &&
            y > s.min.y - radius && y < s.max.y + radius) { blocked = true; break; }
      }
      if (!blocked) return p;
      best.copy(p);
    }
    return best;
  }

  function pickWaypoint(b) {
    for (var i = 0; i < 24; i++) {
      var x = rand(-10.6, 10.6), z = rand(-14.2, 8.4), y = rand(1.8, 4.8);
      var blocked = false;
      for (var j = 0; j < world.solids.length; j++) {
        var s = world.solids[j];
        if (x > s.min.x - b.radius && x < s.max.x + b.radius &&
            z > s.min.z - b.radius && z < s.max.z + b.radius &&
            y > s.min.y - b.radius && y < s.max.y + b.radius) { blocked = true; break; }
      }
      if (!blocked) { b.target.set(x, y, z); return; }
    }
    b.target.set(rand(-8, 8), rand(2, 4), rand(-12, 4));
  }

  function applyBallDamage(hit, def) {
    var b = hit.object.userData.ball;
    if (!b || b.dead) return;
    var head = (hit.point.y - b.mesh.position.y) > b.radius * 0.30;
    var raw = def.damage * (head ? def.headMult : 1);
    var dmg = head ? Math.max(raw, b.hp) : raw;
    b.hp -= dmg;
    hitmarker(head);
    Audio.hit(head, b.hp <= 0);
    FX.burst(hit.point, head ? 0xffb070 : 0xffeecc, head ? 12 : 7, 4.2, 0.07);
    showDamageNumber(hit.point, head ? '爆头' : Math.round(dmg), head ? 'hs' : '');
    if (b.hp <= 0) {
      killBall(b, def, head);
    }
  }

  function killBall(b, def, head) {
    if (b.dead) return;
    b.dead = true;
    stats.kills++;
    if (head) stats.hs++;
    var base = 100 + Math.max(0, stats.wave - 1) * 18;
    if (b.hostile) base += 60;
    if (head) base = Math.round(base * 1.6);
    stats.score += base;
    showDamageNumber(b.pos.clone().add(new T.Vector3(0, b.radius * 1.7, 0)), '+' + base, 'kill');
    addKillfeed(def.en, CS.PLAYER_IMAGES[b.index].name, head);
    FX.burst(b.pos, head ? 0xffd166 : 0xffb347, 26, 6.5, 0.11);
    FX.burst(b.pos, 0xffffff, 8, 3.2, 0.06);
    popBall(b, false);
    updateStatsHUD();
    if (waveState === 'active' && balls.length === 0) waveCleared();
  }

  function popBall(b, silent) {
    b.dead = true;
    scene.remove(b.mesh);
    b.mat.dispose();
    if (b.ring) { scene.remove(b.ring); b.ring.geometry.dispose(); b.ring.material.dispose(); }
    var i = balls.indexOf(b);
    if (i >= 0) balls.splice(i, 1);
    var j = ballMeshes.indexOf(b.mesh);
    if (j >= 0) ballMeshes.splice(j, 1);
    if (!silent) updateStatsHUD();
    else updateStatsHUD();
  }

  function updateBalls(dt, t) {
    var BX = world.bounds.x - 0.9, BZ = world.bounds.z - 0.9;
    for (var i = balls.length - 1; i >= 0; i--) {
      var b = balls[i];
      if (b.dead) continue;

      if (b.hostile) {
        var toP = tmpV.set(P.pos.x - b.pos.x, (P.pos.y + 1.15) - b.pos.y, P.pos.z - b.pos.z);
        var dist = toP.length();
        toP.normalize().multiplyScalar(b.speed);
        b.vel.lerp(toP, 1 - Math.exp(-dt * 1.4));
        if (dist < b.radius + 0.62) {
          damagePlayer(12 + stats.wave * 0.6);
          FX.burst(b.pos, 0xff4433, 22, 6, .1);
          popBall(b, true);
          continue;
        }
      } else {
        b.thinkT -= dt;
        var d2 = tmpV.copy(b.target).sub(b.pos);
        if (b.thinkT <= 0 || d2.length() < 0.9) {
          pickWaypoint(b);
          b.thinkT = rand(2.4, 5.0);
          d2.copy(b.target).sub(b.pos);
        }
        var dd = d2.length();
        if (dd > 0.001) d2.multiplyScalar(1 / dd).multiplyScalar(b.speed);
        b.vel.lerp(d2, 1 - Math.exp(-dt * 1.5));
      }

      b.pos.addScaledVector(b.vel, dt);

      // bounds bounce
      if (b.pos.x > BX - b.radius) { b.pos.x = BX - b.radius; b.vel.x = -Math.abs(b.vel.x) * .7; }
      if (b.pos.x < -BX + b.radius) { b.pos.x = -BX + b.radius; b.vel.x = Math.abs(b.vel.x) * .7; }
      if (b.pos.z > BZ - b.radius) { b.pos.z = BZ - b.radius; b.vel.z = -Math.abs(b.vel.z) * .7; }
      if (b.pos.z < -BZ + b.radius) { b.pos.z = -BZ + b.radius; b.vel.z = Math.abs(b.vel.z) * .7; }
      if (b.pos.y > 5.9 - b.radius) { b.pos.y = 5.9 - b.radius; b.vel.y = -Math.abs(b.vel.y) * .6; }
      if (b.pos.y < 1.0 + b.radius) { b.pos.y = 1.0 + b.radius; b.vel.y = Math.abs(b.vel.y) * .6; }

      // solid bounce (approx)
      for (var si = 0; si < world.solids.length; si++) {
        var sb = world.solids[si];
        if (b.pos.x > sb.min.x - b.radius && b.pos.x < sb.max.x + b.radius &&
            b.pos.z > sb.min.z - b.radius && b.pos.z < sb.max.z + b.radius &&
            b.pos.y > sb.min.y - b.radius && b.pos.y < sb.max.y + b.radius) {
          var pxl = (b.pos.x) - (sb.min.x - b.radius);
          var pxr = (sb.max.x + b.radius) - b.pos.x;
          var pzl = (b.pos.z) - (sb.min.z - b.radius);
          var pzr = (sb.max.z + b.radius) - b.pos.z;
          var pyt = (sb.max.y + b.radius) - b.pos.y;
          var m = Math.min(pxl, pxr, pzl, pzr, pyt);
          if (m === pxl) { b.pos.x = sb.min.x - b.radius; b.vel.x = -Math.abs(b.vel.x) * .7; }
          else if (m === pxr) { b.pos.x = sb.max.x + b.radius; b.vel.x = Math.abs(b.vel.x) * .7; }
          else if (m === pzl) { b.pos.z = sb.min.z - b.radius; b.vel.z = -Math.abs(b.vel.z) * .7; }
          else if (m === pzr) { b.pos.z = sb.max.z + b.radius; b.vel.z = Math.abs(b.vel.z) * .7; }
          else { b.pos.y = sb.max.y + b.radius; b.vel.y = Math.abs(b.vel.y) * .5; }
        }
      }

      // visuals
      var bob = Math.sin(t * b.bobFreq + b.bobPhase) * 0.10;
      b.mesh.position.set(b.pos.x, b.pos.y + bob, b.pos.z);
      b.mesh.rotation.y += dt * (b.hostile ? 1.4 : 0.55);
      b.mesh.rotation.x += dt * 0.15;

      if (b.spawnT > 0) {
        b.spawnT -= dt;
        var kk = 1 - Math.max(0, b.spawnT) / 0.3;
        b.mesh.scale.setScalar(b.radius * (0.35 + 0.65 * easeOut(kk)));
      }
      if (b.ring) {
        b.ring.position.copy(b.mesh.position);
        b.ring.scale.setScalar(b.radius * (1 + Math.sin(t * 5) * 0.02));
        b.ring.rotation.set(t * 1.2, t * 0.9, 0);
        b.ring.material.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.6;
      }
    }
  }

  function clearBalls() {
    for (var i = balls.length - 1; i >= 0; i--) popBall(balls[i], true);
    balls.length = 0;
    ballMeshes.length = 0;
    updateStatsHUD();
  }

  /* =================== WAVES =================== */
  function startWave(n) {
    stats.wave = n;
    var count = Math.min(4 + Math.floor(n * 1.7), 13);
    var hostiles = n >= 2 ? Math.min(1 + Math.floor((n - 1) / 2), 5) : 0;
    for (var i = 0; i < count; i++) {
      spawnBall({ hostile: i < hostiles });
    }
    waveState = 'active';
    announce('WAVE ' + n, n === 1 ? '训练开始' : '第 ' + n + ' 波',
      count + ' 个目标' + (hostiles ? ' · ' + hostiles + ' 个红球会撞你' : ''));
    $('waveTimer').textContent = 'LIVE';
    Audio.wave(true);
    updateStatsHUD();
  }

  function waveCleared() {
    if (waveState !== 'active') return;
    waveState = 'intermission';
    waveCountdown = 4.5;
    var bonus = 60 * stats.wave;
    stats.score += bonus;
    announce('WAVE CLEAR', '第 ' + stats.wave + ' 波清空', '奖励 +' + bonus + ' · 准备下一波');
    Audio.wave(false);
    updateStatsHUD();
  }

  function updateWaves(dt) {
    if (state !== 'playing') return;
    if (waveState === 'intermission') {
      waveCountdown -= dt;
      var v = Math.max(0, waveCountdown);
      $('waveTimer').textContent = v.toFixed(1);
      if (waveCountdown <= 0) startWave(stats.wave + 1);
    } else if (waveState === 'active') {
      if (balls.length === 0) waveCleared();
    }
  }

  /* =================== GAME FLOW =================== */
  function resetGame() {
    clearBalls();
    stats.score = 0; stats.kills = 0; stats.hs = 0; stats.shots = 0; stats.hits = 0; stats.wave = 0;
    P.pos.set(0, 0, 12.5);
    P.vel.set(0, 0, 0);
    P.yaw = 0; P.pitch = 0;
    P.hp = 100; P.armor = 100;
    P.onGround = true;
    P.lastHurt = -99;
    P.punchP = P.punchY = P.punchRoll = 0;
    recoilP = recoilY = 0;
    ammoState = {};
    W.def = null; W.model = null;
    if (vmHolder) {
      while (vmHolder.children.length) {
        var oldModel = vmHolder.children[0];
        vmHolder.remove(oldModel);
        oldModel.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      }
    }
    if (flashSprite && flashSprite.parent) flashSprite.parent.remove(flashSprite);
    vmModels = {};
    waveState = 'intermission';
    waveCountdown = 3.5;
    $('waveTimer').textContent = '3.5';
    equip(S.weapon, true);
    updateVitals();
    updateStatsHUD();
    updateAmmoHUD();
    $('killfeed').innerHTML = '';
    $('dmgNumbers').innerHTML = '';
    $('scope').classList.remove('on');
    $('reloadBar').classList.remove('on');
    $('announce').classList.remove('show');
  }

  function startGame() {
    Audio.init();
    Audio.resume();
    Audio.setVolume(S.volume);
    resetGame();
    hideAllScreens();
    $('hud').classList.remove('hidden');
    $('fpsBox').classList.toggle('on', !!S.showFps);
    state = 'playing';
    clock.getDelta();
    requestLock();
    announce('AIM TRAINING', '准备', 'WASD 移动 · 左键射击 · R 换弹');
  }

  function requestLock() {
    if (document.pointerLockElement === renderer.domElement) return;
    try {
      var p = renderer.domElement.requestPointerLock();
      if (p && p.catch) p.catch(function () { });
    } catch (e) { }
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    mouseDown = false;
    keys = {};
    $('pauseScore').textContent = stats.score;
    $('pauseWave').textContent = Math.max(1, stats.wave);
    $('pauseKills').textContent = stats.kills;
    $('pauseAcc').textContent = (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%';
    $('pause').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function resumeGame() {
    if (state !== 'paused') return;
    $('pause').classList.add('hidden');
    state = 'playing';
    clock.getDelta();
    requestLock();
  }

  function gameOver() {
    if (state === 'dead') return;
    state = 'dead';
    mouseDown = false;
    $('overScore').textContent = stats.score;
    $('overWave').textContent = Math.max(1, stats.wave);
    $('overKills').textContent = stats.kills;
    $('overAcc').textContent = (stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0) + '%';
    $('overHs').textContent = stats.hs;
    $('gameover').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function toMenu() {
    state = 'menu';
    hideAllScreens();
    $('hud').classList.add('hidden');
    $('menu').classList.remove('hidden');
    clearBalls();
    if (document.pointerLockElement) document.exitPointerLock();
    clock.getDelta();
  }

  function hideAllScreens() {
    ['menu', 'settings', 'pause', 'gameover'].forEach(function (id) {
      $(id).classList.add('hidden');
    });
  }

  /* =================== SETTINGS UI =================== */
  function openSettings(from) {
    settingsReturn = from;
    if (from === 'pause') $('pause').classList.add('hidden');
    if (from === 'menu') $('menu').classList.add('hidden');
    $('settings').classList.remove('hidden');
    if (state === 'playing') pauseGame();
  }
  function closeSettings() {
    $('settings').classList.add('hidden');
    if (settingsReturn === 'pause') {
      $('pause').classList.remove('hidden');
    } else {
      if (state === 'menu') $('menu').classList.remove('hidden');
    }
    saveSettings();
  }

  function applyCrosshairUI() {
    document.documentElement.style.setProperty('--ch', S.crossColor);
    document.documentElement.style.setProperty('--ch-thick', (2 * S.crossSize).toFixed(1) + 'px');
    document.documentElement.style.setProperty('--ch-len', (8 * S.crossSize).toFixed(1) + 'px');
    ['crosshair', 'crosshairPreview'].forEach(function (id) {
      var el = $(id);
      if (el) el.dataset.style = S.crossStyle;
    });
  }

  function applyHudOpacity() {
    document.documentElement.style.setProperty('--hud-op', S.hudOpacity);
  }

  function refreshBallAppearance() {
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];
      b.radius = ballRadius() * b.baseScale;
      b.mesh.scale.setScalar(b.radius);
      if (b.ring) b.ring.scale.setScalar(b.radius);
      if (S.textureStyle === 'fixed' && b.index !== S.faceIndex) b.index = S.faceIndex;
      b.mat.map = getBallTexture(b.index, S.textureStyle);
      b.mat.needsUpdate = true;
    }
  }

  function buildWeaponUI() {
    CS.__env = world ? world.env : null;
    var thumbs = CS.generateWeaponThumbs();
    var grid = $('weaponGrid');
    var html = '';
    CS.WEAPONS.forEach(function (w) {
      var bars = [['伤害', w.stats.dmg], ['射速', w.stats.rpm], ['精度', w.stats.acc], ['控制', w.stats.ctrl]]
        .map(function (s) {
          return '<span class="sl">' + s[0] + '</span><span class="sb"><i style="width:' + s[1] + '%"></i></span>';
        }).join('');
      html += '<button class="wcard" data-wid="' + w.id + '">' +
        '<div class="wcard-top"><div><div class="wcard-name">' + w.name + '</div>' +
        '<div class="wcard-en">' + w.en + '</div></div>' +
        '<div class="wcard-slot">' + w.slot + '</div></div>' +
        '<div class="wcard-thumb">' + (thumbs[w.id] ? '<img src="' + thumbs[w.id] + '" alt="">' : '') + '</div>' +
        '<div class="wcard-stats">' + bars + '</div>' +
        '<div class="wcard-meta"><span>弹匣 <b>' + w.mag + '</b></span><span>备弹 <b>' + w.reserve + '</b></span>' +
        '<span>倍率 <b>' + w.headMult + 'x</b></span></div>' +
        '</button>';
    });
    grid.innerHTML = html;
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('.wcard');
      if (!card) return;
      selectWeapon(card.dataset.wid);
    });
    markWeaponUI();
  }

  function selectWeapon(id) {
    S.weapon = id;
    saveSettings();
    if (state === 'playing' || state === 'paused' || state === 'dead') {
      equip(id, false);
    }
    markWeaponUI();
  }

  function markWeaponUI() {
    var cards = document.querySelectorAll('.wcard');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('active', cards[i].dataset.wid === S.weapon);
    }
  }

  function buildFacePicker() {
    var html = '';
    for (var i = 0; i < CS.PLAYER_IMAGES.length; i++) {
      html += '<button class="face-opt' + (i === S.faceIndex ? ' active' : '') + '" data-face="' + i + '">' +
        '<img src="' + CS.PLAYER_IMAGES[i].data + '" alt=""><span class="fo-idx">0' + (i + 1) + '</span></button>';
    }
    $('faceGrid').innerHTML = html;
    var roster = '';
    for (var r = 0; r < CS.PLAYER_IMAGES.length; r++) {
      roster += '<div class="roster-item" title="' + CS.PLAYER_IMAGES[r].name + '"><img src="' +
        CS.PLAYER_IMAGES[r].data + '" alt=""></div>';
    }
    $('rosterList').innerHTML = roster;
    $('faceGrid').addEventListener('click', function (e) {
      var btn = e.target.closest('.face-opt');
      if (!btn) return;
      S.faceIndex = parseInt(btn.dataset.face, 10);
      var all = $('faceGrid').querySelectorAll('.face-opt');
      for (var i = 0; i < all.length; i++) all[i].classList.toggle('active', all[i] === btn);
      S.textureStyle = 'fixed';
      syncChips();
      saveSettings();
      refreshBallAppearance();
    });
  }

  function syncChips() {
    var chips = document.querySelectorAll('#textureStyles .chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('active', chips[i].dataset.style === S.textureStyle);
    $('facePicker').classList.toggle('active', S.textureStyle === 'fixed');
    var ch = document.querySelectorAll('#crossStyles .chip');
    for (var j = 0; j < ch.length; j++) ch[j].classList.toggle('active', ch[j].dataset.ch === S.crossStyle);
    var sw = document.querySelectorAll('#crossColors .swatch');
    for (var k = 0; k < sw.length; k++) sw[k].classList.toggle('active', sw[k].dataset.color === S.crossColor);
  }

  function syncSettingsUI() {
    $('setBallSize').value = S.ballSize;
    $('outBallSize').textContent = Number(S.ballSize).toFixed(2);
    $('setSens').value = S.sens;
    $('outSens').textContent = Number(S.sens).toFixed(2);
    $('setFov').value = S.fov;
    $('outFov').textContent = S.fov + '°';
    $('setVolume').value = S.volume;
    $('outVolume').textContent = Math.round(S.volume * 100) + '%';
    $('setCrossSize').value = S.crossSize;
    $('outCrossSize').textContent = Number(S.crossSize).toFixed(2);
    $('setHudOpacity').value = S.hudOpacity;
    $('outHudOpacity').textContent = Math.round(S.hudOpacity * 100) + '%';
    $('setFps').checked = !!S.showFps;
    $('setPunch').checked = !!S.punch;
    syncChips();
    applyCrosshairUI();
    applyHudOpacity();
  }

  function bindUI() {
    // menu
    $('btnStart').addEventListener('click', startGame);
    $('btnSettingsMenu').addEventListener('click', function () { Audio.init(); openSettings('menu'); });
    $('btnHelp').addEventListener('click', function () {
      $('helpCard').classList.toggle('hidden');
    });

    // settings tabs
    document.querySelectorAll('.ptab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.ptab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-page').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelector('.tab-page[data-page="' + tab.dataset.tab + '"]').classList.add('active');
      });
    });

    // ranges
    function bindRange(id, key, out, fmt, after) {
      var el = $(id);
      el.addEventListener('input', function () {
        S[key] = parseFloat(el.value);
        $(out).textContent = fmt(S[key]);
        if (after) after();
        saveSettings();
      });
    }
    bindRange('setBallSize', 'ballSize', 'outBallSize', function (v) { return v.toFixed(2); }, refreshBallAppearance);
    bindRange('setSens', 'sens', 'outSens', function (v) { return v.toFixed(2); });
    bindRange('setFov', 'fov', 'outFov', function (v) { return Math.round(v) + '°'; }, function () { updateFov(); });
    bindRange('setVolume', 'volume', 'outVolume', function (v) { return Math.round(v * 100) + '%'; }, function () { Audio.setVolume(S.volume); });
    bindRange('setCrossSize', 'crossSize', 'outCrossSize', function (v) { return v.toFixed(2); }, applyCrosshairUI);
    bindRange('setHudOpacity', 'hudOpacity', 'outHudOpacity', function (v) { return Math.round(v * 100) + '%'; }, applyHudOpacity);

    $('setFps').addEventListener('change', function () {
      S.showFps = this.checked;
      $('fpsBox').classList.toggle('on', S.showFps);
      saveSettings();
    });
    $('setPunch').addEventListener('change', function () {
      S.punch = this.checked;
      saveSettings();
    });

    // texture chips
    $('textureStyles').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      S.textureStyle = chip.dataset.style;
      syncChips();
      saveSettings();
      // force new textures for next spawns and update current balls
      refreshBallAppearance();
    });

    // crosshair chips
    $('crossStyles').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      S.crossStyle = chip.dataset.ch;
      syncChips();
      applyCrosshairUI();
      saveSettings();
    });
    $('crossColors').addEventListener('click', function (e) {
      var sw = e.target.closest('.swatch');
      if (!sw) return;
      S.crossColor = sw.dataset.color;
      syncChips();
      applyCrosshairUI();
      saveSettings();
    });

    $('btnResetSettings').addEventListener('click', function () {
      for (var k in DEFAULTS) S[k] = DEFAULTS[k];
      saveSettings();
      syncSettingsUI();
      refreshBallAppearance();
      updateFov();
      Audio.setVolume(S.volume);
      if (state === 'playing' || state === 'paused') equip(S.weapon, true);
      markWeaponUI();
    });

    $('btnSettingsClose').addEventListener('click', closeSettings);
    $('btnApplySettings').addEventListener('click', closeSettings);

    // pause
    $('btnResume').addEventListener('click', resumeGame);
    $('btnPauseResumeTop').addEventListener('click', resumeGame);
    $('btnSettingsPause').addEventListener('click', function () { openSettings('pause'); });
    $('btnRestart').addEventListener('click', function () {
      $('pause').classList.add('hidden');
      startGame();
    });
    $('btnQuit').addEventListener('click', function () {
      $('pause').classList.add('hidden');
      toMenu();
    });

    // game over
    $('btnAgain').addEventListener('click', function () {
      $('gameover').classList.add('hidden');
      startGame();
    });
    $('btnOverMenu').addEventListener('click', function () {
      $('gameover').classList.add('hidden');
      toMenu();
    });

    // unlock audio on the very first real gesture
    ['pointerdown', 'keydown'].forEach(function (evName) {
      window.addEventListener(evName, function () {
        if (Audio.ctx && Audio.ctx.state === 'suspended') Audio.resume();
      }, { passive: true });
    });

    // input
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape') {
        if (!$('settings').classList.contains('hidden')) { closeSettings(); return; }
        if (state === 'playing') { pauseGame(); return; }
        if (state === 'paused') { resumeGame(); return; }
      }
      if (e.code === 'Space') e.preventDefault();
      keys[e.code] = true;

      if (state === 'playing') {
        if (e.code === 'KeyR') reload();
        if (e.code === 'KeyQ') { /* reserved */ }
        if (e.code.indexOf('Digit') === 0) {
          var n = parseInt(e.code.slice(5), 10);
          var w = CS.WEAPONS.filter(function (x) { return x.slot === n; })[0];
          if (w) selectWeapon(w.id);
        }
      }
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('blur', function () { keys = {}; mouseDown = false; });

    window.addEventListener('mousedown', function (e) {
      if (state !== 'playing') return;
      if (document.pointerLockElement !== renderer.domElement && e.button === 0) requestLock();
      if (e.button === 0) { mouseDown = true; tryShoot(); }
      if (e.button === 2) toggleScope();
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) mouseDown = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (state !== 'playing') return;
      var zoom = zoomSensFactor();
      var radYaw = S.sens * CS2_M_YAW * DEG2RAD * zoom;
      var radPitch = S.sens * CS2_M_PITCH * DEG2RAD * zoom;
      P.yaw -= e.movementX * radYaw;
      P.pitch -= e.movementY * radPitch;
      P.pitch = clamp(P.pitch, -1.52, 1.52);
      lookDX += e.movementX;
      lookDY += e.movementY;
    });
    window.addEventListener('wheel', function (e) {
      if (state !== 'playing') return;
      var cur = CS.WEAPONS.indexOf(W.def);
      if (cur < 0) cur = 0;
      var dir = e.deltaY > 0 ? 1 : -1;
      var next = (cur + dir + CS.WEAPONS.length) % CS.WEAPONS.length;
      selectWeapon(CS.WEAPONS[next].id);
    }, { passive: true });
    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('pointerlockchange', function () {
      var locked = document.pointerLockElement === renderer.domElement;
      if (!locked && state === 'playing') pauseGame();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'playing') pauseGame();
    });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 250); });
  }

  /* =================== RENDER =================== */
  function onResize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    viewCamera.aspect = w / h;
    viewCamera.updateProjectionMatrix();
    updateFov();
  }

  function render() {
    renderer.clear();
    renderer.render(scene, camera);
    if (state !== 'menu' && !W.scoped) {
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
    }
  }

  function updateFPS(dt) {
    fpsFrames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      var fps = Math.round(fpsFrames / fpsTimer);
      $('fpsBox').textContent = fps + ' FPS';
      fpsFrames = 0; fpsTimer = 0;
    }
  }

  function updateAttract(t) {
    camera.position.set(Math.sin(t * 0.085) * 7.2, 2.6 + Math.sin(t * 0.21) * 0.35, 13.2 + Math.cos(t * 0.06) * 2.4);
    camera.lookAt(Math.sin(t * 0.05) * 2.5, 2.35, -3.5);
  }

  /* =================== LOOP =================== */
  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var now = nowMs();
    var t = now / 1000;

    if (state === 'playing') {
      updatePlayer(dt);
      updateBalls(dt, t);
      updateWaves(dt);
      updateHudDynamic(now);
      if (mouseDown && W.def && W.def.auto) tryShoot();
    } else if (state === 'menu') {
      updateAttract(t);
    }

    if (W.reloading && now >= W.reloadEnd) finishReload();
    if (W.reloading) {
      var pr = clamp((now - W.reloadStart) / (W.reloadEnd - W.reloadStart), 0, 1);
      $('reloadFill').style.width = (pr * 100) + '%';
    }

    updateViewmodel(dt, now);
    FX.update(dt);
    world.update(t, dt);

    // muzzle light decay
    if (muzzleLight.intensity > 0) {
      muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 900);
    }

    updateFov(dt);
    updateCamera();
    render();
    updateFPS(dt);
    if (state === 'playing') {
      var locked = document.pointerLockElement === renderer.domElement;
      $('lockTip').classList.toggle('on', !locked);
    } else {
      $('lockTip').classList.remove('on');
    }
  }

  function updateHudDynamic(now) {
    var spread = currentSpread();
    var gap = (5 + spread * 780 + recoilP * 260) * S.crossSize;
    $('crosshair').style.setProperty('--ch-gap', clamp(gap, 3, 80).toFixed(1) + 'px');
  }

  /* =================== BOOT =================== */
  function loadImages(cb) {
    var total = CS.PLAYER_IMAGES.length, done = 0;
    CS.PLAYER_IMAGES.forEach(function (item, i) {
      var im = new Image();
      im.onload = im.onerror = function () {
        done++;
        if (done === total) cb();
      };
      im.src = item.data;
      images[i] = im;
    });
  }

  function buildStaticUI() {
    // face picker uses images (data urls) — no need to wait for decode
    buildFacePicker();
    buildWeaponUI();
    syncSettingsUI();
    markWeaponUI();
  }

  function init() {
    renderer = new T.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.autoClear = false;

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 220);
    camera.rotation.order = 'YXZ';

    // viewmodel scene
    viewScene = new T.Scene();
    viewCamera = new T.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 12);
    vmHolder = new T.Group();
    viewScene.add(vmHolder);
    viewScene.add(new T.HemisphereLight(0xd8e8f4, 0x2b2620, 1.35));
    var vd = new T.DirectionalLight(0xfff2dc, 2.8); vd.position.set(0.9, 1.7, 1.3); viewScene.add(vd);
    var vd2 = new T.DirectionalLight(0x9cc9e4, 1.5); vd2.position.set(-1.6, 0.5, -1.1); viewScene.add(vd2);
    var vd3 = new T.DirectionalLight(0xffffff, 0.7); vd3.position.set(0, -1, 1.5); viewScene.add(vd3);
    vmFlash = new T.PointLight(0xffc98a, 0, 4, 2);
    vmFlash.position.set(0.15, -0.05, -0.5);
    viewScene.add(vmFlash);
    flashSprite = (function () {
      var c = cvs(128, 128), ctx = c.getContext('2d');
      var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,240,1)');
      g.addColorStop(.22, 'rgba(255,232,170,.95)');
      g.addColorStop(.5, 'rgba(255,168,64,.5)');
      g.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(64, 64, 62, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,.85)';
      ctx.lineWidth = 3;
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3 + 0.2;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 8, 64 + Math.sin(a) * 8);
        ctx.lineTo(64 + Math.cos(a) * rand(44, 60), 64 + Math.sin(a) * rand(44, 60));
        ctx.stroke();
      }
      var tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      var sp = new T.Sprite(new T.SpriteMaterial({
        map: tex, blending: T.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false
      }));
      sp.visible = false;
      sp.scale.setScalar(0.2);
      return sp;
    })();

    world = CS.buildWorld(scene, renderer);
    viewScene.environment = world.env;

    ballGeo = new T.SphereGeometry(1, 32, 22);

    P.hp = 100;
    P.armor = 100;

    muzzleLight = new T.PointLight(0xffc98a, 0, 16, 2);
    scene.add(muzzleLight);

    FX.init();
    bindUI();
    buildStaticUI();

    loadImages(function () {
      // build default weapon + HUD values, then go to menu
      $('hud').classList.add('hidden');
      equip(S.weapon, true);
      updateVitals();
      updateStatsHUD();
      updateAmmoHUD();
      applyCrosshairUI();
      applyHudOpacity();
      onResize();
      clock.start();
      animate();

      // pre-bake the photo textures in the background so the first wave doesn't hitch
      var warm = 0;
      (function warmTextures() {
        if (warm >= images.length) return;
        try { getBallTexture(warm, 'color'); } catch (e) { }
        warm++;
        setTimeout(warmTextures, 220);
      })();
    });
  }

  /* small debug/automation surface (also handy for tinkering) */
  window.CSGame = {
    get state() { return state; },
    P: P, W: W, stats: stats, S: S,
    start: startGame,
    pause: pauseGame,
    spawn: spawnBall,
    clear: clearBalls,
    equip: equip,
    wave: startWave,
    look: function (y, p) { P.yaw = y; P.pitch = p; },
    teleport: function (x, z, y) { P.pos.set(x, y || 0, z); },
    shoot: function () { tryShoot(); },
    balls: balls
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
