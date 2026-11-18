// Four "pads" you trigger by waving into them.
let cam, motion;
let pads = {};

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam);

  for (let i = 0; i < 4; i++) {
    let id = 'pad ' + (i + 1);
    pads[id] = { count: 0, flash: 0 };
    motion.zone(id, 20 + i * 155, 20, 135, 100)
      .onEnter(z => {
        pads[z.id].count++;
        pads[z.id].flash = 255;
      });
  }
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let z of motion.zones) {
    let pad = pads[z.id];
    stroke(255);
    strokeWeight(2);
    fill(255, 60, 120, pad.flash);
    rect(z.x, z.y, z.w, z.h);
    noStroke();
    fill(255);
    textSize(16);
    text(z.id + ': ' + pad.count, z.x + 8, z.y + 24);
    pad.flash *= 0.9;
  }
}
