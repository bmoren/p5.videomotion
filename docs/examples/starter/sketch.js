// Starter: webcam + adaptive background + 2 zones
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam);

  motion.zone('left', 40, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));

  motion.zone('right', 440, 140, 160, 200)
    .onEnter(z => console.log(z.id, 'ON'))
    .onExit(z => console.log(z.id, 'OFF'));
}

function draw() {
  image(cam, 0, 0, width, height);
  motion.debug();
}
