# Source of every example: (slug, title, category, summary, code)

EXAMPLES = []

def ex(slug, title, category, summary, code):
    EXAMPLES.append(dict(slug=slug, title=title, category=category, summary=summary, code=code.strip() + "\n"))

CAM = """  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();"""

# ---------------------------------------------------------------- basics
ex("starter", "Starter", "Basics",
   "The smallest useful sketch: webcam, adaptive background, two zones and the debug overlay.",
"""
// Starter: webcam + adaptive background + 2 zones
let cam, motion;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam);

  motion.zone('left', 40, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));

  motion.zone('right', 440, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));
}

function draw() {
  image(cam, 0, 0, width, height);
  motion.debug();
}
""")

ex("no-camera", "Without a camera", "Basics",
   "Uses a p5.Graphics with moving shapes as the source. Useful for testing and for sketches where the input is generated or loaded rather than filmed.",
"""
// Any p5.Graphics, p5.Image or video can be the source.
let src, motion;

function setup() {
  createCanvas(640, 480);
  src = createGraphics(320, 240);
  motion = createMotion(src, { background: 'frame' });
  motion.zone('middle', 220, 140, 200, 200);
}

function draw() {
  // draw the "camera" image: two balls moving on black
  src.background(0);
  src.noStroke();
  src.fill(255);
  src.circle(160 + sin(frameCount * 0.03) * 120, 80, 40);
  src.fill(180);
  src.circle(160, 160 + cos(frameCount * 0.05) * 60, 30);

  // motion was updated from the previous frame's drawing
  image(src, 0, 0, width, height);
  motion.debug();
}
""")

ex("instance-mode", "Instance mode", "Basics",
   "The same starter written in p5 instance mode. createMotion is available on the instance as p.createMotion.",
"""
// Instance mode: everything hangs off the p5 instance "p".
new p5(p => {
  let cam, motion;

  p.setup = () => {
    p.createCanvas(640, 480);
    cam = p.createCapture(p.VIDEO, { flipped: true });
    cam.hide();
    motion = p.createMotion(cam);
    motion.zone('left', 40, 140, 160, 200);
    motion.zone('right', 440, 140, 160, 200);
  };

  p.draw = () => {
    p.image(cam, 0, 0, p.width, p.height);
    motion.debug();
  };
});
""")

ex("map-to", "Camera in part of the canvas", "Basics",
   "Draws the camera into a smaller frame and uses mapTo() so zones and blobs stay in canvas pixels that line up with it.",
"""
// The camera is drawn into a 320x240 frame in the middle of the canvas.
let cam, motion;
const FRAME = { x: 160, y: 120, w: 320, h: 240 };

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam).mapTo(FRAME.x, FRAME.y, FRAME.w, FRAME.h);

  // zone coordinates are still canvas pixels, inside the frame
  motion.zone('frame-left', FRAME.x + 10, FRAME.y + 60, 80, 120);
  motion.zone('frame-right', FRAME.x + FRAME.w - 90, FRAME.y + 60, 80, 120);
}

function draw() {
  background(40);
  image(cam, FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  noFill();
  stroke(255);
  rect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  motion.debug();
}
""")

# ---------------------------------------------------------------- zones
ex("zone-pads", "Zone pads", "Zones",
   "Four zones along the top of the screen act like buttons. Each one flashes and counts when motion enters it.",
"""
// Four "pads" you trigger by waving into them.
let cam, motion;
let pads = {};

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam);

  for (let i = 0; i < 4; i++) {
    let id = 'pad ' + (i + 1);
    pads[id] = { count: 0, flash: 0 };
    motion.zone(id, 20 + i * 155, 20, 135, 100)
      .onEnter(z => {
        pads[z.id].count++;
        pads[z.id].flash = 255;
      });
  }
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let z of motion.zones) {
    let pad = pads[z.id];
    stroke(255);
    strokeWeight(2);
    fill(255, 60, 120, pad.flash);
    rect(z.x, z.y, z.w, z.h);
    noStroke();
    fill(255);
    textSize(16);
    text(z.id + ': ' + pad.count, z.x + 8, z.y + 24);
    pad.flash *= 0.9;
  }
}
""")

