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
    'practica, salas p2p, config & credits': 'práctica, salas P2P, ajustes y créditos',
    'practice': 'práctica',
    'practica': 'práctica',
    'solo practice lobbies · 4-wide, pentominoes, marathon & zen': 'salas de práctica · 4-ancho, pentominós, maratón y zen',
    'p2p rooms, normal & pentominoes vs / blitz matches': 'salas P2P, duelos y blitz con pentominós o normal',
    'mods, skins, hud trackers, idioma & updates': 'mods, skins, trackers HUD, idioma y actualizaciones',
    'skins, tablero, sfx, fondos animados & ajustes hud': 'skins, tablero, SFX, fondos animados y ajustes HUD',
    'skins, board, sfx, language, updates & hud settings': 'skins, tablero, SFX, idioma, updates y ajustes HUD',
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
    'spectating match': 'espectando partida',
    'click to switch to spectators': 'clic para cambiar a espectadores',
    'click to switch to players': 'clic para cambiar a jugadores',
    'lobby': 'sala',
    'live standings': 'clasificación en vivo',
    'round complete': 'ronda terminada',
    'victory!': '¡victoria!',
    'draw!': '¡empate!',
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
    if ((m = trimmed.match(/^RONDA #(\d+) COMPLETE$/i))) {
      return `RONDA #${m[1]} COMPLETADA`;
    }
    if ((m = trimmed.match(/^RONDA #(\d+) · (.+)$/i))) {
      return `RONDA #${m[1]} · ${translateText(m[2], 'es')}`;
    }
    if ((m = trimmed.match(/^WINNER RONDA #(\d+): (.+)$/i))) {
      return `GANADOR RONDA #${m[1]}: ${m[2]}`;
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
    const core = raw.slice(lead.length, raw.length - trail.length);
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
