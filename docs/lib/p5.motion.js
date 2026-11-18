/*!
 * p5.motion.js v0.1.0
 * Camera motion tracking for p5.js 2.x: background subtraction, blobs,
 * active zones and Lucas-Kanade optical flow.
 *
 * Inspired by p5.vida by Paweł Janicki (http://tetoki.eu/vida), rewritten for
 * speed and a p5-style API. MIT License.
 *
 * ---------------------------------------------------------------------------
 * QUICK START
 * ---------------------------------------------------------------------------
 *
 *   let cam, motion;
 *
 *   function setup() {
 *     createCanvas(640, 480);
 *     cam = createCapture(VIDEO, { flipped: true });
 *     cam.hide();
 *     motion = createMotion(cam);              // updates itself every frame
 *     motion.zone('left', 40, 160, 160, 160)
 *       .onEnter(z => console.log('enter', z.id))
 *       .onExit(z => console.log('exit', z.id));
 *   }
 *
 *   function draw() {
 *     image(cam, 0, 0, width, height);
 *     motion.debug();                          // mask, zones, blobs, flow
 *   }
 *
 * All positions and sizes you give or get are in CANVAS PIXELS. By default the
 * camera is mapped onto the whole canvas; use motion.mapTo(x, y, w, h) if you
 * draw the camera somewhere else.
 *
 * ---------------------------------------------------------------------------
 * createMotion(source, [options])
 * ---------------------------------------------------------------------------
 *   source   p5 capture/video, p5.Graphics, p5.Image, or an HTML video/canvas.
 *   options  (all optional)
 *     resolution   320        processing width in pixels (height follows the
 *                             source's aspect ratio). Smaller = faster.
 *     background   'adaptive' 'adaptive' - slowly learns the scene
 *                             'static'   - learns once; call
 *                                          captureBackground() to relearn
 *                             'frame'    - compares with the previous frame
 *                                          (pure movement, like a trail)
 *     adapt        0.05       adaptive learning speed, 0..1 (higher = people
 *                             who stand still fade into the background sooner)
 *     threshold    0.15       brightness difference that counts as motion, 0..1
 *     denoise      true       light blur before processing (less speckle)
 *     blobs        true       detect and track blobs
 *     minArea      0.002      smallest blob, as a fraction of the frame
 *     maxBlobs     16         keep at most this many (largest first)
 *     trackDistance 0.15      how far a blob may move per frame and keep its
 *                             id, as a fraction of the frame width
 *     lostFrames   3          frames a blob may vanish before it is "exited"
 *     flow         true       optical flow (true/false or an options object):
 *       step       8          grid spacing in processing pixels
 *       window     4          LK window radius in pixels
 *       levels     4          pyramid levels (more = catches faster motion)
 *       iterations 3          refinement steps per level
 *       smoothing  0.5        temporal smoothing 0..1
 *       minSpeed   0.3        ignore vectors slower than this (canvas px/frame)
 *       minTexture 4          ignore flat areas with less texture than this
 *       maskOnly   true       only compute flow where motion is detected
 *     flip         auto       mirror horizontally (defaults to the capture's
 *                             own { flipped: true } setting)
 *     autoUpdate   true       update automatically before each draw()
 *
 * ---------------------------------------------------------------------------
 * THE MOTION OBJECT
 * ---------------------------------------------------------------------------
 *   motion.ready            true once the source delivers frames
 *   motion.amount           fraction of the frame that is moving, 0..1
 *   motion.blobs            array of tracked blobs (see below)
 *   motion.zones            array of zones
 *   motion.mask             p5.Image of the motion mask (white = motion)
 *   motion.width/.height    processing resolution
 *
 *   motion.zone(id, x, y, w, h)  add a zone (returns it, chainable)
 *   motion.getZone(id) / motion.removeZone(id)
 *   motion.flowAt(x, y)          p5.Vector of motion at a canvas point
 *   motion.averageFlow()         p5.Vector, average of moving areas
 *   motion.forEachFlow((x, y, vx, vy) => {...})   every flow-grid vector
 *   motion.onBlobEnter(fn) / motion.onBlobExit(fn)
 *   motion.captureBackground()   relearn the background from the next frame
 *   motion.mapTo(x, y, w, h)     where the camera is drawn on the canvas
 *   motion.update()              manual update (when autoUpdate is false)
 *   motion.debug([options])      draw { mask, zones, blobs, flow }
 *   motion.set(options)          change options on the fly
 *
 * BLOB:  id, age, isNew, x, y, w, h (bounding box), cx, cy (centre of mass),
 *        area (0..1), velocity (p5.Vector), hull() -> array of p5.Vector
 *        plus normalized nx, ny, nw, nh, ncx, ncy (0..1)
 *
 * ZONE:  id, x, y, w, h, amount (0..1), active, threshold, flow (p5.Vector),
 *        onEnter(fn), onExit(fn), onChange(fn), setThreshold(t),
 *        moveTo(x, y, w, h), remove()
 */

