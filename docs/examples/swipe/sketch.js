// averageFlow() averages every moving flow vector into one p5.Vector.
let cam, motion;
let smooth;
let label = '', labelTime = -1000, cooldownUntil = 0;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
