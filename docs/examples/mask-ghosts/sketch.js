// motion.mask is a p5.Image: white where there is motion, black elsewhere.
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
