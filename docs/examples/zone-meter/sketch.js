// zone.amount is the fraction of the zone that is moving (0..1).
// zone.active is true when amount >= zone.threshold.
let cam, motion, zone;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam);
  zone = motion.zone('zone', 220, 120, 200, 240).setThreshold(0.05);
}

function draw() {
  image(cam, 0, 0, width, height);

  noFill();
  strokeWeight(3);
  stroke(zone.active ? color(255, 60, 60) : 255);
  rect(zone.x, zone.y, zone.w, zone.h);

  // meter: 0..0.5 mapped to the bar height
  let barH = 300;
  let level = constrain(zone.amount / 0.5, 0, 1) * barH;
  let thr = constrain(zone.threshold / 0.5, 0, 1) * barH;
  noStroke();
  fill(0, 150);
  rect(560, 90, 40, barH);
  fill(zone.active ? color(255, 60, 60) : color(0, 200, 255));
  rect(560, 90 + barH - level, 40, level);
  stroke(255, 255, 0);
  strokeWeight(2);
  line(550, 90 + barH - thr, 610, 90 + barH - thr);

  noStroke();
  fill(255);
  textSize(14);
  text('amount    ' + zone.amount.toFixed(3), 20, 30);
  text('threshold ' + zone.threshold.toFixed(3) + '  (UP / DOWN)', 20, 50);
}

function keyPressed() {
  if (keyCode === UP_ARROW) zone.setThreshold(min(zone.threshold + 0.01, 0.5));
  if (keyCode === DOWN_ARROW) zone.setThreshold(max(zone.threshold - 0.01, 0.01));
}
