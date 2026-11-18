// Compare the three background models side by side.
let cam, motion;
let mode = 'adaptive';

function setup() {
  createCanvas(640, 300);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
