# Comandos para exponer la carpeta SIMPLE_SV

`servidor.py` funciona igual que `python3 -m http.server`, pero acepta peticiones por partes (Range). Safari, en Mac y en iPhone, las necesita para reproducir el video de la landing.

## Iniciar (red local)

```bash
cd /Users/usuario/Documents/SIMPLE_SV
python3 servidor.py 8080 0.0.0.0
```

## Iniciar en segundo plano

```bash
cd /Users/usuario/Documents/SIMPLE_SV
nohup python3 servidor.py 8080 0.0.0.0 > server.log 2>&1 &
```

## Ver tu IP local

```bash
ipconfig getifaddr en0
```

Luego abre `http://10.20.182.181:8080/index.html` desde el celular o desde otro equipo de la misma WiFi.

## Verificar que está corriendo

```bash
lsof -iTCP:8080 -sTCP:LISTEN -P -n
```

## Detenerlo

```bash
kill $(lsof -tiTCP:8080 -sTCP:LISTEN)
```

En primer plano basta con `Ctrl + C`.

## Solo localhost (sin exponerlo a la red)

```bash
cd /Users/usuario/Documents/SIMPLE_SV
python3 servidor.py 8080 127.0.0.1
```

## Exponer solo nuevoDiseño

```bash
cd "/Users/usuario/Documents/SIMPLE_SV/nuevoDiseño"
python3 ../servidor.py 8080 0.0.0.0
```

## Notas

- Si el puerto 8080 está ocupado, cambia el número, por ejemplo `8081`.
- Si el celular no conecta, revisa el firewall de macOS en Ajustes del Sistema → Red → Firewall.
- Con la carpeta completa como raíz también se ven `bd`, `archivos`, `scrapper` y `.playwright-mcp`.
- Abrir la página con doble clic (`file://`) también funciona, pero en ese modo el video no se puede adelantar.

## Asistente con IA

`servidor.py` también atiende `POST /api/asistente` (`asistente_ia.py`): la IA que entiende lo que escribe el ciudadano. Sin el paquete `anthropic` o sin clave, el asistente sigue funcionando en **modo básico** (frases cortas, una cosa a la vez; el navegador verá un 503 en `/api/asistente`, es lo esperado).

El paquete `anthropic` pide Python 3.10 o superior (el `python3` de macOS es el 3.9). Guarda la clave una sola vez en `~/.zshrc`, nunca dentro del proyecto:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc   # una sola vez, con tu clave
source ~/.zshrc
python3.13 -m pip install -r requirements.txt
python3.13 servidor.py 8080 0.0.0.0
```

Opcionales: `SIMPLE_MODELO` (por defecto `claude-opus-5-5`), `SIMPLE_ESFUERZO` y `SIMPLE_IA=0` para apagarla. La bitácora (solo metadatos) queda en `registros/asistente.jsonl`, que el servidor no publica.

La IA solo responde si abres el sitio desde el servidor (`http://localhost:8080/...`); con doble clic (`file://`) queda en modo básico.

Si cambian el catálogo o los formularios, regenera lo que lee la IA: `node bd/generar_base_conocimiento.mjs`.

Pruebas:

```bash
node --test pruebas/*.test.mjs                 # motor de trámites e intérprete (gratis)
python3 -m unittest discover -s pruebas        # servidor e IA con un cliente simulado (gratis)
node pruebas/evaluar_local.mjs                 # comprensión en modo básico (gratis)
```

Documentación del asistente: `archivos/asistente-ia-tramites.md`. Métricas: `nuevoDiseño/metricas.html`.
