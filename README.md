# twfoxtetrio

Mod modular de interfaz (HUD / QoL) hecho para la comunidad de **TETR.IO Desktop**.

> **Aviso de juego limpio:** Este mod es **100% visual (HUD overlay)**. No modifica físicas, controles, RNG, paquetes de red ni mecánicas de juego. Respeta las reglas de TETR.IO (únicamente muestra información en pantalla).

---

## ✨ Modificaciones incluidas

### 1. Blitz PB Delta Tracker (`blitz-pb-tracker`)
En la modalidad **BLITZ**, muestra un indicador flotante en la parte superior central de la pantalla con la diferencia respecto a tu **Personal Best (PB)**:

- 🔴 **Rojo (aún no superas tu PB):** Muestra `(Puntaje más alto - Puntaje actual)`, descontando en tiempo real hasta llegar a `0`.
- 🟢 **Verde (PB superado):** En cuanto superas tu puntaje más alto, cambia a **verde**, hace un destello sutil y **empieza a sumar hacia arriba** (`+1`, `+540`, `+12,400`, ...).
- 🔄 **Compatible con Quick Retry (`R`):** Si reinicias rápido con `R`, el contador vuelve automáticamente a `0` puntos y recalcula la diferencia en rojo.
- 👤 **Funciona con cuenta o en modo anónimo:** Lee tu PB oficial de TETR.IO automáticamente al iniciar sesión (y si juegas sin cuenta, guarda un PB local en el cliente).

### 2. 40 Lines PB Pace Tracker (`forty-lines-pb-tracker`)
En la modalidad **40 LINES**, muestra en la parte superior central el tiempo restante respecto a tu mejor marca:

- 🟢 **Verde (vas dentro de tu PB):** Empieza desde tu mejor tiempo (ej. `0:45.320`) y va bajando en tiempo real hacia `0:00.000`.
- 🔴 **Rojo (se acabó el tiempo de tu PB):** Apenas llega a `0:00.000`, cambia a **rojo** y empieza a aumentar (`+0:00.017`, `+0:01.250`, ...).
- 🔄 **Compatible con Quick Retry (`R`):** Al reiniciar rápido con `R`, vuelve a empezar en verde desde tu mejor tiempo.

### 3. Multiplayer Live VS Leaderboard (`multiplayer-vs-leaderboard`)
En modos **multijugador** (Tetra League, Public Rooms, Private Rooms y Royale — jugando o espectando), muestra una leaderboard fija en el borde derecho (`top-right`):

- 🏆 **Ordenada en tiempo real por VS:** Muestra los nombres de usuario y su VS en vivo, colocando arriba al jugador con mayor VS.
- ✨ **Resaltado claro:** Destaca al líder actual (`#1`) en dorado, tu propio usuario en azul y conserva a los jugadores eliminados (`[KO]`) con su VS final durante la ronda.

### 4. Crédito en pantalla de carga (`loading-credit`)
Al iniciar TETR.IO Desktop y durante la pantalla de carga inicial (`preload`), muestra `Modded By: TWFoxcrack` debajo del título/logo.

### 5. Hub FOXMOD en Home (`foxmod-menu`, `pentomino-engine`, `p2p-room`)
Añade un acceso **`FOXMOD`** en el menú principal (`HOME`, debajo de `ABOUT`) completamente integrado en el menú nativo de TETR.IO:
- 🧩 **Práctica (`PRACTICA`):** Submenú nativo con tres modos:
  - **`4WIDE`:** Lanza directamente una partida **4-Wide** en el motor real de TETR.IO Desktop.
  - **`PENTOMINOS`:** Tablero a pantalla completa con la estética y sprites reales de TETR.IO (`/res/skins/minos/tetrio.png`), **12 pentominós reales** (y opción Mix Caos / Tetrominós) adaptado automáticamente a tus **controles y handling (`DAS`, `ARR`, `SDF`)** de TETR.IO.
  - **`MARATHON`:** Lanza directamente **Marathon (150 líneas con niveles)** en el motor real de TETR.IO Desktop.
- 🌐 **Multijugador P2P (`MULTIJUGADOR`):** Salas personalizadas donde **el usuario creador se convierte en el servidor (Host)** vía WebRTC directo PC-a-PC sin servidor central. El Host elige el modo (Pentominós, Tetrominós o Caos), basura y gravedad, invita amigos mediante código `FOX1:` / `FOXR:`, chatea en el lobby e inicia rondas VS con envío de basura y mini-tableros en tiempo real.
- ⚙️ **Config (`CONFIG`):** Activa/desactiva y personaliza los HUDs (`Blitz PB`, `40 Lines Pace`, `Multiplayer VS Leaderboard`) o restablece valores por defecto.
- ❤️ **Créditos (`CREDITS`):** Versión del mod, módulos incluidos, **`Modded By: TWFoxcrack`** y enlace al repositorio en GitHub.

