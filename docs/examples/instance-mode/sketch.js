// Instance mode: everything hangs off the p5 instance "p".
new p5(p => {
  let cam, motion;

  p.setup = () => {
    p.createCanvas(640, 480);
    cam = p.createCapture(p.VIDEO, { flipped: true });
    cam.hide();
    motion = p.createMotion(cam);
    motion.zone('left', 40, 140, 160, 200);
    motion.zone('right', 440, 140, 160, 200);
  };

  p.draw = () => {
    p.image(cam, 0, 0, p.width, p.height);
    motion.debug();
  };
});
