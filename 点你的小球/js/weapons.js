/* ============================================================
   CS: FACE STRIKE — weapon definitions & procedural viewmodels
   ============================================================ */
window.CS = window.CS || {};
(function () {
  'use strict';
  var T = window.THREE;

  /* ---------- material helpers ---------- */
  function M(color, metal, rough, emissive) {
    return new T.MeshStandardMaterial({
      color: color,
      metalness: metal === undefined ? 0.6 : metal,
      roughness: rough === undefined ? 0.4 : rough,
      emissive: emissive || 0x000000
    });
  }
  var MAT = {
    steel: M(0x9aa1a6, 0.95, 0.26),
    darkSteel: M(0x3a4045, 0.85, 0.36),
    gunmetal: M(0x24282c, 0.82, 0.34),
    black: M(0x1b1e21, 0.55, 0.46),
    polymer: M(0x24282b, 0.16, 0.62),
    tan: M(0x8a7a5e, 0.14, 0.66),
    wood: M(0x6d3d1d, 0.06, 0.52),
    woodDark: M(0x4a2712, 0.06, 0.55),
    gold: M(0xc7a04a, 0.95, 0.26),
    od: M(0x3c463a, 0.35, 0.52),
    brass: M(0xb08a3e, 0.95, 0.3),
    sleeve: M(0x2b2f2c, 0.04, 0.88),
    lens: new T.MeshStandardMaterial({ color: 0x1d4a5c, metalness: 1, roughness: 0.06, emissive: 0x08222b }),
    redDot: new T.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff2a1e, emissiveIntensity: 2, roughness: 0.3 })
  };

  function box(parent, w, h, d, m, x, y, z, rx, ry, rz) {
    var g = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    g.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) g.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(g);
    return g;
  }
  function cyl(parent, rt, rb, h, m, x, y, z, rx, ry, rz, seg) {
    var g = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 16, 1), m);
    g.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) g.rotation.set(rx || 0, ry || 0, rz || 0);
    parent.add(g);
    return g;
  }
  function group(parent, x, y, z) {
    var g = new T.Group();
    g.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(g);
    return g;
  }
  function glove(parent, x, y, z, rot, left) {
    var g = group(parent, x, y, z);
    g.rotation.set(rot[0], rot[1], rot[2]);
    g.userData.noThumb = true;
    var hand = new T.Mesh(new T.CapsuleGeometry(0.026, 0.065, 4, 10), MAT.polymer);
    hand.rotation.z = Math.PI / 2;
    hand.scale.set(1, 1, 0.78);
    g.add(hand);
    // fingers wrapping
    var f1 = new T.Mesh(new T.CapsuleGeometry(0.012, 0.05, 3, 8), MAT.polymer);
    f1.position.set(0.0, 0.012, -0.03);
    f1.rotation.set(0.25, 0, 0);
    g.add(f1);
    // forearm reaching out of frame
    var arm = new T.Mesh(new T.CylinderGeometry(0.027, 0.042, 0.24, 12, 1), MAT.sleeve);
    arm.position.set(left ? -0.018 : 0.014, -0.105, 0.085);
    arm.rotation.set(left ? 1.78 : 1.86, 0, left ? 0.62 : -0.56);
    arm.userData.noThumb = true;
    g.add(arm);
    var cuff = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.022, 12, 1), MAT.polymer);
    cuff.position.set(left ? -0.008 : 0.006, -0.072, 0.052);
    cuff.rotation.set(left ? 1.78 : 1.86, 0, left ? 0.62 : -0.56);
    cuff.userData.noThumb = true;
    g.add(cuff);
    return g;
  }

  /* ============================================================
     MODEL BUILDERS  (barrel points toward -Z, grip near origin)
     ============================================================ */

  function buildDeagle() {
    var g = new T.Group();
    var slide = group(g);
    box(slide, 0.054, 0.062, 0.245, MAT.steel, 0, 0.036, -0.085);
    box(slide, 0.032, 0.012, 0.20, MAT.steel, 0, 0.070, -0.08);       // top rib
    box(slide, 0.055, 0.018, 0.055, MAT.steel, 0, 0.030, -0.205);     // front block
    cyl(slide, 0.019, 0.019, 0.03, MAT.darkSteel, 0, 0.036, -0.235, Math.PI / 2, 0, 0, 18);
    cyl(slide, 0.022, 0.022, 0.012, MAT.steel, 0, 0.036, -0.248, Math.PI / 2, 0, 0, 18);
    // serrations
    for (var i = 0; i < 4; i++) box(slide, 0.056, 0.038, 0.006, MAT.darkSteel, 0, 0.035, 0.012 - i * 0.011);
    // ejection port
    box(slide, 0.058, 0.022, 0.055, MAT.black, 0.001, 0.045, -0.09);
    // sights
    box(slide, 0.026, 0.011, 0.012, MAT.gunmetal, 0, 0.078, 0.012);
    box(slide, 0.007, 0.013, 0.008, MAT.gold, 0, 0.079, -0.20);
    // frame
    var frame = group(g);
    box(frame, 0.049, 0.030, 0.215, MAT.gold, 0, -0.008, -0.085);
    box(frame, 0.030, 0.012, 0.15, MAT.darkSteel, 0, -0.031, -0.10);  // rail
    box(frame, 0.012, 0.012, 0.055, MAT.gold, 0, -0.042, -0.045);     // guard front
    box(frame, 0.012, 0.028, 0.012, MAT.gold, 0, -0.055, -0.015);     // guard rear
    var grip = box(frame, 0.047, 0.135, 0.064, MAT.polymer, 0, -0.093, 0.018, 0.24, 0, 0);
    for (var j = 0; j < 5; j++) {
      box(grip, 0.049, 0.012, 0.005, MAT.black, 0, -0.045 - j * 0.02, 0.032 - j * 0.005, 0.24, 0, 0).visible = false;
    }
    box(g, 0.028, 0.045, 0.028, MAT.gunmetal, 0, -0.11, 0.035, 0.1, 0, 0);  // mag base
    box(g, 0.014, 0.020, 0.016, MAT.darkSteel, 0, 0.058, 0.033);            // hammer
    glove(g, 0.002, -0.085, 0.045, [0.35, 0.2, 0.1]);
    g.userData.slide = slide;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.036, -0.255);
    g.add(g.userData.muzzle);
    return g;
  }

  function buildAK() {
    var g = new T.Group();
    // receiver
    box(g, 0.050, 0.072, 0.25, MAT.gunmetal, 0, 0, -0.02);
    box(g, 0.046, 0.020, 0.215, MAT.darkSteel, 0, 0.046, -0.03);        // dust cover
    box(g, 0.052, 0.014, 0.02, MAT.darkSteel, 0, 0.036, 0.09);
    // wood furniture
    box(g, 0.056, 0.055, 0.155, MAT.wood, 0, -0.002, -0.235);
    box(g, 0.046, 0.026, 0.135, MAT.wood, 0, 0.045, -0.215);
    cyl(g, 0.011, 0.011, 0.34, MAT.darkSteel, 0, 0.012, -0.30, Math.PI / 2, 0, 0, 14);
    cyl(g, 0.009, 0.009, 0.16, MAT.gunmetal, 0, 0.046, -0.30, Math.PI / 2, 0, 0, 12);
    // front sight block
    box(g, 0.026, 0.045, 0.03, MAT.gunmetal, 0, 0.032, -0.455);
    box(g, 0.005, 0.022, 0.005, MAT.darkSteel, 0, 0.055, -0.46);
    cyl(g, 0.017, 0.017, 0.055, MAT.darkSteel, 0, 0.012, -0.515, Math.PI / 2, 0, 0, 12);
    cyl(g, 0.012, 0.012, 0.01, MAT.black, 0, 0.012, -0.545, Math.PI / 2, 0, 0, 12);
    // magazine (banana, three segments)
    var mag = new T.Group();
    var m1 = box(mag, 0.043, 0.085, 0.075, MAT.woodDark, 0, -0.048, -0.055, 0.14, 0, 0);
    var m2 = box(mag, 0.042, 0.075, 0.072, MAT.woodDark, 0, -0.115, -0.028, 0.34, 0, 0);
    var m3 = box(mag, 0.041, 0.062, 0.068, MAT.woodDark, 0, -0.172, 0.012, 0.58, 0, 0);
    g.add(mag);
    // pistol grip + trigger
    box(g, 0.036, 0.105, 0.052, MAT.woodDark, 0, -0.095, 0.085, 0.30, 0, 0);
    box(g, 0.010, 0.010, 0.045, MAT.gunmetal, 0, -0.058, -0.005);
    box(g, 0.008, 0.026, 0.012, MAT.darkSteel, 0, -0.040, 0.032);
    // stock
    box(g, 0.040, 0.072, 0.20, MAT.wood, 0, -0.006, 0.20, -0.04, 0, 0);
    box(g, 0.044, 0.082, 0.018, MAT.woodDark, 0, -0.010, 0.30, -0.04, 0, 0);
    box(g, 0.012, 0.02, 0.05, MAT.darkSteel, 0.026, 0.025, 0.10);       // selector
    box(g, 0.020, 0.012, 0.018, MAT.darkSteel, 0, 0.062, 0.06);         // rear sight
    glove(g, 0.006, -0.075, 0.075, [0.35, 0.1, 0.15]);
    glove(g, -0.006, -0.035, -0.24, [0.15, -0.1, -0.35], true);
    g.userData.mag = mag;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.012, -0.56);
    g.add(g.userData.muzzle);
    return g;
  }

  function buildM4() {
    var g = new T.Group();
    box(g, 0.048, 0.068, 0.26, MAT.gunmetal, 0, 0, -0.01);
    box(g, 0.030, 0.012, 0.30, MAT.gunmetal, 0, 0.040, -0.03);          // top rail
    for (var i = 0; i < 10; i++) box(g, 0.031, 0.006, 0.008, MAT.darkSteel, 0, 0.048, 0.10 - i * 0.028);
    // handguard
    box(g, 0.048, 0.046, 0.21, MAT.polymer, 0, 0.004, -0.235);
    box(g, 0.020, 0.008, 0.18, MAT.gunmetal, 0, 0.033, -0.235);
    box(g, 0.006, 0.030, 0.19, MAT.gunmetal, 0.026, 0.004, -0.235);
    cyl(g, 0.009, 0.009, 0.38, MAT.darkSteel, 0, 0.012, -0.32, Math.PI / 2, 0, 0, 12);
    cyl(g, 0.015, 0.015, 0.06, MAT.gunmetal, 0, 0.012, -0.505, Math.PI / 2, 0, 0, 14);
    box(g, 0.026, 0.046, 0.024, MAT.gunmetal, 0, 0.036, -0.44);         // front sight
    box(g, 0.005, 0.018, 0.005, MAT.darkSteel, 0, 0.058, -0.44);
    // magazine
    var mag = new T.Group();
    box(mag, 0.039, 0.155, 0.070, MAT.polymer, 0, -0.095, -0.035, 0.13, 0, 0);
    box(mag, 0.041, 0.012, 0.074, MAT.black, 0, -0.17, -0.02, 0.13, 0, 0);
    g.add(mag);
    box(g, 0.034, 0.10, 0.05, MAT.polymer, 0, -0.09, 0.095, 0.30, 0, 0);
    box(g, 0.010, 0.010, 0.045, MAT.gunmetal, 0, -0.054, 0.005);
    box(g, 0.008, 0.026, 0.012, MAT.darkSteel, 0, -0.038, 0.04);
    // stock
    cyl(g, 0.016, 0.016, 0.10, MAT.gunmetal, 0, 0.005, 0.17, Math.PI / 2, 0, 0, 12);
    box(g, 0.040, 0.062, 0.14, MAT.polymer, 0, -0.004, 0.26);
    box(g, 0.043, 0.075, 0.016, MAT.black, 0, -0.004, 0.33);
    box(g, 0.024, 0.012, 0.016, MAT.darkSteel, 0, 0.055, 0.04);         // rear sight
    glove(g, 0.006, -0.07, 0.085, [0.35, 0.1, 0.15]);
    glove(g, -0.006, -0.03, -0.235, [0.15, -0.1, -0.35], true);
    g.userData.mag = mag;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.012, -0.545);
    g.add(g.userData.muzzle);
    return g;
  }

  function buildAWP() {
    var g = new T.Group();
    box(g, 0.052, 0.075, 0.38, MAT.od, 0, -0.002, -0.03);
    box(g, 0.044, 0.020, 0.30, MAT.darkSteel, 0, 0.040, -0.05);
    cyl(g, 0.013, 0.013, 0.46, MAT.gunmetal, 0, 0.016, -0.42, Math.PI / 2, 0, 0, 14);
    cyl(g, 0.019, 0.019, 0.07, MAT.darkSteel, 0, 0.016, -0.635, Math.PI / 2, 0, 0, 14);
    // chassis / stock
    box(g, 0.048, 0.055, 0.26, MAT.od, 0, -0.012, 0.27, -0.02, 0, 0);
    box(g, 0.042, 0.086, 0.032, MAT.od, 0, -0.030, 0.405, -0.02, 0, 0);
    box(g, 0.036, 0.030, 0.13, MAT.od, 0, 0.052, 0.20);                 // cheek rest
    box(g, 0.034, 0.10, 0.05, MAT.od, 0, -0.085, 0.12, 0.24, 0, 0);     // grip
    // scope
    var scope = group(g);
    cyl(scope, 0.040, 0.040, 0.26, MAT.black, 0, 0.105, -0.075, Math.PI / 2, 0, 0, 20);
    cyl(scope, 0.047, 0.040, 0.05, MAT.black, 0, 0.105, -0.225, Math.PI / 2, 0, 0, 20);
    cyl(scope, 0.036, 0.042, 0.05, MAT.black, 0, 0.105, 0.07, Math.PI / 2, 0, 0, 20);
    cyl(scope, 0.041, 0.041, 0.006, MAT.lens, 0, 0.105, -0.252, Math.PI / 2, 0, 0, 20);
    cyl(scope, 0.034, 0.034, 0.006, MAT.lens, 0, 0.105, 0.096, Math.PI / 2, 0, 0, 20);
    box(scope, 0.030, 0.030, 0.028, MAT.gunmetal, 0, 0.075, -0.145);
    box(scope, 0.030, 0.030, 0.028, MAT.gunmetal, 0, 0.075, 0.005);
    // bolt
    var bolt = group(g);
    box(bolt, 0.020, 0.020, 0.05, MAT.darkSteel, 0.042, 0.020, 0.045);
    cyl(bolt, 0.007, 0.007, 0.055, MAT.darkSteel, 0.070, 0.020, 0.055, 0, 0, Math.PI / 2, 10);
    cyl(bolt, 0.011, 0.011, 0.014, MAT.black, 0.098, 0.020, 0.055, 0, 0, Math.PI / 2, 10);
    // magazine
    var mag = new T.Group();
    box(mag, 0.042, 0.075, 0.10, MAT.polymer, 0, -0.070, -0.055);
    g.add(mag);
    // bipod stub
    box(g, 0.012, 0.05, 0.012, MAT.gunmetal, 0, -0.05, -0.36, 0, 0, 0.5);
    glove(g, 0.006, -0.08, 0.11, [0.35, 0.1, 0.15]);
    glove(g, -0.004, -0.045, -0.30, [0.15, -0.1, -0.35], true);
    g.userData.mag = mag;
    g.userData.bolt = bolt;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.016, -0.675);
    g.add(g.userData.muzzle);
    return g;
  }

  function buildUSP() {
    var g = new T.Group();
    var slide = group(g);
    box(slide, 0.044, 0.052, 0.215, MAT.black, 0, 0.030, -0.06);
    box(slide, 0.045, 0.012, 0.19, MAT.darkSteel, 0, 0.057, -0.06);
    for (var i = 0; i < 5; i++) box(slide, 0.046, 0.030, 0.005, MAT.gunmetal, 0, 0.030, 0.030 - i * 0.009);
    box(slide, 0.011, 0.010, 0.012, MAT.gunmetal, 0, 0.064, 0.026);
    box(slide, 0.006, 0.010, 0.008, MAT.gunmetal, 0, 0.062, -0.155);
    // suppressor
    cyl(g, 0.026, 0.026, 0.20, MAT.gunmetal, 0, 0.030, -0.255, Math.PI / 2, 0, 0, 18);
    cyl(g, 0.028, 0.028, 0.012, MAT.black, 0, 0.030, -0.352, Math.PI / 2, 0, 0, 18);
    for (var k = 0; k < 3; k++) cyl(g, 0.0272, 0.0272, 0.006, MAT.darkSteel, 0, 0.030, -0.20 - k * 0.05, Math.PI / 2, 0, 0, 18);
    // frame
    box(g, 0.042, 0.030, 0.17, MAT.polymer, 0, -0.006, -0.045);
    box(g, 0.026, 0.010, 0.12, MAT.gunmetal, 0, -0.028, -0.09);
    box(g, 0.011, 0.010, 0.048, MAT.polymer, 0, -0.040, -0.02);
    box(g, 0.011, 0.026, 0.011, MAT.polymer, 0, -0.052, 0.008);
    box(g, 0.040, 0.125, 0.058, MAT.polymer, 0, -0.085, 0.022, 0.24, 0, 0);
    box(g, 0.042, 0.012, 0.028, MAT.black, 0, -0.145, 0.042, 0.24, 0, 0);
    glove(g, 0.002, -0.082, 0.048, [0.35, 0.2, 0.1]);
    g.userData.slide = slide;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.030, -0.36);
    g.add(g.userData.muzzle);
    return g;
  }

  function buildNova() {
    var g = new T.Group();
    box(g, 0.052, 0.078, 0.26, MAT.gunmetal, 0, -0.005, -0.02);
    box(g, 0.048, 0.024, 0.20, MAT.darkSteel, 0, 0.040, -0.05);
    cyl(g, 0.015, 0.015, 0.52, MAT.darkSteel, 0, 0.032, -0.40, Math.PI / 2, 0, 0, 14);
    cyl(g, 0.013, 0.013, 0.44, MAT.gunmetal, 0, -0.004, -0.36, Math.PI / 2, 0, 0, 14);   // tube mag
    cyl(g, 0.018, 0.018, 0.03, MAT.black, 0, 0.032, -0.665, Math.PI / 2, 0, 0, 14);
    box(g, 0.010, 0.014, 0.010, MAT.steel, 0, 0.052, -0.64);
    // pump
    var pump = new T.Group();
    box(pump, 0.062, 0.052, 0.13, MAT.wood, 0, 0.006, -0.30);
    for (var i = 0; i < 5; i++) box(pump, 0.064, 0.006, 0.008, MAT.woodDark, 0, 0.006, -0.255 - i * 0.022);
    g.add(pump);
    // stock
    box(g, 0.042, 0.075, 0.22, MAT.wood, 0, -0.030, 0.22, 0.02, 0, 0);
    box(g, 0.046, 0.09, 0.018, MAT.woodDark, 0, -0.034, 0.33, 0.02, 0, 0);
    box(g, 0.036, 0.10, 0.05, MAT.woodDark, 0, -0.088, 0.085, 0.26, 0, 0);
    box(g, 0.011, 0.010, 0.05, MAT.gunmetal, 0, -0.050, -0.005);
    box(g, 0.009, 0.026, 0.013, MAT.darkSteel, 0, -0.034, 0.032);
    box(g, 0.014, 0.010, 0.05, MAT.gunmetal, 0.028, 0.030, -0.14);    // shell port
    glove(g, 0.006, -0.075, 0.085, [0.35, 0.1, 0.15]);
    glove(g, -0.004, -0.04, -0.30, [0.15, -0.1, -0.35], true);
    g.userData.pump = pump;
    g.userData.muzzle = new T.Object3D();
    g.userData.muzzle.position.set(0, 0.032, -0.69);
    g.add(g.userData.muzzle);
    return g;
  }

  /* ============================================================
     WEAPON TABLE
     ============================================================ */
  var WEAPONS = [
    {
      id: 'deagle', slot: 1, name: '沙漠之鹰', en: 'DESERT EAGLE', tag: 'PISTOL',
      damage: 62, headMult: 2.2, rpm: 240, auto: false, mag: 7, reserve: 35,
      reload: 2.15, spread: 0.0035, moveSpread: 0.030, pellets: 1, range: 120,
      kick: 0.070, kickYaw: 0.016, viewKick: 1.0, moveSpeed: 1.02, zoom: 0,
      sound: { gain: 1.0, crack: 1500, crackDecay: 0.06, filter: 2600, decay: 0.30, body: 128, thump: 0.20, tail: 0.30 },
      stats: { dmg: 92, rpm: 32, acc: 74, ctrl: 46 },
      view: { pos: [0.142, -0.136, -0.475], rot: [-0.055, 0.06, 0.0], scale: 0.88 },
      build: buildDeagle
    },
    {
      id: 'ak47', slot: 2, name: 'AK-47', en: 'AK-47', tag: 'RIFLE',
      damage: 33, headMult: 2.6, rpm: 600, auto: true, mag: 30, reserve: 90,
      reload: 2.45, spread: 0.008, moveSpread: 0.055, pellets: 1, range: 120,
      kick: 0.030, kickYaw: 0.013, viewKick: 0.85, moveSpeed: 1.0, zoom: 0,
      sound: { gain: 0.95, crack: 1900, crackDecay: 0.05, filter: 3000, decay: 0.17, body: 150, thump: 0.15, tail: 0.18 },
      stats: { dmg: 80, rpm: 68, acc: 62, ctrl: 40 },
      view: { pos: [0.145, -0.128, -0.470], rot: [0.0, 0.06, 0.0], scale: 0.71 },
      build: buildAK
    },
    {
      id: 'm4a4', slot: 3, name: 'M4A4', en: 'M4A4', tag: 'RIFLE',
      damage: 30, headMult: 2.6, rpm: 666, auto: true, mag: 30, reserve: 90,
      reload: 2.55, spread: 0.0062, moveSpread: 0.048, pellets: 1, range: 120,
      kick: 0.023, kickYaw: 0.0085, viewKick: 0.7, moveSpeed: 1.02, zoom: 0,
      sound: { gain: 0.82, crack: 2300, crackDecay: 0.04, filter: 3400, decay: 0.14, body: 168, thump: 0.12, tail: 0.14 },
      stats: { dmg: 70, rpm: 74, acc: 80, ctrl: 64 },
      view: { pos: [0.145, -0.128, -0.470], rot: [0.0, 0.06, 0.0], scale: 0.71 },
      build: buildM4
    },
    {
      id: 'awp', slot: 4, name: 'AWP', en: 'AWP', tag: 'SNIPER',
      damage: 118, headMult: 2.0, rpm: 42, auto: false, mag: 10, reserve: 30,
      reload: 3.3, spread: 0.016, moveSpread: 0.09, pellets: 1, range: 200,
      kick: 0.115, kickYaw: 0.024, viewKick: 1.6, moveSpeed: 0.78, zoom: 1,
      scopedSpread: 0.0004,
      sound: { gain: 1.15, crack: 1000, crackDecay: 0.09, filter: 2100, decay: 0.5, body: 92, thump: 0.34, tail: 0.9 },
      stats: { dmg: 100, rpm: 14, acc: 96, ctrl: 24 },
      view: { pos: [0.148, -0.130, -0.520], rot: [-0.01, 0.05, 0.0], scale: 0.65 },
      build: buildAWP
    },
    {
      id: 'usps', slot: 5, name: 'USP-S', en: 'USP-S', tag: 'PISTOL',
      damage: 28, headMult: 2.8, rpm: 352, auto: false, mag: 12, reserve: 48,
      reload: 2.0, spread: 0.0042, moveSpread: 0.032, pellets: 1, range: 100,
      kick: 0.019, kickYaw: 0.006, viewKick: 0.55, moveSpeed: 1.04, zoom: 0,
      sound: { gain: 0.42, crack: 3100, crackDecay: 0.03, filter: 1500, decay: 0.09, body: 230, thump: 0.09, tail: 0.05 },
      stats: { dmg: 52, rpm: 50, acc: 88, ctrl: 78 },
      view: { pos: [0.142, -0.136, -0.475], rot: [-0.055, 0.06, 0.0], scale: 0.88 },
      build: buildUSP
    },
    {
      id: 'nova', slot: 6, name: '新星霰弹枪', en: 'NOVA', tag: 'SHOTGUN',
      damage: 19, headMult: 2.0, rpm: 68, auto: false, mag: 8, reserve: 32,
      reload: 3.1, spread: 0.062, moveSpread: 0.11, pellets: 8, range: 40,
      kick: 0.095, kickYaw: 0.02, viewKick: 1.25, moveSpeed: 0.94, zoom: 0,
      sound: { gain: 1.05, crack: 1300, crackDecay: 0.07, filter: 2400, decay: 0.32, body: 112, thump: 0.26, tail: 0.25 },
      stats: { dmg: 86, rpm: 24, acc: 30, ctrl: 34 },
      view: { pos: [0.145, -0.128, -0.485], rot: [0.0, 0.05, 0.0], scale: 0.67 },
      build: buildNova
    }
  ];

  function get(id) {
    for (var i = 0; i < WEAPONS.length; i++) if (WEAPONS[i].id === id) return WEAPONS[i];
    return WEAPONS[1];
  }

  /* ============================================================
     thumbnails rendered from the real 3D models
     ============================================================ */
  var thumbCache = null;
  function generateThumbs() {
    if (thumbCache) return thumbCache;
    var W = 360, H = 168;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var r;
    try {
      r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return {}; }
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.28;

    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(27, W / H, 0.01, 20);
    cam.position.set(1.02, 0.4, -0.56);
    cam.lookAt(0, -0.01, -0.14);

    scene.environment = window.CS.__env || null;
    scene.add(new T.HemisphereLight(0xbfd4e0, 0x14181c, 3.1));
    var key = new T.DirectionalLight(0xfff0d8, 4.6);
    key.position.set(1.2, 2.2, 1.6);
    scene.add(key);
    var rim = new T.DirectionalLight(0x6fb4d8, 3.2);
    rim.position.set(-1.8, 0.6, -2.2);
    scene.add(rim);
    var fill = new T.DirectionalLight(0xffffff, 1.6);
    fill.position.set(-1.0, -1.4, 1.0);
    scene.add(fill);

    var out = {};
    WEAPONS.forEach(function (w) {
      var g = w.build();
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0.18, 0.04);
      g.traverse(function (o) { if (o.userData && o.userData.noThumb) o.visible = false; });
      var s = w.id === 'awp' ? 0.86 : 0.98;
      g.scale.setScalar(s);
      scene.add(g);
      r.render(scene, cam);
      out[w.id] = r.domElement.toDataURL('image/png');
      scene.remove(g);
      g.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
      });
    });

    r.dispose();
    if (r.forceContextLoss) r.forceContextLoss();
    thumbCache = out;
    return out;
  }

  window.CS.WEAPONS = WEAPONS;
  window.CS.getWeapon = get;
  window.CS.MAT = MAT;
  window.CS.buildWeapon = function (w) { return w.build(); };
  window.CS.generateWeaponThumbs = generateThumbs;
})();
