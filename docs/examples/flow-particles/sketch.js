// Particles take a push from the flow under them each frame.
let cam, motion;
let particles = [];

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
