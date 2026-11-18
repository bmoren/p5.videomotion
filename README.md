# p5.videomotion

![p5.videomotion](docs/p5.videomotion-banner.png)

## Webcam & motion tracking for p5.js 2.x.

| Folder | What it is |
|---|---|
| `p5.motion/` | **p5.motion**: a new library with motion mask, tracked blobs, active zones and Lucas–Kanade optical flow, in p5-style syntax. 3–5× faster than p5.vida. |
| `p5.motion/docs/` | Full HTML documentation: main article, API reference, 15 runnable examples. |


**Try it:** serve a folder with `python3 -m http.server 8000` (or `npx serve`) and open `http://localhost:8000`.
Browsers block the camera on pages opened directly from disk.

- Docs: serve `p5.motion/docs/` and open `index.html`.
- Quickest sketch: serve the `p5.motion/` folder and open `examples/index.html`.

```js
let cam, motion;

function setup() {
  createCanvas(640, 480);
  cam = createCapture(VIDEO, { flipped: true });
  cam.hide();
  motion = createMotion(cam);
  motion.zone('left', 40, 140, 160, 200).onEnter(z => console.log('hi'));
}

function draw() {
  image(cam, 0, 0, width, height);
  motion.debug();
}
```


