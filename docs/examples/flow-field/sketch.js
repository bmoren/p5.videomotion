// forEachFlow gives every grid point: x, y and the motion vx, vy (canvas px/frame).
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