ex("zone-meter", "Zone meter and threshold", "Zones",
   "Shows a zone's amount as a live meter next to its threshold. Press UP and DOWN to change the threshold and see when the zone switches.",
"""
// zone.amount is the fraction of the zone that is moving (0..1).
// zone.active is true when amount >= zone.threshold.
let cam, motion, zone;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam);
  zone = motion.zone('zone', 220, 120, 200, 240).setThreshold(0.05);
}

function draw() {
  image(cam, 0, 0, width, height);

  noFill();
  strokeWeight(3);
  stroke(zone.active ? color(255, 60, 60) : 255);
  rect(zone.x, zone.y, zone.w, zone.h);

  // meter: 0..0.5 mapped to the bar height
  let barH = 300;
  let level = constrain(zone.amount / 0.5, 0, 1) * barH;
  let thr = constrain(zone.threshold / 0.5, 0, 1) * barH;
  noStroke();
  fill(0, 150);
  rect(560, 90, 40, barH);
  fill(zone.active ? color(255, 60, 60) : color(0, 200, 255));
  rect(560, 90 + barH - level, 40, level);
  stroke(255, 255, 0);
  strokeWeight(2);
  line(550, 90 + barH - thr, 610, 90 + barH - thr);

  noStroke();
  fill(255);
  textSize(14);
  text('amount    ' + zone.amount.toFixed(3), 20, 30);
  text('threshold ' + zone.threshold.toFixed(3) + '  (UP / DOWN)', 20, 50);
}

function keyPressed() {
  if (keyCode === UP_ARROW) zone.setThreshold(min(zone.threshold + 0.01, 0.5));
  if (keyCode === DOWN_ARROW) zone.setThreshold(max(zone.threshold - 0.01, 0.01));
}
""")

ex("zone-flow", "Direction inside zones", "Zones",
   "A grid of zones, each drawing an arrow for the average direction of movement inside it (zone.flow).",
"""
// zone.flow is the average optical flow inside the zone (a p5.Vector).
let cam, motion;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam);
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      motion.zone(gx + ',' + gy, gx * 160, gy * 160, 160, 160);
    }
  }
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let z of motion.zones) {
    let cx = z.x + z.w / 2;
    let cy = z.y + z.h / 2;
    noFill();
    stroke(255, 80);
    rect(z.x, z.y, z.w, z.h);

    let f = z.flow.mult(8);              // exaggerate for drawing
    if (f.mag() > 2) {
      stroke(255, 220, 0);
      strokeWeight(4);
      line(cx, cy, cx + f.x, cy + f.y);
      circle(cx + f.x, cy + f.y, 6);
      strokeWeight(1);
    }
  }
}
""")

# ---------------------------------------------------------------- blobs
ex("blobs", "Drawing blobs", "Blobs",
   "Draws each blob's convex hull, centre of mass, id and velocity yourself instead of using debug().",
"""
// motion.blobs is an array of tracked blobs, in canvas pixels.
let cam, motion;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { minArea: 0.005 });
  colorMode(HSB);
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let b of motion.blobs) {
    let c = color((b.id * 47) % 360, 80, 100);

    // outline
    fill(hue(c), 80, 100, 0.3);
    stroke(c);
    strokeWeight(2);
    beginShape();
    for (let v of b.hull()) vertex(v.x, v.y);
    endShape(CLOSE);

    // centre and velocity
    let v = b.velocity.mult(5);
    line(b.cx, b.cy, b.cx + v.x, b.cy + v.y);
    noStroke();
    fill(c);
    circle(b.cx, b.cy, 10);
    textSize(14);
    text('#' + b.id + '  age ' + b.age, b.x, b.y - 6);
  }
}
""")

