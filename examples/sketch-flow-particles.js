// p5.videomotion example: particles pushed around by optical flow
// Wave your hands; the particles get swept in the direction you move.

let cam, motion;
let particles = [];

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();

  motion = createMotion(cam, {
    blobs: false,                    // not needed here, skip the work
    flow: { step: 8, smoothing: 0.6 }
  });

  for (let i = 0; i < 1500; i++) {
    particles.push({ pos: createVector(random(width), random(height)), vel: createVector(0, 0) });
  }
}

function draw() {
  tint(255, 60);
  image(cam, 0, 0, width, height); // faint camera image
  noTint();

  stroke(255);
  strokeWeight(2);
  for (let p of particles) {
    let f = motion.flowAt(p.pos.x, p.pos.y);
    p.vel.add(f.mult(0.25));
    p.vel.mult(0.92);                // friction
    p.pos.add(p.vel);

    // wrap around the edges
    if (p.pos.x < 0) p.pos.x += width;
    if (p.pos.x > width) p.pos.x -= width;
    if (p.pos.y < 0) p.pos.y += height;
    if (p.pos.y > height) p.pos.y -= height;

    point(p.pos.x, p.pos.y);
  }
}