---

## 📦 Instalación (Windows - TETR.IO Desktop)

### Requisitos
- [TETR.IO Desktop](https://tetr.io/about/desktop/) (probado en Desktop v10 / Electron 37)
- [Node.js LTS](https://nodejs.org/) instalado

### Opción rápida (1 clic)
1. Cierra **TETR.IO Desktop** por completo.
2. Descarga el ZIP desde GitHub (**Code → Download ZIP** y **descomprímelo en una carpeta**) o clona este repositorio:
   ```bash
   git clone https://github.com/Foxcrack/twfoxtetrio.git
   cd twfoxtetrio
   ```
3. Entra a esa carpeta descomprimida y haz doble clic en **`install.bat`** (detecta automáticamente `C:\Users\<TuUsuario>\AppData\Local\Programs\tetrio-desktop`).
   - Si falta Node.js en ese PC, **`install.bat`** te preguntará si deseas instalar **Node.js LTS** automáticamente con `winget` (o puedes descargarlo desde [nodejs.org](https://nodejs.org/)).

El instalador crea automáticamente una copia de seguridad del archivo original (`app.asar.bak`) antes de aplicar el mod y verifica la integridad SHA-256 de todos los archivos dentro de `app.asar`.

### Ruta personalizada
Si instalaste TETR.IO Desktop en otro disco o carpeta diferente a `AppData\Local\Programs\tetrio-desktop`, arrastra la carpeta de TETR.IO encima de `install.bat`, o abre una terminal **dentro de la carpeta del mod** y ejecuta:
```bash
node scripts/install.js --path "C:\Ruta\A\tetrio-desktop"
```

### Verificar estado o desinstalar
- Ver estado:
  ```bash
  npm run status
  ```
- Desinstalar (restaura el `app.asar` original):
  - Doble clic en **`uninstall.bat`**, o ejecuta:
  ```bash
  npm run uninstall-mod
  ```

> **Nota sobre actualizaciones de TETR.IO Desktop:** Cuando el cliente oficial se actualice, vuelve a ejecutar `install.bat` (o `npm run install-mod`) para reinyectar el mod sobre la nueva versión.

---

## 🧩 Estructura para colaboradores de la comunidad

```text
twfoxtetrio/
├── src/
│   ├── core/
│   │   ├── runtime.js                 # Ciclo de vida, detección de modo, score/timer y registro
│   │   └── top-hud.js                 # Componente visual compartido en la parte superior
│   └── features/
│       ├── blitz-logic.js                 # Lógica pura del delta de Blitz
│       ├── blitz-pb-tracker.js            # HUD superior para BLITZ (rojo -> verde)
│       ├── forty-lines-logic.js           # Lógica pura del pace de 40 Lines
│       ├── forty-lines-pb-tracker.js      # HUD superior para 40 LINES (verde -> rojo)
│       ├── foxmod-canvas.js               # Renderizado 2D y control DAS/ARR de tableros FOXMOD
│       ├── foxmod-menu.js                 # Hub FOXMOD en Home (Práctica, Multijugador, Config, Créditos)
│       ├── loading-credit.js              # Texto "Modded By: TWFoxcrack" al iniciar/cargar
│       ├── multiplayer-logic.js           # Cálculo de VS y roster en vivo para multijugador
│       ├── multiplayer-vs-leaderboard.js  # Leaderboard lateral derecha de VS en tiempo real
│       ├── p2p-room.js                    # Servidor Host P2P y cliente WebRTC sin backend externo
│       └── pentomino-engine.js            # Motor jugable de 12 pentominós, tetrominós y mezcla caos
├── scripts/
│   ├── asar.js                    # Lector, empaquetador y verificador ASAR sin dependencias externas
│   ├── build.js                   # Compila el bundle en un único script para preload.js
│   └── install.js                 # Instalador / desinstalador seguro con backup
├── test/                          # Pruebas unitarias y simulación DOM en VM
├── install.bat
└── uninstall.bat
```

### Cómo agregar una nueva modificación
1. Crea tu módulo en `src/features/tu-feature.js` usando `window.__TWFOX_TETRIO__.registerFeature('nombre', (api) => { ... })`.
2. Añade la ruta del archivo al arreglo `SOURCE_FILES` en `scripts/build.js`.
3. Ejecuta las pruebas y reinstala:
   ```bash
   npm test
   npm run install-mod
   ```

---

## 🧪 Pruebas

```bash
npm test
```

## 📄 Licencia

[MIT](LICENSE)
