/**
 * js/config.js - Configurações centrais, constantes de balanceamento e mapeamento de teclas.
 * Fonte única da verdade (Single Source of Truth) para todo o jogo.
 * Namespace global: window.SI.CONFIG
 */

window.SI = window.SI || {};

window.SI.CONFIG = {
  // --- Vídeo e Resolução ---
  VIDEO: {
    LOGICAL_WIDTH: 224,      // Grade lógica do arcade original (ref.)
    LOGICAL_HEIGHT: 256,     // Grade lógica do arcade original (ref.)
    RENDER_SCALE: 4,         // Fator de escala interna (896x1024)
    PIXEL_ART: true          // true = pixel art sem suavização; false = texturas suavizadas
  },

  // --- Loop de Jogo em Passo Fixo ---
  LOOP: {
    TARGET_FPS: 60,
    TIMESTEP: 1000 / 60      // Passo fixo de 60 Hz (16.666ms)
  },

  // --- Chaves dos Recursos e Modos ---
  FEATURES: {
    bulletHell: true,        // Padrões de tiros avançados estilo Touhou
    parry: true,             // Mecânica de Parry com tecla C
    items: true,             // Drops determinísticos a cada 20 abates
    specials: true,          // Especiais recarregáveis a cada 70 abates
    boss: true,              // Chefe final no teto de 67.000 pontos
    focusMode: true          // Modo foco (Shift) com hitbox visível
  },

  // --- Mapeamento Único de Teclas (Single Source of Truth) ---
  KEYBINDS: {
    moveLeft: ['ArrowLeft', 'KeyA'],
    moveRight: ['ArrowRight', 'KeyD'],
    fire: ['Space'],
    parry: ['KeyC'],
    special: ['KeyX'],
    focus: ['ShiftLeft', 'ShiftRight'],
    pause: ['KeyP', 'Escape'],
    mute: ['KeyM'],
    confirm: ['Enter'],
    commands: ['F1']
  },

  KEYBIND_LABELS: {
    moveLeft: 'Mover para a Esquerda',
    moveRight: 'Mover para a Direita',
    fire: 'Disparar Canhão',
    parry: 'Parry (Aparar Projétil Magenta)',
    special: 'Ativar Arma Especial',
    focus: 'Modo Foco (Velocidade 0.4x + Hitbox)',
    pause: 'Pausar / Retomar Jogo',
    mute: 'Alternar Som (Mudo)',
    confirm: 'Confirmar / Iniciar / Reiniciar',
    commands: 'Painel de Comandos'
  },

  // Atalhos do Modo Debug (?debug=1)
  DEBUG_KEYS: {
    itemForce: 'KeyI',       // Força próximo abate a soltar Item Comum
    specialForce: 'KeyO',    // Força próximo abate a soltar Especial
    killAll: 'KeyK',         // Elimina todos os invasores vivos da onda
    bossJump: 'KeyB'         // Salta imediatamente para a luta do Chefe (67.000 pts)
  },

  // --- Jogador (Canhão) ---
  PLAYER: {
    SPEED: 2.5,              // 2.5 px lógicos/frame para esquiva em bullet hell (ref.)
    FOCUS_SPEED_MULT: 0.4,   // 0.4x da velocidade normal durante o modo foco
    HITBOX_RADIUS: 3.0,      // Hitbox real circular de 3 px centralizado no sprite
    INITIAL_LIVES: 3,        // 3 vidas iniciais (ref.)
    EXTRA_LIFE_SCORE: 1500,  // Vida extra única em 1.500 pontos (ref.)
    WIDTH: 13,               // Largura visual do sprite (ref.)
    HEIGHT: 8,               // Altura visual do sprite (ref.)
    START_X: 105,            // Posição X inicial (centro aproximado)
    START_Y: 216,            // Posição Y inicial
    CANNON_Y: 216,           // Linha Y de referência do canhão
    GROUND_Y: 240,           // Linha verde do chão do arcade (ref.)
    MIN_X: 8,                // Limite horizontal esquerdo
    MAX_X: 203,              // Limite horizontal direito (224 - 13 - 8)
    RESPAWN_DELAY_FRAMES: 90 // ~1.5s ao ser destruído
  },

  // --- Disparo do Jogador ---
  PLAYER_SHOT: {
    SPEED: 4.0,              // ~4 px/frame subindo (ref.)
    WIDTH: 1,                // Largura do projétil básico
    HEIGHT: 4,               // Altura do projétil básico
    MAX_NORMAL: 1,           // Apenas UM tiro simultâneo por padrão (ref.)
    BURST_Y_TOP: 28          // Posição Y onde o tiro se dissipa no teto
  },

  // --- Sistema de Parry (Cuphead Style) ---
  PARRY: {
    WINDOW_MS: 180,          // Janela de antecipação do parry (180ms ≈ 11 frames)
    RING_RADIUS: 10.5,       // Raio do anel de parry (~3.5x o hitbox do jogador)
    IFRAMES_MS: 300,         // Duração da invencibilidade após parry bem-sucedido (300ms = 18 frames)
    SCORE_BONUS: 50,         // Pontos de bônus por parry bem-sucedido
    COLOR: '#ff2fd0',        // Magenta pulsante exclusivo para elementos parryable
    PARRYABLE_BY_TYPE: {
      linear: true,
      zigzag: true,
      fan: true,
      wall: true,
      spiral: true,
      burst: true,
      boss_shot: true,
      boss_beam: false       // O raio vertical do chefe NÃO é parryable
    }
  },

  // --- Bullet Hell & Safe Lanes ---
  BULLET_HELL: {
    SAFE_LANE_MIN_WIDTH: 19, // Largura mínima do corredor seguro (sprite 13px + 6px)
    BASE_SPEED: 1.25,        // Velocidade base dos projéteis inimigos
    MAX_ENEMY_BULLETS: function(wave) {
      return Math.min(60, 12 + wave * 4);
    }
  },

  // --- Tabela de Tiers de Qualidade (Compartilhada entre Itens e Especiais) ---
  TIER_TABLE: [
    { tier: 0, name: 'Comum',    weight: 0.40, mult: 1.0, color: '#9aa0a6' },
    { tier: 1, name: 'Incomum',  weight: 0.27, mult: 1.3, color: '#33d17a' },
    { tier: 2, name: 'Raro',     weight: 0.18, mult: 1.6, color: '#3fa9ff' },
    { tier: 3, name: 'Épico',    weight: 0.10, mult: 2.0, color: '#b46bff' },
    { tier: 4, name: 'Lendário', weight: 0.05, mult: 2.5, color: '#ffd23f' }
  ],

  // --- Sistema de Itens Comuns ---
  ITEMS: {
    ITEM_DROP_INTERVAL: 20,  // Drop determinístico nos abates múltiplos de 20
    BASE_DURATION_SEC: 6,    // Duração base de 6s, multiplicada pelo tier
    MAX_ACTIVE: 2,           // Até 2 slots de itens ativos simultaneamente
    FALL_SPEED: 0.75,        // Cápsula desce reta e devagar
    WIDTH: 8,
    HEIGHT: 8,
    TYPES: {
      PIERCE: 'pierce',
      RAPID: 'rapid',
      TRIPLE: 'triple'
    },
    RAPID_MAX_SHOTS: [4, 4, 5, 6, 7],      // Tiros simultâneos por tier (0 a 4)
    RAPID_COOLDOWN_FRAMES: 12,             // Intervalo fixo entre tiros
    TRIPLE_PROJECTILES: [3, 3, 3, 5, 7],   // Quantidade de tiros no leque por tier
    TRIPLE_MAX_SPREAD_DEG: 36,             // Leque de até ±36° no Tier 4
    PIERCE_BOSS_EXTRA_DMG: [0, 0, 0, 1, 2] // Dano extra por acerto no chefe por tier
  },

  // --- Sistema de Especiais Recarregáveis ---
  SPECIALS: {
    SPECIAL_DROP_INTERVAL: 70,             // Drop determinístico nos abates múltiplos de 70
    CHARGE_REQUIRED_BY_TIER: [15, 19, 23, 27, 31], // Carga necessária (15 + tier * 4)
    TYPES: {
      LASER: 'laser',
      BOMB: 'bomb'
    },
    CHARGE_VALUES: {
      COMMON_KILL: 1,
      REINFORCEMENT_KILL: 1,
      UFO_KILL: 3,
      PARRY_SUCCESS: 1
    },
    LASER: {
      CONVERGE_FRAMES: 21,                 // 0.35s de convergência dos feixes
      DURATION_SEC: function(mult) {
        return Math.min(2.0 * mult, 4.0);
      },
      BEAM_WIDTH: 39,                      // ~3x a largura do canhão
      TICK_DAMAGE_INTERVAL: 6,             // Dano a cada 6 frames
      DAMAGE_PER_TICK: function(mult) {
        return Math.round(2 * mult);
      },
      PLAYER_SPEED_FACTOR: 0.5             // Jogador se move a 50% durante o feixe
    },
    BOMB: {
      BOSS_DAMAGE: function(mult) {
        return Math.round(5 * mult);
      },
      IFRAMES_SEC: function(mult) {
        return Math.min(1.0 * mult, 2.5);
      }
    }
  },

  // --- Chefe Final (Gatilho em 67.000 pontos) ---
  BOSS: {
    SCORE_CAP: 67000,                      // Gatilho exato e teto do placar
    MAX_HP: 150,                           // 150 pontos de vida
    WIDTH: 48,                             // Largura lógica
    HEIGHT: 24,                            // Altura lógica
    Y_FIGHT: 44,                           // Linha Y de combate
    INTRO_FREEZE_FRAMES: 30,               // 0.5s de congelamento inicial
    WARNING_FRAMES: 120,                   // 2.0s de aviso WARNING
    DESCEND_FRAMES: 120,                   // 2.0s de descida
    INVULNERABLE_FRAMES: 120,              // 2.0s de invulnerabilidade ao surgir
    PLAYER_RESPAWN_INVULN_FRAMES: 120,    // 2.0s de invulnerabilidade ao renascer na luta
    DEATH_EXPLOSION_FRAMES: 180,           // 3.0s de explosões ao morrer
    PHASES: {
      PHASE_1: { hpThreshold: 1.00, speed: 0.8, color: '#33d17a' },
      PHASE_2: { hpThreshold: 0.66, speed: 1.3, color: '#ffd23f' },
      PHASE_3: { hpThreshold: 0.33, speed: 1.8, color: '#ff3344' }
    },
    REINFORCEMENTS: {
      INTERVAL_FRAMES: 12 * 60,            // A cada ~12s
      SPAWN_COUNT: 7,                      // 6 a 8 mini-invasores
      MAX_ALIVE: 10                        // Teto de 10 vivos simultâneos
    }
  },

  // --- Formação de Invasores (Arcade Original) ---
  FORMATION: {
    ROWS: 5,                               // 5 linhas
    COLS: 11,                              // 11 colunas = 55 invasores
    TOTAL_INVADERS: 55,
    SPACING_X: 16,                         // Espaçamento horizontal
    SPACING_Y: 16,                         // Espaçamento vertical
    STEP_X: 2,                             // Passo de 2 px por movimento
    STEP_Y: 8,                             // Descida de 8 px ao tocar a borda
    MARGIN_LEFT: 8,                        // Margem esquerda
    MARGIN_RIGHT: 208,                     // Margem direita
    START_X: 24,                           // X da primeira coluna na onda 1
    WAVE_START_Y_CYCLE: [64, 72, 80, 88, 96, 104, 112, 120], // Ciclo de 8 posições
    POINTS: {
      ROW_TOP: 30,                         // Invasor pequeno = 30 pts
      ROW_MID: 20,                         // Invasor médio = 20 pts
      ROW_BOT: 10                          // Invasor grande = 10 pts
    },
    EXPLOSION_FRAMES: 15                   // Tempo do sprite de explosão
  },

  // --- Bunkers (4 Abrigos com corrosão por pixel) ---
  BUNKERS: {
    COUNT: 4,
    WIDTH: 22,
    HEIGHT: 16,
    Y: 192,
    X_POSITIONS: [32, 76, 120, 164],
    EROSION_RADIUS_PLAYER: 3,
    EROSION_RADIUS_ENEMY: 3,
    EROSION_RADIUS_INVADER: 4
  },

  // --- UFO (Nave Mistério) ---
  UFO: {
    SPAWN_INTERVAL_FRAMES: 25 * 60,        // A cada ~25s
    MIN_INVADERS_ALIVE: 8,                 // Apenas com >= 8 invasores vivos
    Y: 42,
    WIDTH: 16,
    HEIGHT: 8,
    SPEED: 1.0,
    POINTS_TABLE: [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100, 50],
    SCORE_DISPLAY_FRAMES: 45
  },

  // --- Textos e Mensagens Oficiais ---
  STRINGS: {
    GAME_TITLE: "INVASORES",
    SCORE_HEADER: "SCORE",
    HI_SCORE_HEADER: "HI-SCORE",
    WAVE_HEADER: "ONDA",
    PUSH_ENTER: "PRESS ENTER TO START",
    PAUSED: "PAUSADO",
    GAME_OVER: "GAME OVER",
    VICTORY: "MISSÃO CUMPRIDA!",
    WARNING: "WARNING! ALERTA DE CHEFE!",
    BOSS_HP: "BOSS HP",
    POINTS_TABLE_TITLE: "* TABELA DE PONTOS *",
    POINTS_UFO: "=?  NAVE MISTÉRIO",
    POINTS_SMALL: "=30 PONTOS",
    POINTS_MEDIUM: "=20 PONTOS",
    POINTS_LARGE: "=10 PONTOS",
    CREDITS: "1 JOGADOR - ARCADE V2",
    PARRY_TEXT: "PARRY!",

    // Nomes e descrições exatas dos Itens Comuns
    PIERCE_NAME: "Tiro Perfurante",
    PIERCE_DESC: "Seus tiros atravessam inimigos sem serem destruídos.",
    RAPID_NAME: "Cadência Acelerada",
    RAPID_DESC: "Dispare mais rápido e mantenha vários tiros na tela ao mesmo tempo.",
    TRIPLE_NAME: "Tiro Triplo",
    TRIPLE_DESC: "Cada disparo sai em leque, cobrindo uma área maior.",

    // Nomes e descrições exatas dos Especiais
    LASER_NAME: "Laser Convergente",
    LASER_DESC: "Converge três feixes em um raio que varre a tela de cima a baixo.",
    BOMB_NAME: "Bomba Estelar",
    BOMB_DESC: "Limpa todos os tiros inimigos da tela e concede invencibilidade breve."
  }
};
