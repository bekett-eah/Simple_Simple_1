"""Renderiza el video cuadro por cuadro (música, efectos y locución salen de audio.js).
Uso:
  python3 render.py video  <url> <salida.mp4> <ffmpeg> [audio.wav]
  (agrega ?format=h a la url para la versión 16:9, &fps=60 para 60 cuadros
   y &ss=2 para capturar al doble de resolución y reducir con lanczos)
  python3 render.py stills <url> <carpeta> t1 t2 ...
"""
import base64, os, subprocess, sys, time
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

mode, url = sys.argv[1], sys.argv[2]
ss = int(parse_qs(urlparse(url).query).get("ss", ["1"])[0])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1920 if "format=h" in url else 1080, "height": 1080 if "format=h" in url else 1920}, device_scale_factor=ss)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(url)
    pg.wait_for_function("window.__ready === true", timeout=90000)
    w, h = pg.evaluate("window.__size")
    pg.set_viewport_size({"width": w, "height": h})
    if errors:
        print("ERRORES JS:", *errors, sep="\n  ")
    if mode == "stills":
        out = sys.argv[3]
        os.makedirs(out, exist_ok=True)
        for t in sys.argv[4:]:
            pg.evaluate(f"window.__seek({float(t)})")
            pg.screenshot(path=os.path.join(out, f"t{float(t):06.2f}.png"))
        print("ok", len(sys.argv[4:]), "cuadros")
    else:
        out, ff = sys.argv[3], sys.argv[4]
        fps, dur = pg.evaluate("window.__fps"), pg.evaluate("window.__duration")
        wav = sys.argv[5] if len(sys.argv) > 5 else os.path.splitext(out)[0] + ".wav"
        t0 = time.time()
        with open(wav, "wb") as f:
            f.write(base64.b64decode(pg.evaluate("window.SimpleAudio.renderWavBase64()")))
        print(f"audio listo ({time.time()-t0:.1f}s)", flush=True)
        n = int(round(dur * fps))
        proc = subprocess.Popen([ff, "-y", "-loglevel", "error",
            "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
            "-i", wav,
            "-vf", f"scale={w}:{h}:flags=lanczos+accurate_rnd+full_chroma_int"
                   ":in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-level", "4.2", "-r", str(fps),
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
            "-af", "loudnorm=I=-15:TP=-1.5:LRA=11",
            "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest", "-movflags", "+faststart", out],
            stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(n):
            pg.evaluate(f"window.__seek({i / fps})")
            proc.stdin.write(pg.screenshot(type="jpeg", quality=98))
            if i % (fps * 3) == 0:
                el = time.time() - t0
                print(f"cuadro {i}/{n}  {el:.0f}s  eta {el / max(i, 1) * (n - i):.0f}s", flush=True)
        proc.stdin.close()
        proc.wait()
        print("listo:", out, "código", proc.returncode)
    b.close()
