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
