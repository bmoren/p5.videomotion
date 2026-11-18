// zone.flow is the average optical flow inside the zone (a p5.Vector).
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam);
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      motion.zone(gx + ',' + gy, gx * 160, gy * 160, 160, 160);
    }
  }
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let z of motion.zones) {
    let cx = z.x + z.w / 2;
    let cy = z.y + z.h / 2;
    noFill();
    stroke(255, 80);
    rect(z.x, z.y, z.w, z.h);

    let f = z.flow.mult(8);              // exaggerate for drawing
    if (f.mag() > 2) {
      stroke(255, 220, 0);
      strokeWeight(4);
      line(cx, cy, cx + f.x, cy + f.y);
      circle(cx + f.x, cy + f.y, 6);
      strokeWeight(1);
    }
  }
}
