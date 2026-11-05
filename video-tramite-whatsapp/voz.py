"""Genera la locución con la voz Paulina de macOS.
Uso: python3 voz.py <ffmpeg>
Crea voz/<id>.wav (48 kHz, mono, limpia y nivelada) y voz/voz.js con la duración de cada frase,
que main.js usa para acomodar las escenas.
"""
import json, os, subprocess, sys

ff = sys.argv[1]
base = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(base, "voz")
os.makedirs(out, exist_ok=True)
lineas = json.load(open(os.path.join(base, "narracion.json"), encoding="utf-8"))
duraciones = {}
for l in lineas:
    aiff = os.path.join(out, l["id"] + ".aiff")
    wav = os.path.join(out, l["id"] + ".wav")
    subprocess.run(["say", "-v", "Paulina", "-r", "168", "-o", aiff, l["texto"]], check=True)
    # Limpieza: quita graves y siseo, comprime suave y nivela para que se entienda sobre la música
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", aiff, "-af",
        "highpass=f=90,lowpass=f=9500,equalizer=f=3000:t=q:w=1.2:g=2.5,"
        "acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,"
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,"
        "loudnorm=I=-16:TP=-1.5:LRA=7",
        "-ar", "48000", "-ac", "1", wav], check=True)
    os.remove(aiff)
    d = float(subprocess.run([ff, "-i", wav, "-f", "null", "-"], capture_output=True, text=True)
              .stderr.split("time=")[-1].split()[0].split(":")[-1])
    duraciones[l["id"]] = round(d, 2)
    print(f"{l['id']:7s} {d:5.2f}s")
with open(os.path.join(out, "voz.js"), "w", encoding="utf-8") as f:
    f.write("window.VOZ = " + json.dumps(duraciones) + ";\n")
print("total", round(sum(duraciones.values()), 2), "s")
