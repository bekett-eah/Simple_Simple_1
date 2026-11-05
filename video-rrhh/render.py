"""Renderiza el video cuadro por cuadro, en paralelo por tramos, con la narración original.
Uso:
  python3 render.py stills <url> <carpeta> t1 t2 ...
  python3 render.py video  <url> <salida.mp4> <ffmpeg> <audio> [workers]
  (agrega &ss=2 a la url para capturar al doble de resolución y reducir con lanczos)
Cada tramo abre su propio Chromium, recorre la línea de tiempo desde 0 hasta su inicio (para que los
tweens guarden los mismos valores de partida que en un recorrido completo) y codifica su parte en H.264;
al final se unen los tramos sin recodificar y se agrega el audio original sin tocarlo.
"""
import os, subprocess, sys, time
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright


def open_page(p, url):
    ss = int(parse_qs(urlparse(url).query).get("ss", ["1"])[0])
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=ss)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errors.append(m.text))
    pg.goto(url)
    pg.wait_for_function("window.__ready === true", timeout=120000)
    if errors:
        print("ERRORES JS:", *errors, sep="\n  ", flush=True)
    return b, pg


def x264(ff, out, fps, w, h, src):
    return [ff, "-y", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", src,
        "-vf", f"scale={w}:{h}:flags=lanczos+accurate_rnd+full_chroma_int"
               ":in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p",
        "-profile:v", "high", "-level", "4.2", "-r", str(fps), "-g", str(fps * 2),
        "-x264-params", "aq-mode=3:aq-strength=0.9:deblock=-1,-1",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        out]


mode, url = sys.argv[1], sys.argv[2]
if mode == "stills":
    out = sys.argv[3]
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p, url)
        last = 0.0
        for t in sorted(float(x) for x in sys.argv[4:]):
            # avanza desde el cuadro anterior, como en el render real
            s = last
            while s < t:
                pg.evaluate(f"window.__seek({s})")
                s += 0.25
            pg.evaluate(f"window.__seek({t})")
            last = t
            pg.screenshot(path=os.path.join(out, f"t{t:06.2f}.png"))
        print("ok", len(sys.argv[4:]), "cuadros", flush=True)
        b.close()

elif mode == "seg":
    # un tramo: cuadros [i0, i1)
    out, ff, i0, i1 = sys.argv[3], sys.argv[4], int(sys.argv[5]), int(sys.argv[6])
    with sync_playwright() as p:
        b, pg = open_page(p, url)
        fps = pg.evaluate("window.__fps")
        w, h = pg.evaluate("window.__size")
        pg.evaluate("""(t1) => { for (let t = 0; t < t1; t += 0.05) window.__seek(t); }""", i0 / fps)
        proc = subprocess.Popen(x264(ff, out, fps, w, h, "-"), stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(i0, i1):
            pg.evaluate(f"window.__seek({i / fps})")
            proc.stdin.write(pg.screenshot(type="jpeg", quality=97))
            if (i - i0) % (fps * 10) == 0:
                el = time.time() - t0
                print(f"[{os.path.basename(out)}] {i - i0}/{i1 - i0}  {el:.0f}s  eta {el / max(i - i0, 1) * (i1 - i):.0f}s", flush=True)
        proc.stdin.close()
        proc.wait()
        print(f"[{os.path.basename(out)}] listo, código {proc.returncode}", flush=True)
        b.close()

else:
    out, ff, audio = sys.argv[3], sys.argv[4], sys.argv[5]
    workers = int(sys.argv[6]) if len(sys.argv) > 6 else 6
    with sync_playwright() as p:
        b, pg = open_page(p, url)
        fps, dur = pg.evaluate("window.__fps"), pg.evaluate("window.__duration")
        b.close()
    n = int(round(dur * fps))
    tmp = os.path.splitext(out)[0] + "_tramos"
    os.makedirs(tmp, exist_ok=True)
    cuts = [round(n * k / workers) for k in range(workers + 1)]
    segs = [os.path.join(tmp, f"seg{k:02d}.mp4") for k in range(workers)]
    t0 = time.time()
    procs = [subprocess.Popen([sys.executable, __file__, "seg", url, segs[k], ff, str(cuts[k]), str(cuts[k + 1])]) for k in range(workers)]
    codes = [pr.wait() for pr in procs]
    print(f"tramos listos en {time.time() - t0:.0f}s, códigos {codes}", flush=True)
    if any(codes):
        sys.exit(1)
    lst = os.path.join(tmp, "lista.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{s}'\n" for s in segs)
    r = subprocess.run([ff, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-i", audio,
        "-map", "0:v", "-map", "1:a", "-c", "copy", "-t", f"{dur}", "-movflags", "+faststart", out])
    print("listo:", out, "código", r.returncode, flush=True)
