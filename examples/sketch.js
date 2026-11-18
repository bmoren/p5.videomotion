// p5.motion starter: webcam, adaptive background, 2 zones, blobs, flow

let cam, motion;

function setup() {
  createCanvas(640, 480);

  cam = createCapture(VIDEO, { flipped: true }); // mirrored like a mirror
  cam.hide();

  motion = createMotion(cam); // updates itself before every draw()

  // zones are in canvas pixels: id, x, y, w, h
  motion.zone('left', 40, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));

  motion.zone('right', 440, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));
}

function draw() {
  image(cam, 0, 0, width, height);
  motion.debug(); // shows mask, zones, blobs and flow while you set things up

  // --- things you can use in your own drawing ---

  // a zone, every frame
  let left = motion.getZone('left');
  if (left.active) {
    // left.amount is 0..1, left.flow is a p5.Vector (which way it moved)
  }

  // blobs, already in canvas pixels
  for (let b of motion.blobs) {
    // b.x, b.y, b.w, b.h, b.cx, b.cy, b.id, b.velocity, b.hull()
  }

  // motion direction anywhere on the canvas
  let v = motion.flowAt(mouseX, mouseY);
  stroke(255); strokeWeight(3);
  line(mouseX, mouseY, mouseX + v.x * 5, mouseY + v.y * 5);
}
