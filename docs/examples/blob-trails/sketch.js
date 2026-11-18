// Blob ids stay the same while a blob is tracked, so they can key a Map.
let cam, motion;
let trails = new Map();
let messages = [];

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam, { minArea: 0.01, maxBlobs: 6 });

  motion.onBlobEnter(b => {
    trails.set(b.id, []);
    say('blob #' + b.id + ' entered');
  });
  motion.onBlobExit(b => {
    trails.delete(b.id);
    say('blob #' + b.id + ' left after ' + b.age + ' frames');
  });
}

function draw() {
  image(cam, 0, 0, width, height);

  for (let b of motion.blobs) {
    let t = trails.get(b.id);
    if (!t) continue;
    t.push(createVector(b.cx, b.cy));
    if (t.length > 60) t.shift();

    noFill();
    stroke(0, 255, 160);
    strokeWeight(3);
    beginShape();
    for (let p of t) vertex(p.x, p.y);
    endShape();
  }

  noStroke();
  fill(255);
  textSize(13);
  messages.forEach((m, i) => text(m, 10, 20 + i * 18));
}

function say(m) {
  messages.unshift(m);
  messages.length = min(messages.length, 8);
}
