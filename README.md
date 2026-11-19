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

---

## 📦 Instalación (Windows - TETR.IO Desktop)

### Requisitos
- [TETR.IO Desktop](https://tetr.io/about/desktop/) (probado en Desktop v10 / Electron 37)
- [Node.js LTS](https://nodejs.org/) instalado

### Opción rápida (1 clic)
1. Cierra **TETR.IO Desktop** por completo.
2. Descarga o clona este repositorio:
   ```bash
   git clone https://github.com/Foxcrack/twfoxtetrio.git
   cd twfoxtetrio
   ```
3. Haz doble clic en **`install.bat`** (o ejecuta `npm run install-mod` en la terminal).

El instalador crea automáticamente una copia de seguridad del archivo original (`app.asar.bak`) antes de aplicar el mod y verifica la integridad SHA-256 de todos los archivos dentro de `app.asar`.

### Ruta personalizada
Si instalaste TETR.IO Desktop en otra carpeta:
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
│   │   └── runtime.js             # Ciclo de vida, detección de modo, score y registro de features
│   └── features/
│       ├── blitz-logic.js         # Lógica pura del cálculo (PB - actual) y detector de score
│       └── blitz-pb-tracker.js    # HUD superior en BLITZ (rojo / verde)
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
