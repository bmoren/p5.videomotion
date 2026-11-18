// Moves the elements a sketch adds to <body> (canvas, sliders, ...) into #sketch.
(function () {
  var existing = new Set(Array.from(document.body.children));
  function adopt(node) {
    if (node.nodeType !== 1 || existing.has(node) || node.tagName === 'SCRIPT') return;
    var host = document.getElementById('sketch');
    if (host && node !== host && !host.contains(node)) host.appendChild(node);
  }
  new MutationObserver(function (records) {
    records.forEach(function (r) { r.addedNodes.forEach(adopt); });
  }).observe(document.body, { childList: true });
})();
