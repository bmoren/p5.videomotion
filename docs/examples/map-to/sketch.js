// The camera is drawn into a 320x240 frame in the middle of the canvas.
let cam, motion;
const FRAME = { x: 160, y: 120, w: 320, h: 240 };

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
