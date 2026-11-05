"""Corta la locución completa (voz/locucion_completa.wav) en una frase por escena.
Uso: python3 cortar_voz.py <ffmpeg>
Crea voz/<id>.wav (48 kHz, mono, nivelada) y voz/voz.js con la duración de cada frase,
que main.js usa para acomodar las escenas. Los cortes caen en las pausas entre párrafos."""
import json, os, subprocess, sys

ff = sys.argv[1]
base = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(base, "voz", "locucion_completa.wav")
# inicio y fin (segundos) de cada frase dentro de la locución completa
CORTES = [("intro", 0.25, 10.22), ("p1", 10.29, 16.60), ("p2", 16.80, 33.64), ("p3", 33.82, 45.37),
          ("p4", 45.62, 58.57), ("p5", 58.76, 65.48), ("p6", 65.82, 79.11), ("p7", 79.48, 92.76),
          ("cierre", 93.15, 100.45)]
duraciones = {}
for id_, a, b in CORTES:
    wav = os.path.join(base, "voz", id_ + ".wav")
    d = b - a
    # se recorta con atrim (decodificando de corrido) y no con -ss: la cabecera del WAV generado declara
    # el doble de bytes por segundo y el salto de ffmpeg caería en otro punto de la locución
    subprocess.run([ff, "-y", "-loglevel", "error", "-i", src, "-af",
        f"atrim=start={a}:end={b},asetpts=PTS-STARTPTS,"
        f"highpass=f=70,afade=t=in:d=0.03,afade=t=out:st={d - 0.06:.3f}:d=0.06,"
        "loudnorm=I=-16:TP=-1.5:LRA=7", "-ar", "48000", "-ac", "1", wav], check=True)
    duraciones[id_] = round(d, 2)
    print(f"{id_:7s} {d:5.2f}s")
with open(os.path.join(base, "voz", "voz.js"), "w", encoding="utf-8") as f:
    f.write("window.VOZ = " + json.dumps(duraciones) + ";\n")
print("total", round(sum(duraciones.values()), 2), "s")