ex("blob-trails", "Blob trails and events", "Blobs",
   "Keeps a trail for each blob by its id, using onBlobEnter and onBlobExit to create and clean up the trails.",
"""
// Blob ids stay the same while a blob is tracked, so they can key a Map.
let cam, motion;
let trails = new Map();
let messages = [];

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { minArea: 0.01, maxBlobs: 6 });

  motion.onBlobEnter(b => {
    trails.set(b.id, []);
    say('blob #' + b.id + ' entered');
  });
  motion.onBlobExit(b => {
    trails.delete(b.id);
    say('blob #' + b.id + ' left after ' + b.age + ' frames');
  });
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let b of motion.blobs) {
    let t = trails.get(b.id);
    if (!t) continue;
    t.push(createVector(b.cx, b.cy));
    if (t.length > 60) t.shift();

    noFill();
    stroke(0, 255, 160);
    strokeWeight(3);
    beginShape();
    for (let p of t) vertex(p.x, p.y);
    endShape();
  }

  noStroke();
  fill(255);
  textSize(13);
  messages.forEach((m, i) => text(m, 10, 20 + i * 18));
}

function say(m) {
  messages.unshift(m);
  messages.length = min(messages.length, 8);
}
""")

# ---------------------------------------------------------------- flow
ex("flow-field", "Flow field", "Optical flow",
   "Draws every vector of the optical flow grid with forEachFlow(), coloured by direction.",
"""
// forEachFlow gives every grid point: x, y and the motion vx, vy (canvas px/frame).
let cam, motion;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { blobs: false, flow: { step: 8 } });
  colorMode(HSB);
}

function draw() {
  tint(0, 0, 100, 0.5);
  image(cam, 0, 0, width, height);
  noTint();

  strokeWeight(2);
  motion.forEachFlow((x, y, vx, vy) => {
    let speed = sqrt(vx * vx + vy * vy);
    if (speed < 0.5) return;
    let hueAngle = (degrees(atan2(vy, vx)) + 360) % 360;
    stroke(hueAngle, 90, 100);
    line(x, y, x + vx * 4, y + vy * 4);
  });
}
""")

ex("flow-particles", "Flow particles", "Optical flow",
   "1,500 particles pushed around by motion.flowAt(). Wave your hands to sweep them.",
"""
// Particles take a push from the flow under them each frame.
let cam, motion;
let particles = [];

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { blobs: false, flow: { step: 8, smoothing: 0.6 } });
  for (let i = 0; i < 1500; i++) {
    particles.push({ pos: createVector(random(width), random(height)), vel: createVector(0, 0) });
  }
}

function draw() {
  tint(255, 60);
  image(cam, 0, 0, width, height);
  noTint();

  stroke(255);
  strokeWeight(2);
  for (let p of particles) {
    p.vel.add(motion.flowAt(p.pos.x, p.pos.y).mult(0.25));
    p.vel.mult(0.92);
    p.pos.add(p.vel);
    p.pos.x = (p.pos.x + width) % width;
    p.pos.y = (p.pos.y + height) % height;
    point(p.pos.x, p.pos.y);
  }
}
""")

ex("swipe", "Swipe gestures", "Optical flow",
   "Detects left, right, up and down swipes from averageFlow(), with a short cooldown so one gesture fires once.",
"""
// averageFlow() averages every moving flow vector into one p5.Vector.
let cam, motion;
let smooth;
let label = '', labelTime = -1000, cooldownUntil = 0;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { blobs: false });
  smooth = createVector(0, 0);
}

function draw() {
  image(cam, 0, 0, width, height);

  smooth.lerp(motion.averageFlow(), 0.3);

  if (millis() > cooldownUntil && smooth.mag() > 6) {
    if (abs(smooth.x) > abs(smooth.y)) label = smooth.x > 0 ? 'RIGHT' : 'LEFT';
    else label = smooth.y > 0 ? 'DOWN' : 'UP';
    labelTime = millis();
    cooldownUntil = millis() + 600;
  }

  // arrow for the current average
  stroke(255, 220, 0);
  strokeWeight(4);
  line(width / 2, height / 2, width / 2 + smooth.x * 10, height / 2 + smooth.y * 10);

  if (millis() - labelTime < 800) {
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(64);
    text(label, width / 2, 80);
  }
}
""")

