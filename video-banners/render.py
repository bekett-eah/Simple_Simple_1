"""Renderiza un banner de 1600x600 cuadro por cuadro (sin audio, como el video de Platzi del carrusel).
Uso:
  python3 render.py stills <url> <carpeta> t1 t2 ...
  python3 render.py video  <url> <salida-sin-extensión> <ffmpeg>
     → <salida>.mp4 (H.264 High 3.2, el codec que declara la landing: avc1.640020),
       <salida>.webm (VP8), <salida>-liviano.mp4 y <salida>-poster.jpg
  (&ss=2 captura al doble de resolución y reduce con lanczos)
"""
import os, subprocess, sys, time
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

mode, url = sys.argv[1], sys.argv[2]
ss = int(parse_qs(urlparse(url).query).get("ss", ["1"])[0])
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 600}, device_scale_factor=ss)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(url)
    pg.wait_for_function("window.__ready === true", timeout=90000)
    w, h = pg.evaluate("window.__size")
    if errors:
        print("ERRORES JS:", *errors, sep="\n  ")
    if mode == "stills":
        out = sys.argv[3]
        os.makedirs(out, exist_ok=True)
        for t in sys.argv[4:]:
            pg.evaluate(f"window.__seek({float(t)})")
            pg.screenshot(path=os.path.join(out, f"t{float(t):05.2f}.png"))
        print("ok", len(sys.argv[4:]), "cuadros")
    else:
        base, ff = sys.argv[3], sys.argv[4]
        fps, dur = pg.evaluate("window.__fps"), pg.evaluate("window.__duration")
        n = int(round(dur * fps))
        color = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
        master = base + ".mp4"
        proc = subprocess.Popen([ff, "-y", "-loglevel", "error",
            "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
            "-vf", f"scale={w}:{h}:flags=lanczos+accurate_rnd+full_chroma_int"
                   ":in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p",
            "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-maxrate", "6M", "-bufsize", "12M",
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "3.2", "-r", str(fps), *color,
            "-an", "-movflags", "+faststart", master], stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(n):
            pg.evaluate(f"window.__seek({i / fps})")
            proc.stdin.write(pg.screenshot(type="jpeg", quality=97))
            if i % (fps * 2) == 0:
                el = time.time() - t0
                print(f"cuadro {i}/{n}  {el:.0f}s  eta {el / max(i, 1) * (n - i):.0f}s", flush=True)
        proc.stdin.close()
        proc.wait()
        print("mp4:", master, "código", proc.returncode, flush=True)
        # versiones para la landing: WebM (VP8) y MP4 liviano para conexiones lentas
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", master, "-c:v", "libvpx", "-b:v", "3300k", "-maxrate", "4M",
                        "-bufsize", "8M", "-quality", "good", "-cpu-used", "1", "-auto-alt-ref", "1", "-lag-in-frames", "16",
                        "-an", base + ".webm"], check=True)
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", master, "-c:v", "libx264", "-preset", "slow", "-b:v", "1700k",
                        "-maxrate", "2M", "-bufsize", "4M", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "3.2", *color,
                        "-an", "-movflags", "+faststart", base + "-liviano.mp4"], check=True)
        # póster: un cuadro con el titular completo
        pg.evaluate("window.__seek(6.1)")
        pg.screenshot(path=base + "-poster.png")
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", base + "-poster.png", "-vf", f"scale={w}:{h}:flags=lanczos",
                        "-q:v", "3", base + "-poster.jpg"], check=True)
        os.remove(base + "-poster.png")
        print("listo:", base, flush=True)
    b.close()
