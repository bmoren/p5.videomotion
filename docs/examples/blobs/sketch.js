// motion.blobs is an array of tracked blobs, in canvas pixels.
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam, { minArea: 0.005 });
  colorMode(HSB);
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let b of motion.blobs) {
    let c = color((b.id * 47) % 360, 80, 100);

    // outline
    fill(hue(c), 80, 100, 0.3);
    stroke(c);
    strokeWeight(2);
    beginShape();
    for (let v of b.hull()) vertex(v.x, v.y);
    endShape(CLOSE);

    // centre and velocity
    let v = b.velocity.mult(5);
    line(b.cx, b.cy, b.cx + v.x, b.cy + v.y);
    noStroke();
    fill(c);
    circle(b.cx, b.cy, 10);
    textSize(14);
    text('#' + b.id + '  age ' + b.age, b.x, b.y - 6);
  }
}