# ---------------------------------------------------------------- background / mask
ex("background-modes", "Background modes", "Background and mask",
   "Camera on the left, motion mask on the right. Switch modes with 1 (adaptive), 2 (static) and 3 (frame), relearn with SPACE, and change the threshold with + and -.",
"""
// Compare the three background models side by side.
let cam, motion;
let mode = 'adaptive';

function setup() {
  createCanvas(640, 300);
""" + CAM + """
  motion = createMotion(cam, { flow: false }).mapTo(0, 0, 320, 240);
}

function draw() {
  background(30);
  image(cam, 0, 0, 320, 240);
  if (motion.ready) image(motion.mask, 320, 0, 320, 240);

  fill(255);
  noStroke();
  textSize(13);
  text('mode: ' + mode + '    threshold: ' + motion.options.threshold.toFixed(2) +
       '    moving: ' + (motion.amount * 100).toFixed(1) + '%', 10, 262);
  text('1 adaptive   2 static   3 frame   SPACE relearn   + / - threshold', 10, 284);
}

function keyPressed() {
  if (key === '1') mode = 'adaptive';
  if (key === '2') mode = 'static';
  if (key === '3') mode = 'frame';
  if ('123'.includes(key)) motion.set({ background: mode }).captureBackground();
  if (key === ' ') motion.captureBackground();
  if (key === '+' || key === '=') motion.set({ threshold: min(motion.options.threshold + 0.02, 1) });
  if (key === '-') motion.set({ threshold: max(motion.options.threshold - 0.02, 0.02) });
}
""")

ex("mask-ghosts", "Mask ghosts", "Background and mask",
   "Uses motion.mask as an image: moving areas are added onto a slowly fading canvas, leaving ghost trails.",
"""
// motion.mask is a p5.Image: white where there is motion, black elsewhere.
let cam, motion;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { background: 'frame', threshold: 0.08, blobs: false, flow: false });
  background(0);
}

function draw() {
  background(0, 18);                    // fade what was drawn before
  if (!motion.ready) return;

  blendMode(ADD);
  tint(60 + 60 * sin(frameCount * 0.02), 120, 255, 120);
  image(motion.mask, 0, 0, width, height);
  noTint();
  blendMode(BLEND);
}
""")

# ---------------------------------------------------------------- performance
ex("resolution", "Resolution and manual updates", "Performance",
   "Turns off autoUpdate, times each motion.update() call and lets you change the processing resolution with a slider.",
"""
// With autoUpdate: false, you decide when (and how often) to update.
let cam, motion, slider;
let cost = 0;

function setup() {
  createCanvas(640, 480);
""" + CAM + """
  motion = createMotion(cam, { autoUpdate: false });
  slider = createSlider(80, 640, 320, 40);
  slider.position(10, 10);
}

function draw() {
  if (motion.options.resolution !== slider.value()) {
    motion.set({ resolution: slider.value() });
  }

  let t = performance.now();
  motion.update();
  cost = lerp(cost, performance.now() - t, 0.1);

  image(cam, 0, 0, width, height);
  motion.debug();

  noStroke();
  fill(0, 160);
  rect(0, 40, 300, 50);
  fill(255);
  textSize(14);
  text('processing ' + motion.width + ' x ' + motion.height, 10, 60);
  text('update: ' + cost.toFixed(2) + ' ms   fps: ' + frameRate().toFixed(0), 10, 80);
}
""")
