// With autoUpdate: false, you decide when (and how often) to update.
let cam, motion, slider;
let cost = 0;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
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
