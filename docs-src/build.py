#!/usr/bin/env python3
"""Builds the p5.videomotion docs folder.

  python3 build.py <out_dir>

Hand-written article bodies live next to this file (*.body.html). Example
sketches live in examples_src.py. Tables of contents are generated from the
h2/h3 headings of each page.
"""
import html, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from examples_src import EXAMPLES  # noqa: E402

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "docs"))
LIB = os.path.join(HERE, "..", "p5.videomotion.js")
P5_CDN = "https://cdn.jsdelivr.net/npm/p5@2/lib/p5.min.js"
VERSION = "0.1.0"

ACTIVE_ATTR = ' class="active"'

NAV = [
    ("index.html", "Main page"),
    ("reference.html", "Reference"),
    ("examples.html", "Examples"),
    ("index.html#tuning", "Tuning guide"),
    ("index.html#troubleshooting", "Troubleshooting"),
    ("index.html#migrating-from-p5-vida", "Migrating from p5.vida"),
]


def slugify(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def add_ids_and_toc(body):
    """Give h2/h3 ids (unless set) and build a numbered TOC."""
    toc, n2, n3, seen = [], 0, 0, set()

    def repl(m):
        nonlocal n2, n3
        level, attrs, inner = m.group(1), m.group(2) or "", m.group(3)
        idm = re.search(r'id="([^"]+)"', attrs)
        hid = idm.group(1) if idm else slugify(inner)
        base, k = hid, 2
        while hid in seen:
            hid = f"{base}-{k}"; k += 1
        seen.add(hid)
        if level == "2":
            n2 += 1; n3 = 0; num = f"{n2}"
        else:
            n3 += 1; num = f"{n2}.{n3}"
        label = re.sub(r"<[^>]+>", "", inner)
        toc.append((level, num, hid, label))
        if not idm:
            attrs = f' id="{hid}"' + attrs
        return f"<h{level}{attrs}>{inner}</h{level}>"

    body = re.sub(r"<h([23])((?:\s[^>]*)?)>(.*?)</h\1>", repl, body, flags=re.S)
    return body, toc


def toc_html(toc):
    if len(toc) < 3:
        return ""
    out = ['<div class="toc" role="navigation"><div class="toctitle">Contents</div><ul>']
    open3 = False
    for level, num, hid, label in toc:
        if level == "2":
            if open3:
                out.append("</ul></li>"); open3 = False
            else:
                if out[-1].endswith("</a>"):
                    out.append("</li>")
            out.append(f'<li><a href="#{hid}"><span class="tocnumber">{num}</span> {label}</a>')
        else:
            if not open3:
                out.append("<ul>"); open3 = True
            out.append(f'<li><a href="#{hid}"><span class="tocnumber">{num}</span> {label}</a></li>')
    out.append("</ul></li>" if open3 else "</li>")
    out.append("</ul></div>")
    return "".join(out)


def page(title, body, root, active=None, head_extra="", lead_toc=True, subtitle="From the p5.videomotion documentation"):
    body, toc = add_ids_and_toc(body)
    toc_block = toc_html(toc) if lead_toc else ""
    # TOC goes before the first h2, after the lead section (like Wikipedia)
    if toc_block and "<h2" in body:
        i = body.index("<h2")
        body = body[:i] + toc_block + "\n" + body[i:]
    nav = "\n".join(
        f'<li{ACTIVE_ATTR if href == active else ""}><a href="{root}{href}">{label}</a></li>'
        for href, label in NAV)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} — p5.videomotion</title>
<link rel="stylesheet" href="{root}style.css">
{head_extra}
</head>
<body>
<div id="side">
  <a id="logo" href="{root}index.html"><span class="logo-mark">p5</span><span class="logo-word">.motion</span></a>
  <div class="portal"><h3>Navigation</h3><ul>
{nav}
  </ul></div>
  <div class="portal"><h3>Version</h3><ul><li>{VERSION}</li><li>p5.js 2.x (1.x compatible)</li></ul></div>
