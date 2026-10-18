/* ============================================================
   CS: FACE STRIKE — arena / world building
   ============================================================ */
window.CS = window.CS || {};
(function () {
  'use strict';
  var T = window.THREE;

  var BOUNDS = { x: 13.4, z: 17.4, h: 7 };

  function cvs(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tex(canvas, rx, ry, renderer) {
    var t = new T.CanvasTexture(canvas);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function noise(ctx, w, h, amount, alpha) {
    for (var i = 0; i < amount; i++) {
      var x = Math.random() * w, y = Math.random() * h;
      var r = Math.random() * 2.2 + 0.3;
      ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * (alpha || 0.08)) + ')';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }
  }

  /* ---------------- procedural textures ---------------- */
  function floorCanvas(renderer) {
    var S = 512, c = cvs(S, S), ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#5a5348');
    g.addColorStop(.5, '#4c463c');
    g.addColorStop(1, '#57503f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // large tiles
    var n = 2, step = S / n;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var v = 0.86 + Math.random() * 0.22;
        ctx.fillStyle = 'rgba(' + Math.floor(120 * v) + ',' + Math.floor(110 * v) + ',' + Math.floor(94 * v) + ',.22)';
        ctx.fillRect(x * step + 3, y * step + 3, step - 6, step - 6);
      }
    }
    // grout
    ctx.strokeStyle = 'rgba(22,20,17,.6)';
    ctx.lineWidth = 4;
    for (var i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(S, i * step); ctx.stroke();
    }
    // scuffs
    for (var k = 0; k < 90; k++) {
      ctx.strokeStyle = 'rgba(20,18,15,' + (Math.random() * 0.12) + ')';
      ctx.lineWidth = Math.random() * 1.6;
      ctx.beginPath();
      var sx = Math.random() * S, sy = Math.random() * S;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (Math.random() - .5) * 60, sy + (Math.random() - .5) * 60);
      ctx.stroke();
    }
    noise(ctx, S, S, 900, 0.1);
    return tex(c, 8, 10, renderer);
  }

  function wallCanvas(renderer) {
    var S = 512, c = cvs(S, S), ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#8c7f68');
    g.addColorStop(.55, '#82755f');
    g.addColorStop(1, '#6d6250');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    // panels
    var pw = S / 2, ph = S / 4;
    ctx.strokeStyle = 'rgba(38,33,26,.42)';
    ctx.lineWidth = 3;
    for (var x = 0; x <= 2; x++) {
      ctx.beginPath(); ctx.moveTo(x * pw, 0); ctx.lineTo(x * pw, S); ctx.stroke();
    }
    for (var y = 0; y <= 4; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * ph); ctx.lineTo(S, y * ph); ctx.stroke();
    }
    // stains
    for (var i = 0; i < 22; i++) {
      var rx = Math.random() * S, ry = Math.random() * S, rr = 14 + Math.random() * 46;
      var rg = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
      rg.addColorStop(0, 'rgba(58,48,34,' + (0.05 + Math.random() * 0.11) + ')');
      rg.addColorStop(1, 'rgba(58,48,34,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.283); ctx.fill();
    }
    // chipped paint
    for (var k = 0; k < 60; k++) {
      ctx.fillStyle = 'rgba(205,195,170,' + (Math.random() * 0.1) + ')';
      ctx.fillRect(Math.random() * S, Math.random() * S, Math.random() * 7, Math.random() * 4);
    }
    noise(ctx, S, S, 700, 0.09);
    return tex(c, 5, 2.2, renderer);
  }

  function crateCanvas(renderer) {
    var S = 256, c = cvs(S, S), ctx = c.getContext('2d');
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(0, 0, S, S);
    // planks
    for (var i = 0; i < 4; i++) {
      var y = i * (S / 4);
      var v = 0.85 + Math.random() * 0.25;
      ctx.fillStyle = 'rgba(' + Math.floor(150 * v) + ',' + Math.floor(95 * v) + ',' + Math.floor(44 * v) + ',1)';
      ctx.fillRect(4, y + 3, S - 8, S / 4 - 6);
      // grain
      for (var j = 0; j < 26; j++) {
        ctx.strokeStyle = 'rgba(70,40,16,' + (Math.random() * 0.22) + ')';
        ctx.lineWidth = 1;
        var yy = y + 4 + Math.random() * (S / 4 - 8);
        ctx.beginPath(); ctx.moveTo(4, yy); ctx.bezierCurveTo(S * .3, yy + 4, S * .6, yy - 4, S - 4, yy); ctx.stroke();
      }
    }
    // frame
    ctx.fillStyle = '#5b3a18';
    ctx.fillRect(0, 0, S, 16);
    ctx.fillRect(0, S - 16, S, 16);
    ctx.fillRect(0, 0, 16, S);
    ctx.fillRect(S - 16, 0, 16, S);
    ctx.fillStyle = 'rgba(255,220,160,.10)';
    ctx.fillRect(16, 0, S - 32, 4);
    // bolts
    for (var bx = 0; bx < 2; bx++) {
      for (var by = 0; by < 2; by++) {
        var px = bx ? S - 8 : 8, py = by ? S - 8 : 8;
        ctx.fillStyle = '#3a2a16';
        ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.283); ctx.fill();
      }
    }
    // stencil
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-0.04);
    ctx.fillStyle = 'rgba(28,20,12,.55)';
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AIM', 0, 8);
    ctx.font = 'bold 15px Arial';
    ctx.fillText('TRAINING', 0, 30);
    ctx.restore();
    noise(ctx, S, S, 380, 0.12);
    return tex(c, 1, 1, renderer);
  }

  function bannerCanvas(text1, text2, accent, sub) {
    var c = cvs(1024, 320), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 1024, 320);
    ctx.fillStyle = 'rgba(10,13,15,.72)';
    ctx.fillRect(0, 0, 1024, 320);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 14, 320);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(14, 0, 1010, 320);
    ctx.fillStyle = '#f2e9d8';
    ctx.font = 'bold 132px "Arial Narrow", Arial';
    ctx.textAlign = 'left';
    ctx.fillText(text1, 56, 150);
    ctx.fillStyle = accent;
    ctx.font = 'bold 132px "Arial Narrow", Arial';
    ctx.fillText(text2, 56, 270);
    if (sub) {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.font = '26px Arial';
      ctx.fillText(sub, 62, 306);
    }
    return tex(c, 1, 1, null);
  }

  function decalCanvas() {
    var S = 512, c = cvs(S, S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(240,190,90,.5)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.40, 0, 6.283); ctx.stroke();
    ctx.setLineDash([18, 14]);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.33, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
    // crosshair
    ctx.strokeStyle = 'rgba(240,190,90,.55)';
    ctx.lineWidth = 8;
    [0, 1, 2, 3].forEach(function (i) {
      var a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(S / 2 + Math.cos(a) * S * 0.13, S / 2 + Math.sin(a) * S * 0.13);
      ctx.lineTo(S / 2 + Math.cos(a) * S * 0.29, S / 2 + Math.sin(a) * S * 0.29);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(240,190,90,.5)';
    ctx.font = 'bold 34px "Arial Narrow", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AIM ZONE', S / 2, S * 0.87);
    return tex(c, 1, 1, null);
  }

  /* ---------------- environment cube ---------------- */
  function makeEnv(renderer) {
    var size = 128, faces = [];
    for (var i = 0; i < 6; i++) {
      var c = cvs(size, size), ctx = c.getContext('2d');
      var g = ctx.createLinearGradient(0, 0, 0, size);
      if (i === 2) { g.addColorStop(0, '#dfe9f0'); g.addColorStop(1, '#b9cbd8'); }
      else if (i === 3) { g.addColorStop(0, '#2a241d'); g.addColorStop(1, '#15120e'); }
      else {
        g.addColorStop(0, '#9fb1bd');
        g.addColorStop(.45, '#6f818c');
        g.addColorStop(1, '#3b3730');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      if (i !== 2 && i !== 3) {
        // fake bright windows
        ctx.fillStyle = 'rgba(255,246,225,.85)';
        ctx.fillRect(size * 0.12, size * 0.12, size * 0.2, size * 0.5);
        ctx.fillRect(size * 0.55, size * 0.2, size * 0.14, size * 0.42);
        ctx.fillStyle = 'rgba(40,40,42,.55)';
        ctx.fillRect(size * 0.22, size * 0.1, size * 0.02, size * 0.55);
      }
      faces.push(c);
    }
    var cube = new T.CubeTexture(faces);
    cube.needsUpdate = true;
    cube.colorSpace = T.SRGBColorSpace;
    var pm = new T.PMREMGenerator(renderer);
    var env = pm.fromCubemap(cube).texture;
    pm.dispose();
    cube.dispose();
    return env;
  }

  /* ---------------- world ---------------- */
  function build(scene, renderer) {
    var solids = [];
    var hittables = [];
    var addSolid = function (cx, cy, cz, sx, sy, sz) {
      solids.push({
        min: new T.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
        max: new T.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2)
      });
    };

    var env = makeEnv(renderer);
    scene.environment = env;
    scene.background = new T.Color(0x0a0e12);
    scene.fog = new T.FogExp2(0x121a20, 0.017);

    var floorTex = floorCanvas(renderer);
    var wallTex = wallCanvas(renderer);
    var crateTex = crateCanvas(renderer);

    /* floor */
    var floorMat = new T.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.02, color: 0xcfc7b8 });
    var floor = new T.Mesh(new T.PlaneGeometry(BOUNDS.x * 2 + 4, BOUNDS.z * 2 + 4), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    hittables.push(floor);

    /* ceiling */
    var ceilMat = new T.MeshStandardMaterial({ color: 0x6b6960, roughness: 0.94, metalness: 0.06, emissive: 0x14130f });
    var ceil = new T.Mesh(new T.PlaneGeometry(BOUNDS.x * 2 + 4, BOUNDS.z * 2 + 4), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = BOUNDS.h;
    scene.add(ceil);
    hittables.push(ceil);

    /* ceiling beams */
    var beamMat = new T.MeshStandardMaterial({ color: 0x33383a, roughness: 0.8, metalness: 0.25 });
    for (var bi = 0; bi < 5; bi++) {
      var beam = new T.Mesh(new T.BoxGeometry(BOUNDS.x * 2 + 4, 0.34, 0.5), beamMat);
      beam.position.set(0, BOUNDS.h - 0.2, -BOUNDS.z + 4 + bi * 7.4);
      beam.castShadow = false;
      scene.add(beam);
    }

    /* walls */
    var wallMat = new T.MeshStandardMaterial({ map: wallTex, roughness: 0.94, metalness: 0.03, color: 0xd6cbb6 });
    function wall(w, h, d, x, y, z) {
      var m = new T.Mesh(new T.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = false;
      scene.add(m);
      addSolid(x, y, z, w, h, d);
      hittables.push(m);
      return m;
    }
    wall(BOUNDS.x * 2 + 2, BOUNDS.h, 1, 0, BOUNDS.h / 2, -BOUNDS.z - 0.5);
    wall(BOUNDS.x * 2 + 2, BOUNDS.h, 1, 0, BOUNDS.h / 2, BOUNDS.z + 0.5);
    wall(1, BOUNDS.h, BOUNDS.z * 2 + 2, -BOUNDS.x - 0.5, BOUNDS.h / 2, 0);
    wall(1, BOUNDS.h, BOUNDS.z * 2 + 2, BOUNDS.x + 0.5, BOUNDS.h / 2, 0);

    /* skirting / wall trim */
    var trimMat = new T.MeshStandardMaterial({ color: 0x39322a, roughness: 0.8, metalness: 0.15 });
    function trim(w, d, x, z) {
      var m = new T.Mesh(new T.BoxGeometry(w, 0.5, d), trimMat);
      m.position.set(x, 0.25, z);
      m.receiveShadow = true;
      scene.add(m);
    }
    trim(BOUNDS.x * 2, 0.25, 0, -BOUNDS.z + 0.1);
    trim(BOUNDS.x * 2, 0.25, 0, BOUNDS.z - 0.1);
    trim(0.25, BOUNDS.z * 2, -BOUNDS.x + 0.1, 0);
    trim(0.25, BOUNDS.z * 2, BOUNDS.x - 0.1, 0);

    /* ceiling light fixtures */
    var lightMat = new T.MeshStandardMaterial({
      color: 0xfff3dc, emissive: 0xffe8c4, emissiveIntensity: 3.2, roughness: 0.3
    });
    var fixtureMat = new T.MeshStandardMaterial({ color: 0x23282b, roughness: 0.7, metalness: 0.5 });
    var lampSpots = [[-7, -10], [7, -10], [-7, 2], [7, 2], [0, 10]];
    lampSpots.forEach(function (p) {
      var fixt = new T.Mesh(new T.BoxGeometry(3.2, 0.22, 0.7), fixtureMat);
      fixt.position.set(p[0], BOUNDS.h - 0.16, p[1]);
      scene.add(fixt);
      var bulb = new T.Mesh(new T.BoxGeometry(2.9, 0.06, 0.44), lightMat);
      bulb.position.set(p[0], BOUNDS.h - 0.28, p[1]);
      scene.add(bulb);
      var pl = new T.PointLight(0xffe4bc, 26, 20, 2);
      pl.position.set(p[0], BOUNDS.h - 0.7, p[1]);
      scene.add(pl);
    });

    /* sun shaft */
    var sun = new T.DirectionalLight(0xfff0d2, 2.85);
    sun.position.set(9, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.0007;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    var hemi = new T.HemisphereLight(0xa8c0d4, 0x2b241b, 1.0);
    scene.add(hemi);
    var fill = new T.DirectionalLight(0x9fc4dc, 0.6);
    fill.position.set(-8, 6, -10);
    scene.add(fill);

    /* crates */
    var crateMat = new T.MeshStandardMaterial({ map: crateTex, roughness: 0.82, metalness: 0.04, color: 0xd8c39f });
    var crateGeo = new T.BoxGeometry(1, 1, 1);
    function crate(x, z, size, yBase, rot) {
      var m = new T.Mesh(crateGeo, crateMat);
      m.scale.setScalar(size);
      m.position.set(x, (yBase || 0) + size / 2, z);
      m.rotation.y = rot || 0;
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      addSolid(x, m.position.y, z, size + 0.06, size + 0.06, size + 0.06);
      hittables.push(m);
      return m;
    }
    crate(-11.3, -10.2, 1.6);
    crate(-11.3, -10.2, 1.25, 1.6, 0.2);
    crate(-11.4, -6.6, 1.5);
    crate(-11.4, -3.4, 1.7);
    crate(11.4, -9.4, 1.6);
    crate(11.4, -9.4, 1.3, 1.6, -0.15);
    crate(11.4, -5.6, 1.5);
    crate(-5.6, -1.2, 1.4, 0, 0.12);
    crate(-4.2, -1.6, 1.1);
    crate(5.4, -6.2, 1.5, 0, -0.1);
    crate(5.9, -4.9, 1.0);
    crate(-7.8, 13.2, 1.4);
    crate(8.6, 14.4, 1.6, 0, 0.2);
    crate(0.4, -15.2, 1.5);

    /* concrete barriers */
    var barrierMat = new T.MeshStandardMaterial({ color: 0x6d6a61, roughness: 0.95, metalness: 0.02 });
    function barrier(x, z, w, d, rot) {
      var m = new T.Mesh(new T.BoxGeometry(w, 0.95, d), barrierMat);
      m.position.set(x, 0.475, z);
      m.rotation.y = rot || 0;
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      addSolid(x, 0.475, z, w, 0.95, d);
      hittables.push(m);
      // hazard stripe
      var st = new T.Mesh(new T.PlaneGeometry(w * 0.9, 0.14),
        new T.MeshBasicMaterial({ color: 0xe0a13c, transparent: true, opacity: 0.55 }));
      st.position.set(x, 0.78, z + d / 2 + 0.005);
      st.rotation.y = rot || 0;
      scene.add(st);
    }
    barrier(-2.6, 6.4, 3.0, 0.6);
    barrier(3.4, 1.2, 3.0, 0.6, -0.08);
    barrier(-8.2, -13.4, 3.4, 0.6, 0.05);

    /* barrels */
    var barrelMats = [
      new T.MeshStandardMaterial({ color: 0x2f5f78, roughness: 0.5, metalness: 0.6 }),
      new T.MeshStandardMaterial({ color: 0x8a3a2c, roughness: 0.55, metalness: 0.55 })
    ];
    function barrel(x, z, i) {
      var g = new T.Group();
      var body = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 1.05, 20), barrelMats[i % 2]);
      body.position.y = 0.525;
      body.castShadow = true; body.receiveShadow = true;
      g.add(body);
      for (var k = 0; k < 3; k++) {
        var ring = new T.Mesh(new T.TorusGeometry(0.365, 0.022, 6, 22),
          new T.MeshStandardMaterial({ color: 0x1b1e20, roughness: 0.6, metalness: 0.5 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.2 + k * 0.33;
        g.add(ring);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      addSolid(x, 0.55, z, 0.74, 1.1, 0.74);
      hittables.push(body);
    }
    barrel(-1.9, -12.6, 0);
    barrel(1.6, -13.0, 1);
    barrel(-9.4, 4.6, 1);
    barrel(9.8, 3.0, 0);
    barrel(2.2, 9.2, 1);

    /* wall banners */
    function banner(text1, text2, accent, x, y, z, rotY, w, h, sub) {
      var t = bannerCanvas(text1, text2, accent, sub);
      var m = new T.Mesh(new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.94 }));
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      scene.add(m);
    }
    banner('AIM', 'TRAINING', '#e0a13c', 0, 3.6, -BOUNDS.z + 0.02, 0, 7.2, 2.25, 'SECTOR B · 头像靶场');
    banner('FACE', 'STRIKE', '#4f9fc4', 0, 3.6, BOUNDS.z - 0.02, Math.PI, 7.2, 2.25, 'HEADSHOT ZONE');
    banner('TARGET', 'PRACTICE', '#e0a13c', BOUNDS.x - 0.02, 3.2, -2.0, -Math.PI / 2, 6.4, 2.0, '');
    banner('NO', 'MISSES', '#c4553f', -BOUNDS.x + 0.02, 3.2, 2.0, Math.PI / 2, 6.4, 2.0, '');

    /* floor decal */
    var decal = new T.Mesh(new T.PlaneGeometry(9, 9),
      new T.MeshBasicMaterial({ map: decalCanvas(), transparent: true, opacity: 0.5, depthWrite: false }));
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.012, 8.5);
    scene.add(decal);

    /* dust particles */
    var dustGeo = new T.BufferGeometry();
    var N = 500, pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOUNDS.x * 2;
      pos[i * 3 + 1] = Math.random() * BOUNDS.h;
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;
    }
    dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var dust = new T.Points(dustGeo, new T.PointsMaterial({
      color: 0xffe9c9, size: 0.028, transparent: true, opacity: 0.22,
      depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true
    }));
    scene.add(dust);
    var dustBase = pos.slice(0);

    return {
      solids: solids,
      hittables: hittables,
      bounds: BOUNDS,
      env: env,
      sun: sun,
      dust: dust,
      dustBase: dustBase,
      spawn: new T.Vector3(0, 0, 12.5),
      update: function (t, dt) {
        var p = dust.geometry.attributes.position;
        for (var i = 0; i < N; i++) {
          var y = dustBase[i * 3 + 1] + Math.sin(t * 0.25 + i) * 0.25 + (t * 0.02) % 1;
          p.array[i * 3 + 1] = y % BOUNDS.h;
          p.array[i * 3] = dustBase[i * 3] + Math.sin(t * 0.12 + i * 1.7) * 0.15;
        }
        p.needsUpdate = true;
      }
    };
  }

  window.CS.buildWorld = build;
})();