(function () {
  'use strict';

  var DEFAULTS = {
    resolution: 320,
    background: 'adaptive',
    adapt: 0.05,
    threshold: 0.15,
    denoise: true,
    blobs: true,
    minArea: 0.002,
    maxBlobs: 16,
    trackDistance: 0.15,
    lostFrames: 3,
    flow: true,
    flip: undefined,
    autoUpdate: true
  };

  var FLOW_DEFAULTS = {
    step: 8,
    window: 4,
    levels: 4,
    iterations: 3,
    smoothing: 0.5,
    minSpeed: 0.3,
    minTexture: 4,
    maskOnly: true
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ======================================================================== */
  /* Zone                                                                     */
  /* ======================================================================== */

  function MotionZone(tracker, id, x, y, w, h) {
    this.tracker = tracker;
    this.id = id;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.threshold = 0.02;
    this.amount = 0;
    this.active = false;
    this._vx = 0; this._vy = 0;
    this._enter = []; this._exit = []; this._change = [];
  }

  MotionZone.prototype.onEnter = function (fn) { this._enter.push(fn); return this; };
  MotionZone.prototype.onExit = function (fn) { this._exit.push(fn); return this; };
  MotionZone.prototype.onChange = function (fn) { this._change.push(fn); return this; };
  MotionZone.prototype.setThreshold = function (t) { this.threshold = t; return this; };
  MotionZone.prototype.moveTo = function (x, y, w, h) {
    this.x = x; this.y = y;
    if (w !== undefined) this.w = w;
    if (h !== undefined) this.h = h;
    return this;
  };
  MotionZone.prototype.remove = function () { this.tracker.removeZone(this.id); };
  MotionZone.prototype.contains = function (px, py) {
    return px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h;
  };
  Object.defineProperty(MotionZone.prototype, 'flow', {
    get: function () { return this.tracker.p.createVector(this._vx, this._vy); }
  });

  /* ======================================================================== */
  /* Blob                                                                     */
  /* ======================================================================== */

  var nextBlobId = 0;

  function MotionBlob(tracker) {
    this.tracker = tracker;
    this.id = nextBlobId++;
    this.age = 0;
    this.isNew = true;
    this.nx = 0; this.ny = 0; this.nw = 0; this.nh = 0;
    this.ncx = 0; this.ncy = 0;
    this.area = 0;
    this._vx = 0; this._vy = 0;
    this._lost = 0;
    this._label = -1;
    this._frame = -1;
    this._hull = null;
    this._hullFrame = -1;
  }

  function defineMapped(name, norm, axis, isSize) {
    Object.defineProperty(MotionBlob.prototype, name, {
      get: function () {
        var d = this.tracker._displayRect();
        return axis === 'x'
          ? (isSize ? 0 : d.x) + this[norm] * d.w
          : (isSize ? 0 : d.y) + this[norm] * d.h;
      }
    });
  }
  defineMapped('x', 'nx', 'x', false);
  defineMapped('y', 'ny', 'y', false);
  defineMapped('w', 'nw', 'x', true);
  defineMapped('h', 'nh', 'y', true);
  defineMapped('cx', 'ncx', 'x', false);
  defineMapped('cy', 'ncy', 'y', false);

  Object.defineProperty(MotionBlob.prototype, 'velocity', {
    get: function () {
      var d = this.tracker._displayRect();
      return this.tracker.p.createVector(this._vx * d.w, this._vy * d.h);
    }
  });

  /*
    Convex hull of the blob's pixels, in canvas coordinates. Only valid in the
    frame the blob was detected (i.e. call it from draw()).
  */
  MotionBlob.prototype.hull = function () {
    var t = this.tracker;
    if (this._hullFrame === t.frame && this._hull) return this._hull;
    var pts = [];
    if (this._frame === t.frame && this._label >= 0) {
      var W = t.width, labels = t._labels, L = this._label;
      var x0 = Math.floor(this.nx * W), x1 = Math.ceil((this.nx + this.nw) * W);
      var y0 = Math.floor(this.ny * t.height), y1 = Math.ceil((this.ny + this.nh) * t.height);
      x1 = Math.min(x1, W - 1); y1 = Math.min(y1, t.height - 1);
      for (var y = y0; y <= y1; y++) {
        var row = y * W, lo = -1, hi = -1;
        for (var x = x0; x <= x1; x++) {
          if (labels[row + x] === L) { if (lo < 0) lo = x; hi = x; }
        }
        if (lo >= 0) { pts.push([lo, y]); if (hi !== lo) pts.push([hi + 1, y]); }
      }
    }
    var hull = convexHull(pts);
    var d = t._displayRect(), sx = d.w / t.width, sy = d.h / t.height, p = t.p;
    this._hull = hull.map(function (q) { return p.createVector(d.x + q[0] * sx, d.y + q[1] * sy); });
    this._hullFrame = t.frame;
    return this._hull;
  };

  function convexHull(points) {
    if (points.length < 3) return points.slice();
    points.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lower = [], upper = [], i;
    for (i = 0; i < points.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) lower.pop();
      lower.push(points[i]);
    }
    for (i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) upper.pop();
      upper.push(points[i]);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  /* ======================================================================== */
  /* Tracker                                                                  */
  /* ======================================================================== */

  function MotionTracker(p, source, options) {
    this.p = p;
    this.source = source;
    this.options = {};
    this.flowOptions = {};
    this.set(Object.assign({}, DEFAULTS, options || {}));

    this.ready = false;
    this.frame = 0;
    this.width = 0;
    this.height = 0;
    this.amount = 0;
    this.blobs = [];
    this.zones = [];

    this._tracks = [];
    this._blobEnter = [];
    this._blobExit = [];
    this._display = null;
    this._bgReady = false;
    this._maskImage = null;
    this._maskFrame = -1;

    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
  }

  MotionTracker.prototype.set = function (opts) {
    for (var k in opts) {
      if (k === 'flow') {
        if (opts.flow === false) this.flowOptions = Object.assign({}, FLOW_DEFAULTS, this.flowOptions, { enabled: false });
        else if (opts.flow === true) this.flowOptions = Object.assign({}, FLOW_DEFAULTS, this.flowOptions, { enabled: true });
        else this.flowOptions = Object.assign({}, FLOW_DEFAULTS, this.flowOptions, opts.flow, { enabled: true });
      }
      else this.options[k] = opts[k];
    }
    if (this.width) this._allocate(this.width, this.height, true);
    return this;
  };

  Object.defineProperty(MotionTracker.prototype, 'autoUpdate', {
    get: function () { return this.options.autoUpdate !== false; }
  });

  /* ---- source handling ---------------------------------------------------- */

  MotionTracker.prototype._sourceInfo = function () {
    var s = this.source;
    if (!s) return null;
    var el = s.elt || s.canvas || s;
    var w, h, flipped = s.flipped === true;
    if (typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement) {
      if (el.readyState < 2) return null;
      w = el.videoWidth; h = el.videoHeight;
    }
    else if (s.canvas && typeof s.width === 'number' && !s.elt) {
      el = s.canvas; w = s.width; h = s.height;          // p5.Image
    }
    else if (s.elt && typeof s.width === 'number') {
      w = s.width; h = s.height;                          // p5.Graphics / canvas wrapper
    }
    else {
      w = el.videoWidth || el.naturalWidth || el.width;
      h = el.videoHeight || el.naturalHeight || el.height;
    }
    if (!w || !h) return null;
    return { el: el, w: w, h: h, flipped: flipped };
  };

  MotionTracker.prototype._allocate = function (W, H, keepBackground) {
    var N = W * H;
    var sizeChanged = W !== this.width || H !== this.height;
    this.width = W; this.height = H;
    this._canvas.width = W; this._canvas.height = H;

    if (sizeChanged || !this._gray) {
      this._gray = new Float32Array(N);
      this._tmp = new Float32Array(N);
      this._prevGray = new Float32Array(N);
      this._bg = new Float32Array(N);
      this._mask = new Uint8Array(N);
      this._sat = new Uint32Array((W + 1) * (H + 1));
      this._labels = new Int32Array(N);
      this._parent = new Int32Array((N >> 1) + 2);
      this._bgReady = false;
      this._hasPrev = false;
      this._pyrCur = null;
    }
    else if (!keepBackground) this._bgReady = false;

    // flow buffers
    var fo = this.flowOptions;
    if (fo.enabled) {
      var levels = Math.max(1, fo.levels | 0), lw = W, lh = H, cur = [], prev = [];
      for (var l = 0; l < levels; l++) {
        if (l > 0) { lw = lw >> 1; lh = lh >> 1; }
        if (lw < 8 || lh < 8) break;
        cur.push(makeLevel(lw, lh)); prev.push(makeLevel(lw, lh));
      }
      if (!this._pyrCur || this._pyrCur.length !== cur.length || sizeChanged) {
        this._pyrCur = cur; this._pyrPrev = prev; this._hasPrev = false;
      }
      var step = Math.max(2, fo.step | 0);
      this._flowCols = Math.max(1, Math.floor(W / step));
      this._flowRows = Math.max(1, Math.floor(H / step));
      this._flowStep = step;
      this._flowOx = (W - (this._flowCols - 1) * step) / 2;
      this._flowOy = (H - (this._flowRows - 1) * step) / 2;
      var n = this._flowCols * this._flowRows;
      if (!this._flowVx || this._flowVx.length !== n) {
        this._flowVx = new Float32Array(n);
        this._flowVy = new Float32Array(n);
      }
    }
  };

  function makeLevel(w, h) {
    return { w: w, h: h, img: new Float32Array(w * h), ix: new Float32Array(w * h), iy: new Float32Array(w * h) };
  }

  /* ---- main update -------------------------------------------------------- */

  MotionTracker.prototype.update = function () {
    var info = this._sourceInfo();
    if (!info) { this.ready = false; return false; }

    var res = Math.max(16, this.options.resolution | 0);
    var W = Math.min(res, Math.round(info.w));
    var H = Math.max(1, Math.round(W * info.h / info.w));
    if (W !== this.width || H !== this.height) this._allocate(W, H, false);

    // 1. one draw + one readback per frame
    var ctx = this._ctx;
    var flip = this.options.flip === undefined ? info.flipped : !!this.options.flip;
    ctx.save();
    if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(info.el, 0, 0, W, H);
    ctx.restore();
    var data = ctx.getImageData(0, 0, W, H).data;

    // 2. grayscale (+ optional [1 2 1] blur)
    var N = W * H, gray = this._gray, i, j;
    for (i = 0, j = 0; i < N; i++, j += 4) {
      gray[i] = (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
    }
    if (this.options.denoise) blur121(gray, this._tmp, W, H);

    // 3. background model + mask
    var bg = this._bg, mask = this._mask, mode = this.options.background;
    var thr = clamp(this.options.threshold, 0, 1) * 255;
    var moving = 0;
    if (!this._bgReady) {
      bg.set(gray);
      this._bgReady = true;
      mask.fill(0);
    }
    else {
      var ref = mode === 'frame' ? this._prevGray : bg;
      var adapt = mode === 'adaptive' ? clamp(this.options.adapt, 0, 1) : 0;
      for (i = 0; i < N; i++) {
        var g = gray[i], b = ref[i], d = g - b;
        if (d < 0) d = -d;
        if (d > thr) { mask[i] = 1; moving++; } else mask[i] = 0;
        if (adapt) bg[i] = b + (g - b) * adapt;
      }
    }
    this.amount = moving / N;

    // 4. summed-area table of the mask (zones + flow gating in O(1))
    var sat = this._sat, W1 = W + 1, x, y;
    for (y = 0; y < H; y++) {
      var rowSum = 0, srow = (y + 1) * W1, prow = y * W1, mrow = y * W;
      for (x = 0; x < W; x++) {
        rowSum += mask[mrow + x];
        sat[srow + x + 1] = sat[prow + x + 1] + rowSum;
      }
    }

    this.frame++;

    // 5. blobs
    if (this.options.blobs) this._findBlobs();
    else if (this.blobs.length) { this.blobs = []; }

    // 6. optical flow
    if (this.flowOptions.enabled) this._updateFlow();

    // 7. zones
    this._updateZones();

    this._prevGray.set(gray);
    this.ready = true;
    return true;
  };

  function blur121(a, tmp, W, H) {
    var x, y, r, i;
    for (y = 0; y < H; y++) {
      r = y * W;
      tmp[r] = (a[r] * 3 + a[r + 1]) * 0.25;
      for (x = 1; x < W - 1; x++) { i = r + x; tmp[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) * 0.25; }
      i = r + W - 1; tmp[i] = (a[i - 1] + a[i] * 3) * 0.25;
    }
    for (x = 0; x < W; x++) a[x] = (tmp[x] * 3 + tmp[x + W]) * 0.25;
    for (y = 1; y < H - 1; y++) {
      r = y * W;
      for (x = 0; x < W; x++) { i = r + x; a[i] = (tmp[i - W] + 2 * tmp[i] + tmp[i + W]) * 0.25; }
    }
    r = (H - 1) * W;
    for (x = 0; x < W; x++) a[r + x] = (tmp[r + x - W] + tmp[r + x] * 3) * 0.25;
  }

  MotionTracker.prototype._count = function (x0, y0, x1, y1) {
    // number of motion pixels in [x0, x1) x [y0, y1) (processing coords)
    var W1 = this.width + 1, s = this._sat;
    return s[y1 * W1 + x1] - s[y0 * W1 + x1] - s[y1 * W1 + x0] + s[y0 * W1 + x0];
  };

  /* ---- blobs: union-find connected components + tracking ------------------ */

  MotionTracker.prototype._findBlobs = function () {
    var W = this.width, H = this.height, N = W * H;
    var mask = this._mask, labels = this._labels, parent = this._parent;
    var next = 1, x, y, i;

    function find(a) {
      while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
      return a;
    }
    function union(a, b) {
      a = find(a); b = find(b);
      if (a < b) parent[b] = a; else if (b < a) parent[a] = b;
      return a < b ? a : b;
    }

    // first pass (8-connectivity)
    for (y = 0; y < H; y++) {
      var row = y * W;
      for (x = 0; x < W; x++) {
        i = row + x;
        if (!mask[i]) { labels[i] = 0; continue; }
        var l = 0, n;
        if (x > 0 && (n = labels[i - 1])) l = n;
        if (y > 0) {
          var up = i - W;
          if ((n = labels[up])) l = l ? union(l, n) : n;
          if (x > 0 && (n = labels[up - 1])) l = l ? union(l, n) : n;
          if (x < W - 1 && (n = labels[up + 1])) l = l ? union(l, n) : n;
        }
        if (!l) {
          if (next >= parent.length) { labels[i] = 0; continue; }
          l = next; parent[next] = next; next++;
        }
        labels[i] = l;
      }
    }

    // resolve + accumulate stats
    var compact = new Int32Array(next).fill(-1), count = 0;
    var stats = [];
    for (i = 0; i < N; i++) {
      var lab = labels[i];
      if (!lab) { labels[i] = -1; continue; }
      var root = find(lab), c = compact[root];
      if (c < 0) {
        c = compact[root] = count++;
        stats.push({ area: 0, minx: W, miny: H, maxx: 0, maxy: 0, sx: 0, sy: 0, label: c });
      }
      labels[i] = c;
      var s = stats[c];
      x = i % W; y = (i - x) / W;
      s.area++; s.sx += x; s.sy += y;
      if (x < s.minx) s.minx = x; if (x > s.maxx) s.maxx = x;
      if (y < s.miny) s.miny = y; if (y > s.maxy) s.maxy = y;
    }

    var minPixels = Math.max(1, this.options.minArea * N);
    var detections = stats.filter(function (s) { return s.area >= minPixels; });
    detections.sort(function (a, b) { return b.area - a.area; });
    detections = detections.slice(0, Math.max(0, this.options.maxBlobs | 0));

    this._trackBlobs(detections);
  };

  MotionTracker.prototype._trackBlobs = function (dets) {
    var W = this.width, H = this.height, N = W * H, frame = this.frame;
    var maxD = this.options.trackDistance, i, j;
    var tracks = this._tracks;

    for (i = 0; i < dets.length; i++) {
      var s = dets[i];
      s.ncx = (s.sx / s.area + 0.5) / W;
      s.ncy = (s.sy / s.area + 0.5) / H;
    }

    // greedy nearest matching (aspect-corrected distance in frame-width units)
    var pairs = [], aspect = H / W;
    for (i = 0; i < tracks.length; i++) {
      for (j = 0; j < dets.length; j++) {
        var dx = tracks[i].ncx - dets[j].ncx, dy = (tracks[i].ncy - dets[j].ncy) * aspect;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= maxD) pairs.push([dist, i, j]);
      }
    }
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    var usedT = new Uint8Array(tracks.length), usedD = new Uint8Array(dets.length);
    var assign = new Int32Array(dets.length).fill(-1);
    for (i = 0; i < pairs.length; i++) {
      var ti = pairs[i][1], di = pairs[i][2];
      if (usedT[ti] || usedD[di]) continue;
      usedT[ti] = 1; usedD[di] = 1; assign[di] = ti;
    }

    var entered = [], exited = [], keep = [];
    for (j = 0; j < dets.length; j++) {
      var d = dets[j], b;
      if (assign[j] >= 0) {
        b = tracks[assign[j]];
        b._vx = d.ncx - b.ncx; b._vy = d.ncy - b.ncy;
        b.age++; b.isNew = false;
      }
      else {
        b = new MotionBlob(this);
        entered.push(b);
      }
      b._lost = 0;
      b._label = d.label;
      b._frame = frame;
      b.nx = d.minx / W; b.ny = d.miny / H;
      b.nw = (d.maxx - d.minx + 1) / W; b.nh = (d.maxy - d.miny + 1) / H;
      b.ncx = d.ncx; b.ncy = d.ncy;
      b.area = d.area / N;
      keep.push(b);
    }
    var visible = keep.slice();
    for (i = 0; i < tracks.length; i++) {
      if (usedT[i]) continue;
      var t = tracks[i];
      t._lost++;
      if (t._lost <= this.options.lostFrames) keep.push(t);
      else exited.push(t);
    }
    this._tracks = keep;
    this.blobs = visible;

    for (i = 0; i < entered.length; i++) fire(this._blobEnter, entered[i]);
    for (i = 0; i < exited.length; i++) fire(this._blobExit, exited[i]);
  };

  function fire(list, arg) {
    for (var k = 0; k < list.length; k++) list[k](arg);
  }

  MotionTracker.prototype.onBlobEnter = function (fn) { this._blobEnter.push(fn); return this; };
  MotionTracker.prototype.onBlobExit = function (fn) { this._blobExit.push(fn); return this; };

  /* ---- optical flow: pyramidal Lucas-Kanade on a grid --------------------- */

  MotionTracker.prototype._updateFlow = function () {
    var fo = this.flowOptions, pyr = this._pyrCur, L = pyr.length, l;

    // build current pyramid + gradients
    pyr[0].img.set(this._gray);
    for (l = 1; l < L; l++) downsample(pyr[l - 1], pyr[l]);
    for (l = 0; l < L; l++) gradients(pyr[l]);

    var cols = this._flowCols, rows = this._flowRows, step = this._flowStep;
    var vxArr = this._flowVx, vyArr = this._flowVy;

    if (!this._hasPrev) {
      vxArr.fill(0); vyArr.fill(0);
    }
    else {
      var prev = this._pyrPrev, cur = this._pyrCur;
      var r = Math.max(1, fo.window | 0), iters = Math.max(1, fo.iterations | 0);
      var minEig = fo.minTexture * fo.minTexture * (2 * r + 1) * (2 * r + 1);
      var sm = clamp(fo.smoothing, 0, 0.99);
      var half = step >> 1, W = this.width, H = this.height;
      var out = [0, 0];
      for (var gy = 0; gy < rows; gy++) {
        var py = this._flowOy + gy * step;
        for (var gx = 0; gx < cols; gx++) {
          var px = this._flowOx + gx * step, k = gy * cols + gx;
          var nvx = 0, nvy = 0;
          var gate = true;
          if (fo.maskOnly) {
            var x0 = clamp(Math.round(px - half), 0, W), x1 = clamp(Math.round(px + half), 0, W);
            var y0 = clamp(Math.round(py - half), 0, H), y1 = clamp(Math.round(py + half), 0, H);
            gate = this._count(x0, y0, x1, y1) > 0;
          }
          if (gate && lucasKanade(prev, cur, px, py, r, iters, minEig, out)) {
            nvx = out[0]; nvy = out[1];
          }
          vxArr[k] = vxArr[k] * sm + nvx * (1 - sm);
          vyArr[k] = vyArr[k] * sm + nvy * (1 - sm);
        }
      }
    }

    // swap pyramids
    var t = this._pyrPrev; this._pyrPrev = this._pyrCur; this._pyrCur = t;
    this._hasPrev = true;
  };

  function downsample(src, dst) {
    var sw = src.w, s = src.img, d = dst.img, w = dst.w, h = dst.h;
    for (var y = 0; y < h; y++) {
      var r0 = (y * 2) * sw, r1 = r0 + sw, o = y * w;
      for (var x = 0; x < w; x++) {
        var c = x * 2;
        d[o + x] = (s[r0 + c] + s[r0 + c + 1] + s[r1 + c] + s[r1 + c + 1]) * 0.25;
      }
    }
  }

  function gradients(level) {
    var w = level.w, h = level.h, a = level.img, ix = level.ix, iy = level.iy;
    for (var y = 0; y < h; y++) {
      var r = y * w, ym = y > 0 ? r - w : r, yp = y < h - 1 ? r + w : r;
      for (var x = 0; x < w; x++) {
        var xm = x > 0 ? x - 1 : x, xp = x < w - 1 ? x + 1 : x;
        ix[r + x] = (a[r + xp] - a[r + xm]) * 0.5;
        iy[r + x] = (a[yp + x] - a[ym + x]) * 0.5;
      }
    }
  }

  function sample(img, w, h, x, y) {
    if (x < 0) x = 0; else if (x > w - 1.001) x = w - 1.001;
    if (y < 0) y = 0; else if (y > h - 1.001) y = h - 1.001;
    var xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, i = yi * w + xi;
    var a = img[i], b = img[i + 1], c = img[i + w], d = img[i + w + 1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function lucasKanade(prev, cur, px, py, r, iters, minEig, out) {
    var gx = 0, gy = 0, ok = false;
    for (var l = prev.length - 1; l >= 0; l--) {
      var P = prev[l], C = cur[l], w = P.w, h = P.h, s = 1 << l;
      var cx = Math.round(px / s), cy = Math.round(py / s);
      if (cx < r + 1) cx = r + 1; if (cx > w - r - 2) cx = w - r - 2;
      if (cy < r + 1) cy = r + 1; if (cy > h - r - 2) cy = h - r - 2;
      if (cx <= r || cy <= r) { if (l > 0) { gx *= 2; gy *= 2; } continue; }

      var gxx = 0, gxy = 0, gyy = 0, qx, qy, i;
      for (qy = cy - r; qy <= cy + r; qy++) {
        for (qx = cx - r; qx <= cx + r; qx++) {
          i = qy * w + qx;
          var ax = P.ix[i], ay = P.iy[i];
          gxx += ax * ax; gxy += ax * ay; gyy += ay * ay;
        }
      }
      var det = gxx * gyy - gxy * gxy;
      var tr = gxx + gyy, disc = Math.sqrt(Math.max(0, tr * tr * 0.25 - det));
      var eig = tr * 0.5 - disc;
      var vx = 0, vy = 0;
      if (eig > minEig / ((1 << l) * (1 << l)) && det > 1e-6) {
        for (var k = 0; k < iters; k++) {
          var bx = 0, by = 0;
          for (qy = cy - r; qy <= cy + r; qy++) {
            for (qx = cx - r; qx <= cx + r; qx++) {
              i = qy * w + qx;
              var dI = P.img[i] - sample(C.img, w, h, qx + gx + vx, qy + gy + vy);
              bx += dI * P.ix[i]; by += dI * P.iy[i];
            }
          }
          var dx = (gyy * bx - gxy * by) / det, dy = (gxx * by - gxy * bx) / det;
          vx += dx; vy += dy;
          if (dx * dx + dy * dy < 0.0025) break;
        }
        if (l === 0) ok = true;
      }
      if (l > 0) { gx = 2 * (gx + vx); gy = 2 * (gy + vy); }
      else { gx += vx; gy += vy; }
    }
    if (!ok || gx !== gx || gy !== gy) return false;
    out[0] = gx; out[1] = gy;
    return true;
  }

  // flow vector at processing coords, bilinear on the grid (processing px/frame)
  MotionTracker.prototype._flowSample = function (px, py, out) {
    var cols = this._flowCols, rows = this._flowRows, step = this._flowStep;
    var fx = clamp((px - this._flowOx) / step, 0, cols - 1);
    var fy = clamp((py - this._flowOy) / step, 0, rows - 1);
    var x0 = fx | 0, y0 = fy | 0, x1 = Math.min(x0 + 1, cols - 1), y1 = Math.min(y0 + 1, rows - 1);
    var tx = fx - x0, ty = fy - y0, vx = this._flowVx, vy = this._flowVy;
    var a = y0 * cols + x0, b = y0 * cols + x1, c = y1 * cols + x0, d = y1 * cols + x1;
    out[0] = (vx[a] * (1 - tx) + vx[b] * tx) * (1 - ty) + (vx[c] * (1 - tx) + vx[d] * tx) * ty;
    out[1] = (vy[a] * (1 - tx) + vy[b] * tx) * (1 - ty) + (vy[c] * (1 - tx) + vy[d] * tx) * ty;
  };

  MotionTracker.prototype.flowAt = function (x, y) {
    if (!this.ready || !this.flowOptions.enabled) return this.p.createVector(0, 0);
    var d = this._displayRect(), out = [0, 0];
    var px = (x - d.x) / d.w * this.width, py = (y - d.y) / d.h * this.height;
    this._flowSample(px, py, out);
    return this.p.createVector(out[0] * d.w / this.width, out[1] * d.h / this.height);
  };

  MotionTracker.prototype.forEachFlow = function (fn) {
    if (!this.ready || !this.flowOptions.enabled) return this;
    var d = this._displayRect(), sx = d.w / this.width, sy = d.h / this.height;
    var cols = this._flowCols, rows = this._flowRows, step = this._flowStep;
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var k = gy * cols + gx;
        fn(d.x + (this._flowOx + gx * step) * sx, d.y + (this._flowOy + gy * step) * sy,
           this._flowVx[k] * sx, this._flowVy[k] * sy);
      }
    }
    return this;
  };

  MotionTracker.prototype._averageFlowIn = function (x0, y0, x1, y1, out) {
    // average of grid vectors faster than minSpeed inside a processing rect
    var cols = this._flowCols, rows = this._flowRows, step = this._flowStep;
    var d = this._displayRect(), sx = d.w / this.width, sy = d.h / this.height;
    var min2 = this.flowOptions.minSpeed * this.flowOptions.minSpeed;
    var sumx = 0, sumy = 0, n = 0;
    for (var gy = 0; gy < rows; gy++) {
      var py = this._flowOy + gy * step;
      if (py < y0 || py >= y1) continue;
      for (var gx = 0; gx < cols; gx++) {
        var px = this._flowOx + gx * step;
        if (px < x0 || px >= x1) continue;
        var k = gy * cols + gx, vx = this._flowVx[k] * sx, vy = this._flowVy[k] * sy;
        if (vx * vx + vy * vy < min2) continue;
        sumx += vx; sumy += vy; n++;
      }
    }
    out[0] = n ? sumx / n : 0; out[1] = n ? sumy / n : 0;
  };

  MotionTracker.prototype.averageFlow = function () {
    if (!this.ready || !this.flowOptions.enabled) return this.p.createVector(0, 0);
    var out = [0, 0];
    this._averageFlowIn(0, 0, this.width, this.height, out);
    return this.p.createVector(out[0], out[1]);
  };

  /* ---- zones -------------------------------------------------------------- */

  MotionTracker.prototype.zone = function (id, x, y, w, h) {
    this.removeZone(id);
    var z = new MotionZone(this, id, x, y, w, h);
    this.zones.push(z);
    return z;
  };

  MotionTracker.prototype.getZone = function (id) {
    for (var i = 0; i < this.zones.length; i++) if (this.zones[i].id === id) return this.zones[i];
    return null;
  };

  MotionTracker.prototype.removeZone = function (id) {
    for (var i = this.zones.length - 1; i >= 0; i--) if (this.zones[i].id === id) this.zones.splice(i, 1);
    return this;
  };

  MotionTracker.prototype._updateZones = function () {
    var d = this._displayRect(), W = this.width, H = this.height, out = [0, 0];
    var flow = this.flowOptions.enabled;
    for (var i = 0; i < this.zones.length; i++) {
      var z = this.zones[i];
      var x0 = clamp(Math.floor((z.x - d.x) / d.w * W), 0, W);
      var x1 = clamp(Math.ceil((z.x + z.w - d.x) / d.w * W), 0, W);
      var y0 = clamp(Math.floor((z.y - d.y) / d.h * H), 0, H);
      var y1 = clamp(Math.ceil((z.y + z.h - d.y) / d.h * H), 0, H);
      var area = (x1 - x0) * (y1 - y0);
      z.amount = area > 0 ? this._count(x0, y0, x1, y1) / area : 0;
      if (flow) { this._averageFlowIn(x0, y0, x1, y1, out); z._vx = out[0]; z._vy = out[1]; }
      var was = z.active;
      z.active = z.amount >= z.threshold;
      if (z.active !== was) {
        fire(z.active ? z._enter : z._exit, z);
        fire(z._change, z);
      }
    }
  };

  /* ---- background / mapping ---------------------------------------------- */

  MotionTracker.prototype.captureBackground = function () { this._bgReady = false; return this; };

  MotionTracker.prototype.mapTo = function (x, y, w, h) {
    this._display = (x === undefined) ? null : { x: x, y: y, w: w, h: h };
    return this;
  };

  MotionTracker.prototype._displayRect = function () {
    return this._display || { x: 0, y: 0, w: this.p.width, h: this.p.height };
  };

  /* ---- mask image + debug drawing ----------------------------------------- */

  Object.defineProperty(MotionTracker.prototype, 'mask', {
    get: function () {
      if (!this.width) return null;
      var img = this._maskImage;
      if (!img || img.width !== this.width || img.height !== this.height) {
        img = this._maskImage = this.p.createImage(this.width, this.height);
        this._maskFrame = -1;
      }
      if (this._maskFrame !== this.frame) {
        img.loadPixels();
        var px = img.pixels, m = this._mask, N = this.width * this.height;
        for (var i = 0, j = 0; i < N; i++, j += 4) {
          var v = m[i] ? 255 : 0;
          px[j] = v; px[j + 1] = v; px[j + 2] = v; px[j + 3] = 255;
        }
        img.updatePixels();
        this._maskFrame = this.frame;
      }
      return img;
    }
  });

  MotionTracker.prototype.debug = function (opts) {
    if (!this.ready) return this;
    var o = Object.assign({ mask: true, zones: true, blobs: true, flow: true }, opts || {});
    var p = this.p, d = this._displayRect(), self = this;
    p.push();
    if (o.mask) {
      p.push();
      p.blendMode(p.SCREEN);
      p.tint(255, 0, 180, 140);
      p.image(this.mask, d.x, d.y, d.w, d.h);
      p.pop();
    }
    if (o.flow && this.flowOptions.enabled) {
      var min2 = this.flowOptions.minSpeed * this.flowOptions.minSpeed;
      p.stroke(255, 255, 0); p.strokeWeight(1.5);
      this.forEachFlow(function (x, y, vx, vy) {
        if (vx * vx + vy * vy < min2) return;
        p.line(x, y, x + vx * 3, y + vy * 3);
      });
    }
    if (o.blobs) {
      p.textSize(11); p.textAlign(p.LEFT, p.BOTTOM);
      for (var i = 0; i < this.blobs.length; i++) {
        var b = this.blobs[i];
        p.noFill(); p.stroke(0, 255, 160); p.strokeWeight(1.5);
        p.rect(b.x, b.y, b.w, b.h);
        p.noStroke(); p.fill(0, 255, 160);
        p.circle(b.cx, b.cy, 6);
        p.text('#' + b.id, b.x + 2, b.y - 2);
      }
    }
    if (o.zones) {
      p.textSize(11); p.textAlign(p.LEFT, p.TOP);
      this.zones.forEach(function (z) {
        p.strokeWeight(2);
        p.stroke(z.active ? p.color(255, 60, 60) : p.color(255, 255, 255, 160));
        p.fill(z.active ? p.color(255, 60, 60, 50) : p.color(0, 0));
        p.rect(z.x, z.y, z.w, z.h);
        p.noStroke(); p.fill(255);
        p.text(z.id + '  ' + z.amount.toFixed(3), z.x + 4, z.y + 4);
        p.fill(z.active ? p.color(255, 60, 60) : p.color(255, 255, 255, 160));
        p.rect(z.x, z.y + z.h - 4, z.w * Math.min(1, z.amount / Math.max(z.threshold, 1e-6) * 0.5), 4);
      });
    }
    p.pop();
    return this;
  };

  MotionTracker.prototype.remove = function () {
    var list = this.p._motionTrackers;
    if (list) { var i = list.indexOf(this); if (i >= 0) list.splice(i, 1); }
  };

  /* ======================================================================== */
  /* p5 registration                                                          */
  /* ======================================================================== */

  function motionAddon(p5, fn, lifecycles) {
    fn.createMotion = function (source, options) {
      var t = new MotionTracker(this, source, options);
      if (!this._motionTrackers) this._motionTrackers = [];
      this._motionTrackers.push(t);
      return t;
    };
    var pre = function () {
      var list = this._motionTrackers;
      if (!list) return;
      for (var i = 0; i < list.length; i++) if (list[i].autoUpdate) list[i].update();
    };
    if (lifecycles) {
      lifecycles.predraw = pre;
      lifecycles.remove = function () { this._motionTrackers = []; };
    }
    else if (typeof fn.registerMethod === 'function') {
      fn.registerMethod('pre', pre);    // p5 1.x
    }
    p5.MotionTracker = MotionTracker;
    p5.MotionZone = MotionZone;
    p5.MotionBlob = MotionBlob;
  }

  if (typeof p5 !== 'undefined') {
    if (typeof p5.registerAddon === 'function') p5.registerAddon(motionAddon);
    else motionAddon(p5, p5.prototype, null);
  }
  else {
    console.warn('[p5.motion] p5 was not found. Load p5.js before p5.motion.js.');
  }
})();
