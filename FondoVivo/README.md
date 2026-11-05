# Fondo Vivo

App nativa para macOS (14 o superior) que pone **videos como fondo de pantalla animado** y te deja administrarlos desde una biblioteca.

## Qué hace

- **Biblioteca de videos**: arrastra videos (MP4, MOV, M4V) o carpetas completas a la ventana, o usa «Añadir videos». Al pasar el ratón por una tarjeta ves una vista previa en movimiento; haz clic para ponerla de fondo. Con clic derecho puedes renombrar, mostrarla en Finder, guardar un fotograma como imagen (para la pantalla de bloqueo) o eliminarla.
- **Varias pantallas**: un fondo general para todas o uno distinto para cada monitor (sección «Pantallas»).
- **Barra de menús**: icono de montañas con pausa, siguiente fondo, silencio y lista rápida de tus fondos con miniaturas.
- **Ajustes**: rellenar / ajustar / estirar, velocidad (0,5× a 2×), audio y volumen, rotación automática (cada 5 min a 3 h, en orden o aleatoria) y apertura al iniciar sesión.
- **Ahorro de energía**: pausa sola cuando las ventanas tapan el escritorio, cuando la pantalla se apaga, al bloquear la sesión y (opcional) al usar batería. No impide que la pantalla entre en reposo.
- Fundido suave al cambiar de video; los iconos del escritorio siguen visibles encima.

Los videos se copian en `~/Library/Application Support/FondoVivo/` (el original no se toca). Al eliminar uno, su copia va a la Papelera.

## Compilar e instalar

Solo hacen falta las Command Line Tools de Xcode (`xcode-select --install`).

```bash
./build.sh            # crea "build/Fondo Vivo.app"
./build.sh --install  # además la copia a /Applications
```

Para que «Abrir al iniciar sesión» funcione bien, usa la copia instalada en `/Applications`.

## Estructura

- `Sources/FondoVivo/Wallpaper/`: ventanas a nivel de escritorio y reproductor en bucle con fundido.
- `Sources/FondoVivo/Model/`: biblioteca de videos y preferencias.
- `Sources/FondoVivo/UI/`: ventana de la biblioteca (SwiftUI).
- `scripts/make_icon.swift`: genera el icono.
