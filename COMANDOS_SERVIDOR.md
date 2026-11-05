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