</div>
<div id="content">
<h1 id="firstHeading">{title}</h1>
<div class="siteSub">{subtitle}</div>
{body}
<div id="footer">p5.videomotion {VERSION} · MIT License · Inspired by p5.vida by Paweł Janicki.</div>
</div>
</body>
</html>
"""


EXAMPLE_HELPER = """// Moves the elements a sketch adds to <body> (canvas, sliders, ...) into #sketch.
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
"""


def build():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "lib"))
    os.makedirs(os.path.join(OUT, "examples"))

    shutil.copy(os.path.join(HERE, "style.css"), os.path.join(OUT, "style.css"))
    # static assets kept in docs-src/ (docs/ is wiped on every build)
    shutil.copy(os.path.join(HERE, "p5.videomotion-banner.png"), os.path.join(OUT, "p5.videomotion-banner.png"))
    shutil.copy(LIB, os.path.join(OUT, "lib", "p5.videomotion.js"))
    with open(os.path.join(OUT, "examples", "example-page.js"), "w") as f:
        f.write(EXAMPLE_HELPER)

    # article pages
    for name, title, subtitle in [
        ("index", "p5.videomotion", "From the p5.videomotion documentation, a camera motion tracking library for p5.js"),
        ("reference", "p5.videomotion reference", "From the p5.videomotion documentation"),
    ]:
        with open(os.path.join(HERE, name + ".body.html")) as f:
            body = f.read()
        body = body.replace("{{EXAMPLE_COUNT}}", str(len(EXAMPLES)))
        with open(os.path.join(OUT, name + ".html"), "w") as f:
            f.write(page(title, body, "", active=name + ".html", subtitle=subtitle))

    # example pages
    cats = []
    for e in EXAMPLES:
        if e["category"] not in cats:
            cats.append(e["category"])
    for i, e in enumerate(EXAMPLES):
        d = os.path.join(OUT, "examples", e["slug"])
        os.makedirs(d)
        with open(os.path.join(d, "sketch.js"), "w") as f:
            f.write(e["code"])
        prev_e = EXAMPLES[i - 1] if i > 0 else None
        next_e = EXAMPLES[i + 1] if i + 1 < len(EXAMPLES) else None
        pager = '<p class="pager">'
        if prev_e:
            pager += f'← <a href="../{prev_e["slug"]}/index.html">{html.escape(prev_e["title"])}</a>'
        pager += ' · <a href="../../examples.html">All examples</a> · '
        if next_e:
            pager += f'<a href="../{next_e["slug"]}/index.html">{html.escape(next_e["title"])}</a> →'
        pager += "</p>"
        names = ("mapTo|zone|getZone|removeZone|onEnter|onExit|onChange|setThreshold|onBlobEnter|onBlobExit|"
                 "hull|velocity|flowAt|averageFlow|forEachFlow|captureBackground|debug|update|set|mask|amount|"
                 "blobs|zones|flow|ready")
        used = {}
        if "createMotion" in e["code"]:
            used["createMotion()"] = "ref-createmotion"
        for obj, name in re.findall(r"\b(\w+)\.(" + names + r")\b", e["code"]):
            if name == "amount":
                label, anchor = (("motion.amount", "ref-amount") if obj == "motion"
                                 else ("zone.amount", "ref-zone-amount"))
            elif name == "flow":
                label, anchor = "zone.flow", "ref-flow"
            elif name in ("update", "set") and obj != "motion":
                continue
            else:
                label, anchor = name, "ref-" + name.lower()
            used[label] = anchor
        used_links = ", ".join(f'<a href="../../reference.html#{a}"><code>{l}</code></a>'
                               for l, a in sorted(used.items(), key=lambda kv: kv[0].lower()))
        body = f"""<div class="hatnote">Part of the <a href="../../examples.html">p5.videomotion examples</a> · Category: {html.escape(e["category"])}</div>
<p>{html.escape(e["summary"])}</p>
<div id="sketch-frame"><div id="sketch"></div>
<div class="sketch-caption">Live sketch. Allow camera access when the browser asks. If nothing appears, see <a href="../../index.html#troubleshooting">Troubleshooting</a>.</div></div>
<h2>Source code</h2>
<p>Save as <code>sketch.js</code> next to an <code>index.html</code> that loads p5.js and <code>p5.videomotion.js</code> (see <a href="../../index.html#installation">Installation</a>).</p>
<pre class="source">{html.escape(e["code"])}</pre>
<h2>Used in this example</h2>
<p>{used_links}</p>
{pager}"""
        head = (f'<script src="{P5_CDN}"></script>\n'
                f'<script src="../../lib/p5.videomotion.js"></script>\n'
                f'<script src="../example-page.js" defer></script>\n'
                f'<script src="sketch.js" defer></script>')
        with open(os.path.join(d, "index.html"), "w") as f:
            f.write(page(e["title"], body, "../../", head_extra=head, lead_toc=False,
                         subtitle="p5.videomotion example"))

    # examples index
    parts = [f"""<p>These {len(EXAMPLES)} sketches each show one part of p5.videomotion. Every page runs the sketch live
and lists its full source. All of them use the webcam except <a href="examples/no-camera/index.html">Without a camera</a>.</p>
<p>The examples load p5.js from a CDN, and browsers only give pages camera access over <code>https://</code> or
<code>http://localhost</code>. Serve this folder with a local web server (see <a href="index.html#installation">Installation</a>)
rather than opening the files directly.</p>"""]
    for c in cats:
        parts.append(f"<h2>{html.escape(c)}</h2>")
        parts.append('<table class="wikitable examples"><tr><th>Example</th><th>Description</th></tr>')
        for e in EXAMPLES:
            if e["category"] == c:
                parts.append(f'<tr><td><a href="examples/{e["slug"]}/index.html">{html.escape(e["title"])}</a></td>'
                             f'<td>{html.escape(e["summary"])}</td></tr>')
        parts.append("</table>")
    with open(os.path.join(OUT, "examples.html"), "w") as f:
        f.write(page("Examples", "\n".join(parts), "", active="examples.html"))

    print("built", OUT, "with", len(EXAMPLES), "examples")


if __name__ == "__main__":
    build()
