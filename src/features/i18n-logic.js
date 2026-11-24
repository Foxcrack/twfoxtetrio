(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.TWFOX_I18N_LOGIC = api;
    root.__TWFOX_INTERNAL__ = root.__TWFOX_INTERNAL__ || {};
    root.__TWFOX_INTERNAL__.i18nLogic = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const SUPPORTED_LOCALES = ['en', 'es'];

  function normalizeLocale(raw) {
    const val = String(raw || '').trim().toLowerCase();
    if (val === 'es' || val.startsWith('es-') || val.startsWith('es_') || val === 'spanish' || val === 'español') {
      return 'es';
    }
    return 'en';
  }

  // Lowercase source phrase -> canonical lowercase Spanish translation.
  // Case preservation helper adapts ALL CAPS / Title Case / lowercase automatically.
  const EXACT_ES = {
    'home': 'inicio',
    'welcome to tetr.io!': '¡bienvenido a tetr.io!',
    'pick a game mode': 'elige un modo de juego',
    'back': 'atrás',
    'exit': 'salir',
    'refresh': 'actualizar',
    'got it!': '¡entendido!',
    'next': 'siguiente',
    'hold': 'reserva',
    'save': 'guardar',
    'save replay': 'guardar repetición',
    'replay': 'repetición',
    'reset': 'restablecer',
    'close': 'cerrar',
    'ok': 'aceptar',
    'cancel': 'cancelar',
    'ignore': 'ignorar',
    'accept': 'aceptar',
    'multiplayer': 'multijugador',
    'play online with friends and foes': 'juega en línea con amigos y rivales',
    'solo': 'solitario',
    'challenge yourself and top the leaderboards': 'supérate y lidera las clasificaciones',
    'tetra channel': 'canal tetra',
    'leaderboards, achievements, replays and more': 'clasificaciones, logros, repeticiones y más',
    'config': 'ajustes',
    'tweak your tetr.io experience': 'personaliza tu experiencia en tetr.io',
    'about': 'acerca de',
    'all about tetr.io': 'todo sobre tetr.io',
    '40 lines': '40 líneas',
    'complete 40 lines as quickly as possible': 'completa 40 líneas lo más rápido posible',
    'blitz': 'blitz',
    'a two-minute race against the clock': 'carrera de dos minutos contrarreloj',
    'zen': 'zen',
    'relax or train in this neverending mode': 'relájate o entrena en este modo infinito',
    'custom': 'personalizado',
    'play, train and experiment by your rules': 'juega, entrena y experimenta con tus reglas',
    'quick play': 'partida rápida',
    'expert quick play': 'partida rápida experta',
    'scale the tower! how far can you get?': '¡escala la torre! ¿qué tan alto llegarás?',
    'tetra league': 'liga tetra',
    'fight players of your skill in ranked duels': 'enfréntate en duelos clasificatorios de tu nivel',
    'custom game': 'partida personalizada',
    'create public and private rooms to play by your rules': 'crea salas públicas y privadas con tus propias reglas',
    'room listing': 'lista de salas',
    'join public games': 'únete a partidas públicas',
    'sound test': 'prueba de sonido',
    'merch store': 'tienda',
    'patch notes': 'notas de parche',
    'community discord': 'discord oficial',
    'developer blog': 'blog de desarrollo',
    'issue tracker': 'reporte de errores',
    'music room': 'sala de música',
    'get support': 'soporte',
    'royale': 'royale',
    'room name': 'nombre de sala',
    'chat': 'chat',
    'people': 'amigos',
    'notifications': 'notificaciones',
    'online': 'en línea',
    'offline': 'desconectado',
    'all': 'todos',
    'other': 'otros',
    'blocked': 'bloqueados',
    'away': 'ausente',
    'busy': 'ocupado',
    'anonymous': 'anónimo',
    'restricted': 'restringido',
    'find someone...': 'buscar jugador...',
    'in menus': 'en los menús',
    'in an online game': 'en una partida en línea',
    'in a custom game': 'en una partida personalizada',
    'in a tetra league game': 'en una partida de liga tetra',
    'spectating an online game': 'espectando una partida en línea',
    'spectating quick play': 'espectando partida rápida',
    'in tetra league queue': 'en cola de liga tetra',
    'tetra league standing': 'rango en liga tetra',
    'enter matchmaking': 'buscar partida',
    'how does it work?': '¿cómo funciona?',
    'personal best': 'mejor marca',
    'personal rank': 'rango personal',
    'country rank': 'rango nacional',
    'global rank': 'rango mundial',
    'options': 'opciones',
    'advanced': 'avanzado',
    'start': 'iniciar',
    'ready': 'listo',
    'end result': 'resultado final',
    'final score': 'puntuación final',
    'final time': 'tiempo final',
    'new record!': '¡nuevo récord!',
    'stats': 'estadísticas',
    'handling': 'manejo',
    'controls': 'controles',
    'volume & audio': 'volumen y audio',
    'gameplay': 'jugabilidad',
    'action text': 'texto de acción',
    'video & interface': 'video e interfaz',
    'graphics': 'gráficos',
    'caching': 'caché',
    'account': 'cuenta',
    'customization': 'personalización',
    'privacy': 'privacidad',
    'export settings': 'exportar ajustes',
    'music tweaker': 'mezclador musical',
    'order history': 'historial de pedidos',
    'avatar': 'avatar',
    'banner': 'banner',
    'about me': 'sobre mí',
    'country': 'país',
    'username': 'usuario',
    'email': 'correo',
    'password': 'contraseña',
    'two-factor authentication': 'autenticación 2FA',
    'connections': 'conexiones',
    'skip login screen': 'saltar pantalla de inicio',
    'framerate limiter': 'limitador de FPS',
    'leaderboards': 'clasificaciones',
    'players': 'jugadores',
    'achievements': 'logros',
    'live now': 'en directo ahora',
    'tetra news': 'noticias tetra',
    'me': 'yo',
    'overview': 'resumen',
    'full': 'completo',
    'view full': 'ver todo',
    'world': 'mundial',
    'friends': 'amigos',
    'my page': 'mi perfil',
    'recent': 'recientes',
    'view full profile': 'ver perfil completo',
    'change account settings': 'cambia los ajustes de tu cuenta',
    'hover over a setting for more info': 'pasa el cursor sobre un ajuste para más información',
    'rotation buffering (irs)': 'búfer de rotación (IRS)',
    'hold buffering (ihs)': 'búfer de reserva (IHS)',
    'disable sound entirely': 'desactivar todo el sonido',
    'mute music when hidden': 'silenciar música al minimizar',
    'do not reset music when retrying': 'no reiniciar música al reintentar',
    'show duels side-by-side': 'mostrar duelos lado a lado',
    'invert chat colors': 'invertir colores del chat',
    'darken screen behind chat': 'oscurecer pantalla detrás del chat',
    'do not animate background in quick play': 'no animar fondo en partida rápida',
    'no background in menus': 'sin fondo en los menús',
    'use custom background image': 'usar imagen de fondo personalizada',
    'pro mode': 'modo pro',
    'alert on finesse fault': 'avisar error de finesse',
    'retry on finesse fault': 'reintentar al fallar finesse',
    'stride mode': 'modo stride',
    'expert mode': 'modo experto',
    'double hole garbage': 'basura doble hueco',
    'volatile garbage': 'basura volátil',
    'gravity': 'gravedad',
    'no hold': 'sin reserva',
    'messier garbage': 'basura desordenada',
    'invisible': 'invisible',
    'all-spin': 'all-spin',
    'duo': 'dúo',
    'return to match': 'volver a la partida',
    'click to copy url': 'clic para copiar enlace',
    'click to copy room code': 'clic para copiar código',
    'room code · click to copy': 'código de sala · clic para copiar',
    'currently ingame': 'actualmente en partida',
    'playing': 'jugando',
    'spectating': 'espectando',
    'spectate': 'espectar',
    'welcome': 'bienvenida',
    'room': 'sala',
    'match': 'partida',
    'game': 'juego',
    'wait': 'espera',
    'host': 'anfitrión',
    'spectator': 'espectador',
    'add or remove mods': 'añadir o quitar mods',
    "this week's personal best": 'mejor marca semanal',
    'your final altitude': 'tu altitud final',
    'pieces': 'piezas',
    'lines': 'líneas',
    'lines left': 'líneas rest.',
    'attack': 'ataque',
    'time': 'tiempo',
    'score': 'puntuación',
    'top out': 'derrota',
    'finish!': '¡meta!',
    'time up!': '¡tiempo!',
    'test': 'probar',
    'off': 'desact.',
    'some': 'algunos',
    'minimal': 'mínimo',
    'low': 'bajo',
    'medium': 'medio',
    'high': 'alto',
    'ultra': 'ultra',
    'balanced': 'balanceado',
    'legacy': 'clásico',
    'enable': 'activar',
    'disable': 'desactivar',
    'remove': 'quitar',
    'change': 'cambiar',
    'link': 'vincular',
    'my friends': 'mis amigos',
    'everyone': 'todos',
    'nobody': 'nadie',
    'never': 'nunca',
    'when needed': 'si es necesario',
    'always': 'siempre',
    'log out': 'cerrar sesión',
    'log out all': 'cerrar todas las sesiones',

    // FOXMOD specific UI & features
    'welcome to tetrio!': '¡bienvenido a TETR.IO!',
    'tweak your tetrio experience': 'personaliza tu experiencia en TETR.IO',
    'all about tetrio': 'todo sobre TETR.IO',
    'pick a game mode': 'elige un modo de juego',
    'pick a foxmod section': 'elige una sección de FOXMOD',
    'pick a practice mode': 'elige un modo de práctica',
    'press start to begin playing': 'pulsa iniciar para empezar a jugar',
    'tweak your twfoxtetrio hud settings': 'personaliza los ajustes HUD de twfoxtetrio',
    'custom p2p rooms — host acts as server': 'salas P2P — el anfitrión actúa como servidor',
    'modded by twfoxcrack': 'mod por twfoxcrack',
    '12 pentominoes · real tetr.io controls & skin': '12 pentominós · controles y skin reales de TETR.IO',
    'foxmod config': 'ajustes foxmod',
    'foxmod credits': 'créditos foxmod',
    'practice, p2p rooms, config & credits': 'práctica, salas P2P, ajustes y créditos',
    'practica, salas p2p, config & credits': 'práctica, salas P2P, ajustes y créditos',
    'practice': 'práctica',
    'practica': 'práctica',
    'zen / practice': 'zen / práctica',
    'solo practice lobbies · 4-wide, pentominoes, marathon & zen': 'salas de práctica · 4-ancho, pentominós, maratón y zen',
    '4-wide, pentominoes, marathon & custom solo modes': '4-ancho, pentominós, maratón y modos solitarios',
    'p2p rooms, normal & pentominoes vs / blitz matches': 'salas P2P, duelos y blitz con pentominós o normal',
    'create p2p custom rooms (you are the server) or join friends': 'crea salas P2P personalizadas (eres el servidor) o únete a amigos',
    'mods, skins, hud trackers, idioma & updates': 'mods, skins, trackers HUD, idioma y actualizaciones',
    'skins, tablero, sfx, fondos animados & ajustes hud': 'skins, tablero, SFX, fondos animados y ajustes HUD',
    'skins, board, sfx, language, updates & hud settings': 'skins, tablero, SFX, idioma, actualizaciones y ajustes HUD',
    'skins, board, sfx & backgrounds (tetr.io+)': 'skins, tablero, SFX y fondos (TETR.IO+)',
    'direct download from https://you.have.fail/tetrioplus/ · blocks, board, sounds & animated backgrounds.': 'descarga directa desde https://you.have.fail/tetrioplus/ · piezas, tablero, sonidos y fondos animados.',
    'reload tetr.io (apply sfx/skin)': 'recargar TETR.IO (aplicar SFX/skin)',
    'explore (tetr.io+)': 'explorar (TETR.IO+)',
    'background / local': 'fondo / local',
    'search skin, board, sfx or author in tetr.io+...': 'buscar skin, tablero, SFX o autor en TETR.IO+...',
    'most voted': 'más votados',
    'name a-z': 'nombre A-Z',
    'author': 'autor',
    'skins': 'skins',
    'prev': 'anterior',
    'blocks / minos': 'piezas / minos',
    'board / queue': 'tablero / cola',
    'sounds (sfx)': 'sonidos (SFX)',
    'background / animated': 'fondo / animado',
    'minos': 'piezas',
    'board': 'tablero',
    'background': 'fondo',
    'animated': 'animado',
    'downloading...': 'descargando...',
    'active ✓': 'activo ✓',
    'activate': 'activar',
    'uninstall': 'desinstalar',
    'download & install': 'descargar e instalar',
    'test sfx': 'probar SFX',
    'loading block preview...': 'cargando vista previa de bloques...',
    'no assets matched that filter.': 'no se encontraron assets con ese filtro.',
    'no downloaded assets yet. visit explore (tetr.io+) or background / local.': 'aún no tienes assets descargados. ve a EXPLORAR (TETR.IO+) o FONDO / LOCAL.',
    'built-in animated backgrounds': 'fondos animados integrados',
    'displayed behind menus and boards with no external downloads.': 'se muestran detrás de menús y tableros sin descargas externas.',
    'use the native tetr.io desktop background without extra overlay.': 'usa el fondo nativo de TETR.IO Desktop sin capa extra.',
    '3d animated starfield with neon trails.': 'campo de estrellas 3D animado con estelas neón.',
    'animated retro synthwave grid in endless perspective.': 'grilla retro synthwave animada en perspectiva continua.',
    'soft luminous real-time gradient waves.': 'ondas luminosas suaves con gradiente en tiempo real.',
    'background opacity': 'opacidad del fondo',
    'blur': 'desenfoque (blur)',
    'image, gif or video url (.mp4 / .webm)...': 'URL imagen, GIF o video (.mp4 / .webm)...',
    'apply url': 'aplicar URL',
    'clear background': 'quitar fondo',
    'upload background (png/gif/mp4/webm)': 'subir fondo (PNG/GIF/MP4/WEBM)',
    'import local (.tpse / .zip / .png)': 'importar local (.TPSE / .ZIP / .PNG)',
    'custom background': 'fondo personalizado',
    'custom url': 'URL personalizada',
    'ready to connect with https://you.have.fail/tetrioplus/': 'listo para conectar con https://you.have.fail/tetrioplus/',
    'connecting to https://you.have.fail/tetrioplus/ ...': 'conectando con https://you.have.fail/tetrioplus/ ...',
    'assets module not initialized.': 'módulo de assets no inicializado.',
    'chaos mix (19)': 'mezcla caos (19)',
    'blitz pb tracker': 'tracker pb de blitz',
    'enable blitz pb hud': 'activar hud pb de blitz',
    'show points remaining to surpass your personal best (and surplus in green).': 'muestra los puntos restantes para superar tu mejor marca (y el excedente en verde).',
    'show best score subtitle': 'mostrar subtítulo de mejor puntuación',
    'display your current blitz personal best beneath the counter.': 'muestra tu récord actual de Blitz debajo del contador.',
    'show minus sign while behind pb': 'mostrar signo "-" por debajo del pb',
    'prefix a "-" sign before the deficit while below your best score.': 'antepone el signo "-" mientras estés por debajo de tu mejor puntuación.',
    '40 lines pb pace tracker': 'tracker ritmo pb 40 líneas',
    'enable 40 lines pb pace hud': 'activar hud ritmo pb 40 líneas',
    'start at your pb in green counting down to 0:00, then overtime in red.': 'empieza en tu PB en verde descontando hacia 0:00, y luego tiempo extra en rojo.',
    'show best time subtitle': 'mostrar subtítulo de mejor tiempo',
    'display your current 40 lines personal best beneath the pace timer.': 'muestra tu mejor tiempo de 40 Líneas debajo del temporizador.',
    'quick play weekly pb bar': 'barra pb semanal partida rápida',
    'enable quick play weekly pb bar': 'activar barra pb semanal partida rápida',
    'show left vertical progress bar + countdown to weekly pb, hiding the bar in green when surpassed.': 'muestra la barra vertical izquierda y cuenta regresiva al PB semanal; se oculta en verde al superarlo.',
    'show weekly pb subtitle': 'mostrar subtítulo de pb semanal',
    'display your current weekly pb altitude beneath the digits.': 'muestra tu altitud PB semanal actual debajo de los números.',
    'show minus sign while behind weekly pb': 'mostrar signo "-" debajo del pb semanal',
    'prefix a "-" sign before remaining meters while below your weekly pb.': 'antepone "-" a los metros restantes mientras estés bajo tu PB semanal.',
    'multiplayer live vs leaderboard': 'tabla vs en vivo multijugador',
    'enable live vs leaderboard': 'activar tabla vs en vivo',
    'show the real-time vs ranking panel on the right in multiplayer matches.': 'muestra la clasificación VS en tiempo real a la derecha en partidas multijugador.',
    'show in quick play (zenith tower)': 'mostrar en partida rápida (torre zenith)',
    'also display the live vs leaderboard while climbing in quick play.': 'también muestra la tabla VS en vivo mientras escalas en Partida Rápida.',
    'max players displayed': 'máximo de jugadores mostrados',
    'limit how many player rows appear at once in the vs leaderboard.': 'limita cuántas filas de jugadores aparecen a la vez en la tabla VS.',
    'foxmod paw badge (mod identifier)': 'patita foxmod (identificador de mod)',
    'show foxmod fox paw badge': 'mostrar patita de zorro foxmod',
    'display a fox paw badge next to your name and other players running foxmod.': 'muestra una patita de zorro junto a tu nombre y otros jugadores con FOXMOD.',
    'test the radiance audio system': 'prueba el sistema de audio RADIANCE',
    'support tetrio': 'apoya a TETR.IO',
    'support development or gift supporter status and get rewards!': '¡apoya el desarrollo o regala estatus Supporter y obtén recompensas!',
    'browse the collection of all official tetrio goodies!': '¡explora toda la colección oficial de productos de TETR.IO!',
    'tetrio desktop': 'TETR.IO Desktop',
    'get the desktop client for extra functions and improved performance': 'descarga el cliente de escritorio para más funciones y rendimiento',
    'follow development and see what\'s new': 'sigue el desarrollo y mira las novedades',
    'follow updates on tetrio, give feedback and have fun': 'sigue noticias de TETR.IO, envía sugerencias y diviértete',
    'follow updates on tetrio and more': 'sigue actualizaciones de TETR.IO y más',
    'report bugs and pitch ideas to improve tetrio': 'reporta errores y propón mejoras para TETR.IO',
    'listen to tetrio background music': 'escucha la música de fondo de TETR.IO',
    'join hard drop': 'únete a hard drop',
    'join an extensive, vibrant community about all things stacker': 'únete a una comunidad vibrante sobre todo lo relacionado al stacker',
    'legal & about': 'legal y acerca de',
    'read the tetrio privacy policy, terms of service, rules and more': 'lee la política de privacidad, términos y reglas de TETR.IO',
    'get help, appeal bans, or otherwise talk to staff': 'obtén ayuda, apela sanciones o contacta al equipo',
    'global leaderboards for 40 lines, blitz and quick play': 'clasificaciones mundiales de 40 Líneas, Blitz y Partida Rápida',
    'view your own records and recent games': 'consulta tus propios récords y partidas recientes',
    'tetra league leaderboards and xp': 'clasificaciones y XP de Liga Tetra',
    'view your achievements and their progress': 'consulta tus logros y su progreso',
    'change settings for tetrio desktop': 'cambia los ajustes de TETR.IO Desktop',
    'play more games to receive a rank': 'juega más partidas para recibir un rango',
    'leaving early is punished': 'abandonar antes es penalizado',
    'estimated queue time: unknown': 'tiempo estimado de cola: desconocido',
    'update available': 'actualización disponible',
    'installing update...': 'instalando actualización...',
    'downloading and installing update...': 'descargando e instalando actualización...',
    'update installed! restarting tetr.io...': '¡actualización instalada! reiniciando TETR.IO...',
    'update installed! please restart tetr.io.': '¡actualización instalada! reinicia TETR.IO.',
    'manual update required': 'actualización manual requerida',
    'copy command': 'copiar comando',
    'updating...': 'actualizando...',
    'restarting...': 'reiniciando...',
    'credits': 'créditos',
    'modded by twfoxcrack & twfoxtetrio repository': 'mod por TWFoxcrack y repositorio twfoxtetrio',
    'practice modes (4wide, pentominoes & marathon)': 'modos de práctica (4-ancho, pentominós y maratón)',
    'launches 4wide & marathon on tetr.io engine + tetr.io-skinned 12-pentominoes.': 'lanza 4-ancho y maratón con el motor de TETR.IO + 12 pentominós con estilo TETR.IO.',
    'host-server p2p custom rooms': 'salas personalizadas P2P con servidor local',
    'creator acts as room server over webrtc with pentominoes / tetrominoes / chaos.': 'el creador actúa como servidor por WebRTC con pentominós / tetrominós / caos.',
    'blitz pb delta & 40 lines pb pace huds': 'huds de delta pb en blitz y ritmo en 40 líneas',
    'real-time top hud trackers dynamically adapting to pb and quick retry.': 'trackers HUD superiores en tiempo real adaptados al PB y reinicio rápido.',
    'sorted real-time vs standings in multiplayer': 'clasificación VS ordenada en tiempo real en multijugador',
    'sorted real-time vs standings with [ko] tracking and automatic #killfeed shift.': 'clasificación VS en vivo con conteo de [KO] y ajuste automático del #killfeed.',
    'loading screen attribution': 'créditos en pantalla de carga',
    'displays "modded by: twfoxcrack" beneath the desktop loader.': 'muestra "Modded By: TWFoxcrack" bajo la pantalla de carga.',
    'visual hud trackers & standalone offline/p2p foxmod modes. never modifies official tetr.io server physics or network packets.': 'trackers visuales HUD y modos independientes/P2P de FOXMOD. Nunca modifica la física ni paquetes del servidor oficial de TETR.IO.',
    'github repo': 'repositorio github',
    'create lobby': 'crear sala',
    'create a custom p2p room where your pc acts as the server': 'crea una sala P2P donde tu PC actúa como servidor',
    'join lobby': 'unirse a sala',
    'connect to a friend room using their short #code': 'conéctate a la sala de un amigo usando su #CODE corto',
    'join by room code': 'unirse por código de sala',
    'enter the room code from your friend (with or without #):': 'introduce el código de sala de tu amigo (con o sin #):',
    'join room': 'entrar a sala',
    'room invite code — friends enter this #code in join lobby:': 'código de sala — tus amigos entran con este #CODE en unirse a sala:',
    'invite mutual friends': 'invitar amigos mutuos',
    'foxmod · 1-click': 'foxmod · 1 clic',
    'invite': 'invitar',
    'in room': 'en sala',
    'no code': 'sin código',
    'manual p2p fallback ▾': 'p2p manual alternativo ▾',
    'manual p2p fallback (no signaling server needed):': 'p2p manual (sin servidor de señalización):',
    'copy code': 'copiar',
    'generate offer': 'generar oferta',
    'copy offer': 'copiar oferta',
    'connect player': 'conectar jugador',
    'copy reply': 'copiar respuesta',
    'send': 'enviar',
    'waiting for host': 'esperando al anfitrión',
    'waiting for players': 'esperando jugadores',
    'spectating match': 'espectando partida',
    'click to switch to spectators': 'clic para cambiar a espectadores',
    'click to switch to players': 'clic para cambiar a jugadores',
    'lobby': 'sala',
    'live standings': 'clasificación en vivo',
    'round complete': 'ronda terminada',
    'victory!': '¡victoria!',
    'draw!': '¡empate!',
    'draw': 'empate',
    'results →': 'resultados →',
    'back to lobby': 'volver a la sala',
    'play again': 'jugar de nuevo',
    'server authority': 'autoridad del servidor',
    'you (host server)': 'tú (servidor anfitrión)',
    'remote host server': 'servidor anfitrión remoto',
    'room status': 'estado de la sala',
    'topology': 'topología',
    'webrtc direct p2p': 'webrtc p2p directo',
    'game mode': 'modo de juego',
    'piece set': 'set de piezas',
    'garbage mult': 'mult. basura',
    'gravity level': 'nivel de gravedad',
    'versus ko': 'versus ko',
    'blitz (2:00)': 'blitz (2:00)',
    'normal (7 tetrominos)': 'normal (7 tetrominós)',
    'pentominos (12)': 'pentominós (12)',
    'caos mix (19)': 'mezcla caos (19)',
    'foxmod invite': 'invitación foxmod',
    'foxmod room closed': 'sala foxmod cerrada',
    'foxmod host rotated': 'anfitrión rotado',
    'foxmod update available': 'actualización foxmod disponible',
    'update now': 'actualizar ahora',
    'update & restart': 'actualizar y reiniciar',
    'check updates': 'buscar actualización',
    'checking for updates...': 'buscando actualizaciones...',
    'up to date': 'actualizado',
    'later': 'después',
    'language & updates': 'idioma y actualizaciones',
    'interface language (global)': 'idioma del juego (global)',
    'applies spanish or english across both foxmod and tetrio menus.': 'cambia todo el juego (FOXMOD y TETR.IO) entre Español e Inglés.',
    'applies spanish or english across both foxmod and tetr.io menus.': 'cambia todo el juego (FOXMOD y TETR.IO) entre Español e Inglés.',
    'foxmod version & auto-updater': 'versión y actualizador automático de foxmod',
    'changes saved automatically': 'cambios guardados automáticamente',
    'settings saved': 'ajustes guardados',
    'reset defaults': 'restablecer valores',
    'reset to defaults': 'valores restablecidos',
    'need at least 2 players to start': 'faltan jugadores (mínimo 2)',
    'waiting for host to start next round...': 'esperando al anfitrión para la siguiente ronda...',
    'ready to start next round or return to lobby': 'listo para otra ronda o volver a la sala',
    'need 2+ players for next round': 'se necesitan 2+ jugadores para otra ronda',
    'press start to begin practicing 4-wide combos': 'pulsa iniciar para practicar combos 4-ancho',
    'press start to begin practicing marathon': 'pulsa iniciar para jugar maratón',
    'press start to enter custom pentominoes mode': 'pulsa iniciar para jugar con pentominós',
    'personal best score': 'mejor puntuación personal',
    'personal best time': 'mejor tiempo personal',
    '4wide': '4-ancho',
    'marathon': 'maratón',
    'message...': 'mensaje...',
    'submode': 'submodo',
    'song': 'música',
    'foxmod trackers': 'trackers de foxmod',
    'personal best hud': 'hud de récords personales',
    'blitz pb tracker': 'tracker pb de blitz',
    'shows remaining points vs personal best during blitz': 'muestra los puntos restantes frente a tu pb en blitz',
    '40 lines pb tracker': 'tracker pb de 40 líneas',
    'shows remaining countdown vs personal best in 40 lines': 'muestra el tiempo restante frente a tu pb en 40 líneas',
    'quick play pb tracker': 'tracker pb de partida rápida',
    'shows left weekly pb altitude meter in quick play': 'muestra la barra de altitud semanal a la izquierda en partida rápida',
    'multiplayer vs leaderboard': 'tabla vs multijugador',
    'shows sorted live vs standings in multiplayer': 'muestra la clasificación vs ordenada en vivo en multijugador',
    'foxmod paw badge': 'patita foxmod (mqtt)',
    'shows fox paw icon next to players who run foxmod': 'muestra la patita de zorro junto a jugadores que usan foxmod',
    'no online mutual foxmod friends detected yet. open people once to sync mutual friends.': 'aún no se detectaron amigos mutuos online con FOXMOD. abre AMIGOS una vez para sincronizarlos.',
    'create or join a room before inviting friends.': 'crea o únete a una sala antes de invitar amigos.'
  };

  function applyCasePattern(source, translated) {
    if (!translated) return source;
    const trimmed = String(source || '').trim();
    if (!trimmed) return translated;
    if (trimmed.length >= 2 && trimmed === trimmed.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(trimmed)) {
      return translated.toUpperCase();
    }
    const first = trimmed.charAt(0);
    if (first === first.toUpperCase() && first !== first.toLowerCase()) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }
    return translated;
  }

  function translateDynamicPatterns(trimmed) {
    let m;
    if ((m = trimmed.match(/^PLAYERS \((\d+)\)$/i))) {
      return `JUGADORES (${m[1]})`;
    }
    if ((m = trimmed.match(/^PLAYERS \((\d+) \+ (\d+) SPEC\)$/i))) {
      return `JUGADORES (${m[1]} + ${m[2]} ESP)`;
    }
    if ((m = trimmed.match(/^NEED 2\+ PLAYERS \((\d+)\/2\)$/i))) {
      return `FALTAN JUGADORES (${m[1]}/2)`;
    }
    if ((m = trimmed.match(/^(\d+) PLAYERS$/i))) {
      return `${m[1]} JUGADORES`;
    }
    if ((m = trimmed.match(/^WAIT (\d+)S$/i))) {
      return `ESPERA ${m[1]}S`;
    }
    if ((m = trimmed.match(/^ROOM ONLINE · CODE #([A-Z0-9]+)$/i))) {
      return `SALA EN LÍNEA · CÓDIGO #${m[1]}`;
    }
    if ((m = trimmed.match(/^CONNECTING RELAY · CODE #([A-Z0-9]+)$/i))) {
      return `CONECTANDO RELAY · CÓDIGO #${m[1]}`;
    }
    if ((m = trimmed.match(/^(?:RONDA|ROUND) #(\d+) COMPLETE$/i))) {
      return `RONDA #${m[1]} COMPLETADA`;
    }
    if ((m = trimmed.match(/^(?:RONDA|ROUND) #(\d+) · (.+)$/i))) {
      return `RONDA #${m[1]} · ${translateText(m[2], 'es')}`;
    }
    if ((m = trimmed.match(/^(?:WINNER RONDA #(\d+):|ROUND #(\d+) WINNER:) (.+)$/i))) {
      return `GANADOR RONDA #${m[1] || m[2]}: ${m[3]}`;
    }
    if ((m = trimmed.match(/^DOWNLOADED \((\d+)\)$/i))) {
      return `DESCARGADOS (${m[1]})`;
    }
    if ((m = trimmed.match(/^Showing (\d+) of (\d+) results \((\d+) on TETR\.IO\+\)$/i))) {
      return `Mostrando ${m[1]} de ${m[2]} resultados (${m[3]} en TETR.IO+)`;
    }
    if ((m = trimmed.match(/^Page (\d+) \/ (\d+)$/i))) {
      return `Página ${m[1]} / ${m[2]}`;
    }
    if ((m = trimmed.match(/^(\d+) assets saved locally on your device\.$/i))) {
      return `${m[1]} assets guardados localmente en tu equipo.`;
    }
    if ((m = trimmed.match(/^by (.+?) · (.+)$/i))) {
      return `por ${m[1]} · ${m[2]}`;
    }
    if ((m = trimmed.match(/^Imported & activated: (.+)$/i))) {
      return `Instalado y activado: ${m[1]}`;
    }
    if ((m = trimmed.match(/^BACKGROUND (\d+\/\d+)$/i))) {
      return `FONDO ${m[1]}`;
    }
    if ((m = trimmed.match(/^([\d,]+)\s+IN QUEUE\s*-\s*([\d,]+)\s+IN GAME$/i))) {
      return `${m[1]} EN COLA - ${m[2]} EN PARTIDA`;
    }
    if ((m = trimmed.match(/^(.+) WINS!$/i))) {
      return `¡${m[1]} GANA!`;
    }
    if ((m = trimmed.match(/^(.+?) invited you to #([A-Z0-9]+) \(([^)]+)\)$/i))) {
      return `${m[1]} te invitó a #${m[2]} (${m[3]})`;
    }
    if ((m = trimmed.match(/^You are now the HOST of room #([A-Z0-9]+)\.$/i))) {
      return `Ahora eres el ANFITRIÓN de la sala #${m[1]}.`;
    }
    if ((m = trimmed.match(/^(.+?) left — FOXMOD room closed\.$/i))) {
      return `${m[1]} salió — se cerró la sala de FOXMOD.`;
    }
    if ((m = trimmed.match(/^New version (v?[\d.]+) is available \(installed: (v?[\d.]+)\)\.$/i))) {
      return `Hay una nueva versión ${m[1]} disponible (tienes ${m[2]}).`;
    }
    if ((m = trimmed.match(/^Up to date\s*[·(]\s*(v?[\d.]+)\)?$/i))) {
      return `Actualizado (${m[1]})`;
    }
    if ((m = trimmed.match(/^Update available:\s*(v?[\d.]+)\s*\(installed\s*(v?[\d.]+)\)$/i))) {
      return `Nueva versión: ${m[1]} (tienes ${m[2]})`;
    }
    if ((m = trimmed.match(/^(.+?) has added you to their friends list$/i))) {
      return `${m[1]} te añadió a su lista de amigos`;
    }
    if ((m = trimmed.match(/^(.+?) has friended you back$/i))) {
      return `${m[1]} te aceptó como amigo`;
    }
    if ((m = trimmed.match(/^Playing (.+)$/i))) {
      return `Jugando ${translateText(m[1], 'es')}`;
    }
    if ((m = trimmed.match(/^Spectating (.+)$/i))) {
      return `Espectando ${translateText(m[1], 'es')}`;
    }
    if ((m = trimmed.match(/^([\d,]+)\s+ONLINE$/i))) {
      return `${m[1]} EN LÍNEA`;
    }
    if ((m = trimmed.match(/^(\d+)\s+seconds?\s+this session$/i))) {
      return `${m[1]} segundos en esta sesión`;
    }
    if ((m = trimmed.match(/^(\d+)\s+minutes?\s+this session$/i))) {
      return `${m[1]} minutos en esta sesión`;
    }
    if ((m = trimmed.match(/^Sent orange FOXMOD invite to (.+?)! \((\d+)s cooldown\)$/i))) {
      return `¡Invitación naranja enviada a ${m[1]}! (espera ${m[2]}s)`;
    }
    if ((m = trimmed.match(/^Wait (\d+)s before inviting (.+?) again\.$/i))) {
      return `Espera ${m[1]}s antes de invitar de nuevo a ${m[2]}.`;
    }
    return null;
  }

  function translateText(raw, locale) {
    const loc = normalizeLocale(locale);
    if (typeof raw !== 'string' || !raw || loc === 'en') return raw;
    const leadMatch = raw.match(/^\s*/);
    const trailMatch = raw.match(/\s*$/);
    const lead = leadMatch ? leadMatch[0] : '';
    const trail = trailMatch ? trailMatch[0] : '';
    const core = raw.slice(lead.length, raw.length - trail.length).replace(/\u00a0/g, ' ');
    if (!core) return raw;

    // Skip pure numbers, timers, codes, URLs, or symbols
    if (/^[\d.,:%+\-/#№\s]+$/.test(core) || /^https?:\/\//i.test(core)) {
      return raw;
    }

    const lower = core.replace(/\s+/g, ' ').trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(EXACT_ES, lower)) {
      return lead + applyCasePattern(core, EXACT_ES[lower]) + trail;
    }

    const dyn = translateDynamicPatterns(core.trim());
    if (dyn !== null) {
      return lead + dyn + trail;
    }

    return raw;
  }

  return {
    SUPPORTED_LOCALES,
    normalizeLocale,
    EXACT_ES,
    translateText
  };
});
