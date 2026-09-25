/**
 * js/game.js - Máquina de estados principal, loop em passo fixo de 60 Hz com acumulador,
 * contador global de abates (drops determinísticos nos abates 20 e 70), integração de parry,
 * bullet hell Touhou, HUD Gradius III, overlays e modo diagnóstico com ?debug=1.
 * Namespace global: window.SI.Game
 */

window.SI = window.SI || {};

window.SI.Game = (function() {
  const VIDEO_CFG = SI.CONFIG.VIDEO;
  const LOOP_CFG = SI.CONFIG.LOOP;
  const STRINGS = SI.CONFIG.STRINGS;

  const STATES = {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PLAYER_DYING: 'PLAYER_DYING',
    WAVE_CLEAR: 'WAVE_CLEAR',
    BOSS_INTRO: 'BOSS_INTRO',
    BOSS_FIGHT: 'BOSS_FIGHT',
    BOSS_DEATH: 'BOSS_DEATH',
    VICTORY: 'VICTORY',
    GAME_OVER: 'GAME_OVER'
  };

  let _canvas = null;
  let _ctx = null;
  let _state = STATES.LOADING;
  let _isPaused = false;

  // Temporizadores do Loop Fixo
  let _lastTime = 0;
  let _accumulator = 0;
  let _frameCount = 0;
  let _fps = 60;
  let _fpsTimer = 0;

  // Entidades
  let _player = null;
  let _formation = null;
  let _shots = null;
  let _bunkers = null;
  let _ufo = null;
  let _items = null;
  let _specials = null;
  let _boss = null;
  let _particles = null;

  // Interface Visual (Gradius III Style)
  let _hud = null;
  let _toast = null;
  let _controlsPanel = null;

  // Placar e Progresso
  let _score = 0;
  let _hiScore = 0;
  let _wave = 1;
  let _playerShotCountInWave = 0;
  let _extraLifeAwarded = false;
  let _bossTriggered = false;

  // CONTADOR GLOBAL DE ABATES (Invasores comuns + UFO + reforços do chefe, NÃO o chefe)
  // Substitui a regra antiga: drops determinísticos nos múltiplos de 20 e 70
  let _globalKillCount = 0;

  // Forçamento do próximo drop via modo debug (?debug=1)
  let _forceNextCommonItem = false;
  let _forceNextSpecial = false;

  // Temporizadores de transição
  let _stateTimer = 0;
  let _introPhase = 0;

  // Estrelas de fundo dinâmicas (Starfield sutil)
  let _stars = [];

  // Modo diagnóstico
  let _debug = false;

  function init(canvasElement) {
    _canvas = canvasElement;
    _ctx = _canvas.getContext('2d');

    _canvas.width = VIDEO_CFG.LOGICAL_WIDTH * VIDEO_CFG.RENDER_SCALE;
    _canvas.height = VIDEO_CFG.LOGICAL_HEIGHT * VIDEO_CFG.RENDER_SCALE;
    _ctx.imageSmoothingEnabled = !VIDEO_CFG.PIXEL_ART;

    _hiScore = SI.Util.getStoredHiScore();

    // Inicialização das Entidades
    _player = new SI.Player();
    _formation = new SI.Formation();
    _shots = new SI.Shots();
    _bunkers = new SI.Bunkers();
    _ufo = new SI.UFO();
    _items = new SI.Items();
    _specials = new SI.Specials();
    _boss = new SI.Boss();
    _particles = new SI.Util.ParticleSystem(150);

    // Inicialização da UI
    _hud = new SI.HUD();
    _toast = new SI.Toast();
    _controlsPanel = new SI.ControlsPanel();

    initStarfield();

    // Leitura segura de URL (?debug=1 e ?seed=N)
    const urlParams = SI.Util.getUrlParams();
    _debug = urlParams.debug;
    if (urlParams.seed !== null) {
      SI.Util.setSeed(urlParams.seed);
    }

    // Auto-pausa ao perder foco da janela ou aba
    window.addEventListener('blur', () => {
      if (_state === STATES.PLAYING || _state === STATES.BOSS_FIGHT) {
        _isPaused = true;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (_state === STATES.PLAYING || _state === STATES.BOSS_FIGHT)) {
        _isPaused = true;
      }
    });

    // Inicia carregamento seguro de assets
    SI.Assets.init(() => {
      _state = STATES.TITLE;
    });

    _lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }

  function initStarfield() {
    _stars = [];
    for (let i = 0; i < 40; i++) {
      _stars.push({
        x: SI.Util.random() * VIDEO_CFG.LOGICAL_WIDTH,
        y: SI.Util.random() * (VIDEO_CFG.LOGICAL_HEIGHT - 24),
        speed: 0.15 + SI.Util.random() * 0.35,
        size: SI.Util.random() < 0.3 ? 1.5 : 1,
        alpha: 0.2 + SI.Util.random() * 0.6
      });
    }
  }

  function updateStarfield() {
    for (let i = 0; i < _stars.length; i++) {
      const s = _stars[i];
      s.y += s.speed;
      if (s.y > VIDEO_CFG.LOGICAL_HEIGHT - 24) {
        s.y = 0;
        s.x = SI.Util.random() * VIDEO_CFG.LOGICAL_WIDTH;
      }
    }
  }

  // --- Loop de Jogo com Passo Fixo de 60 Hz ---
  function gameLoop(currentTime) {
    let delta = currentTime - _lastTime;
    _lastTime = currentTime;

    if (delta > 250) delta = 250;

    _fpsTimer += delta;
    _frameCount++;
    if (_fpsTimer >= 1000) {
      _fps = _frameCount;
      _frameCount = 0;
      _fpsTimer = 0;
    }

    _accumulator += delta;
    while (_accumulator >= LOOP_CFG.TIMESTEP) {
      fixedUpdate();
      _accumulator -= LOOP_CFG.TIMESTEP;
      SI.Input.clearFrame();
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  // --- Atualização Lógica em Passo Fixo ---
  function fixedUpdate() {
    // 1. Tecla F1: Abre/Fecha Painel de Comandos
    if (SI.Input.isActionJustPressed('commands')) {
      const isOpen = _controlsPanel.toggle();
      if (isOpen && (_state === STATES.PLAYING || _state === STATES.BOSS_FIGHT)) {
        _isPaused = true;
      }
    }

    // Se o painel de comandos estiver aberto, atualiza-o e ignora comandos do jogo
    if (_controlsPanel.isOpen()) {
      _controlsPanel.update();
      return;
    }

    // 2. Tecla Pause (P ou Esc)
    if (SI.Input.isActionJustPressed('pause')) {
      if (_state === STATES.PLAYING || _state === STATES.BOSS_FIGHT) {
        _isPaused = !_isPaused;
      }
    }

    // 3. Tecla Mute (M)
    if (SI.Input.isActionJustPressed('mute')) {
      SI.Audio.toggleMute();
    }

    if (_isPaused) return;

    // 4. Atalhos de Depuração (?debug=1)
    if (_debug) {
      handleDebugHotkeys();
    }

    // 5. Máquina de Estados Principal
    switch (_state) {
      case STATES.TITLE:
        updateTitle();
        break;
      case STATES.PLAYING:
        updatePlaying();
        break;
      case STATES.PLAYER_DYING:
        updatePlayerDying();
        break;
      case STATES.WAVE_CLEAR:
        updateWaveClear();
        break;
      case STATES.BOSS_INTRO:
        updateBossIntro();
        break;
      case STATES.BOSS_FIGHT:
        updateBossFight();
        break;
      case STATES.BOSS_DEATH:
        updateBossDeath();
        break;
      case STATES.VICTORY:
      case STATES.GAME_OVER:
        updateEndScreens();
        break;
    }

    _particles.update();
    _toast.update();
    updateStarfield();
  }

  function handleDebugHotkeys() {
    const DBG = SI.CONFIG.DEBUG_KEYS;
    if (SI.Input.isCodeJustPressed(DBG.itemForce)) {
      _forceNextCommonItem = true;
      console.log('[DEBUG] Próximo abate soltará Item Comum forçado.');
    }
    if (SI.Input.isCodeJustPressed(DBG.specialForce)) {
      _forceNextSpecial = true;
      console.log('[DEBUG] Próximo abate soltará Especial forçado.');
    }
    if (SI.Input.isCodeJustPressed(DBG.killAll)) {
      _formation.killAll();
    }
    if (SI.Input.isCodeJustPressed(DBG.bossJump)) {
      addScore(SI.CONFIG.BOSS.SCORE_CAP - _score);
    }
  }

  // --- Estado: TITLE ---
  function updateTitle() {
    if (SI.Input.isActionJustPressed('confirm') || SI.Input.isActionDown('fire')) {
      startNewGame();
    }
  }

  function startNewGame() {
    _score = 0;
    _wave = 1;
    _playerShotCountInWave = 0;
    _extraLifeAwarded = false;
    _bossTriggered = false;
    _globalKillCount = 0;
    _forceNextCommonItem = false;
    _forceNextSpecial = false;

    _player.reset();
    _formation.initWave(1);
    _bunkers.reset();
    _shots.reset();
    _ufo.reset();
    _items.reset();
    _specials.reset();
    _boss.reset();
    _particles.clear();
    _toast.reset();

    _state = STATES.PLAYING;
  }

  // --- Estado: PLAYING ---
  function updatePlaying() {
    const isLaserFiring = _specials.isLaserFiring();

    // 1. Atualização do Canhão do Jogador
    _player.update(isLaserFiring);

    // 2. Ação de Parry (Tecla C)
    if (SI.Input.isActionJustPressed('parry')) {
      _player.attemptParry(_shots, _boss, addScore);
    }

    // 3. Disparo do Canhão (Espaço)
    if (!isLaserFiring && SI.Input.isActionDown('fire')) {
      const activeCount = _shots.getEffectivePlayerShotCount();
      if (_player.canShoot(activeCount)) {
        const isPierce = !!_player.activeItems[SI.CONFIG.ITEMS.TYPES.PIERCE];
        const tripleItem = _player.activeItems[SI.CONFIG.ITEMS.TYPES.TRIPLE] || null;
        const pierceItem = _player.activeItems[SI.CONFIG.ITEMS.TYPES.PIERCE] || null;

        _shots.spawnPlayerShot(_player.x, _player.y, isPierce, tripleItem, pierceItem);
        _player.registerShotFired();
        _playerShotCountInWave++;
      }
    }

    // 4. Ativação do Especial (Tecla X)
    if (!isLaserFiring && SI.Input.isActionJustPressed('special')) {
      _specials.activateSpecial(_player, _formation, _ufo, _shots, _boss, _particles, addScore);
    }

    // 5. Atualização do Especial (Laser/Bomba)
    _specials.update(_player, _formation, _ufo, _shots, _boss, _particles);

    // 6. Atualização da Formação de Invasores (1 por frame, aceleração emergente)
    _formation.update(_bunkers);

    // 7. Atualização do Bullet Hell Inimigo
    if (SI.CONFIG.FEATURES.bulletHell) {
      _shots.updateEnemyFiring(_wave, _formation, _player.x);
    }
    _shots.update(_particles);

    // 8. Atualização do UFO
    _ufo.update(_formation.getLivingCount());

    // 9. Atualização das Cápsulas em Queda e Coleta
    _items.update();
    _items.checkPlayerCollection(_player, _toast);

    _specials.update(_player, _formation, _ufo, _shots, _boss, _particles);
    _specials.checkPlayerCollection(_player, _toast);

    // 10. Processamento de Colisões
    handlePlayingCollisions();

    // 11. Invasor toca linha do canhão = Game Over imediato (mesmo com vidas)
    if (_formation.hasReachedCannonLine(SI.CONFIG.PLAYER.CANNON_Y)) {
      _player.hit();
      _state = STATES.GAME_OVER;
      _stateTimer = 180;
      return;
    }

    // 12. Onda concluída
    if (_formation.getLivingCount() === 0) {
      _state = STATES.WAVE_CLEAR;
      _stateTimer = 90;
    }
  }

  // --- Processamento de Colisões no Estado PLAYING ---
  function handlePlayingCollisions() {
    const pShots = _shots.playerShots;
    const eShots = _shots.enemyShots;

    // Colisão com os abrigos
    _bunkers.checkPlayerShots(pShots, _particles);
    _bunkers.checkEnemyShots(eShots, _particles);

    // Colisão dos tiros do jogador com invasores comuns
    for (let i = pShots.length - 1; i >= 0; i--) {
      const s = pShots[i];
      for (let j = _formation.livingInvaders.length - 1; j >= 0; j--) {
        const inv = _formation.livingInvaders[j];
        if (SI.Util.checkAABB(s, inv)) {
          if (!s.isPierce || !s.hitIds.has(inv)) {
            if (s.isPierce) s.hitIds.add(inv);

            _formation.killInvader(inv);
            addScore(inv.points);

            // REGRA: Abate alimenta o contador global e recarrega Especial
            registerKill(inv.x + inv.width / 2, inv.y + inv.height, SI.CONFIG.SPECIALS.CHARGE_VALUES.COMMON_KILL);

            if (!s.isPierce) {
              pShots.splice(i, 1);
              _shots.playerShotPool.release(s);
              break;
            }
          }
        }
      }
    }

    // Colisão dos tiros do jogador com o UFO
    if (_ufo.active) {
      for (let i = pShots.length - 1; i >= 0; i--) {
        const s = pShots[i];
        if (SI.Util.checkAABB(s, _ufo)) {
          const pts = _ufo.hit(_playerShotCountInWave);
          addScore(pts);

          // UFO SEMPRE solta um item comum ALÉM de contar no contador global
          _items.dropFromUFO(_ufo.pointsX + _ufo.width / 2, _ufo.pointsY + _ufo.height);
          registerKill(_ufo.pointsX + _ufo.width / 2, _ufo.pointsY + _ufo.height, SI.CONFIG.SPECIALS.CHARGE_VALUES.UFO_KILL);

          if (!s.isPierce) {
            pShots.splice(i, 1);
            _shots.playerShotPool.release(s);
          }
          break;
        }
      }
    }

    // Colisão dos tiros inimigos com o hitbox circular reduzido (3px) do canhão
    const playerHitbox = _player.getHitboxCircle();
    for (let i = eShots.length - 1; i >= 0; i--) {
      const s = eShots[i];
      if (SI.Util.checkCircleBox(playerHitbox, s)) {
        eShots.splice(i, 1);
        _shots.enemyShotPool.release(s);

        if (_player.hit()) {
          _specials.stopLaser();
          _state = STATES.PLAYER_DYING;
          _stateTimer = SI.CONFIG.PLAYER.RESPAWN_DELAY_FRAMES;
          break;
        }
      }
    }
  }

  // --- Registro do Contador Global de Abates e Drops Determinísticos ---
  function registerKill(x, y, specialChargeUnits = 1) {
    _globalKillCount++;

    // 1. Recarrega o Especial equipado
    _player.addSpecialCharge(specialChargeUnits);

    // 2. Drop Determinístico de Item Comum a cada 20 abates
    const isCommonDrop = (_globalKillCount % SI.CONFIG.ITEMS.ITEM_DROP_INTERVAL === 0) || _forceNextCommonItem;
    if (isCommonDrop) {
      _items.spawnDrop(x, y);
      _forceNextCommonItem = false;
    }

    // 3. Drop Determinístico de Especial a cada 70 abates
    // Se coincidir (ex: abate 140), ambos acontecem juntos sem conflito!
    const isSpecialDrop = (_globalKillCount % SI.CONFIG.SPECIALS.SPECIAL_DROP_INTERVAL === 0) || _forceNextSpecial;
    if (isSpecialDrop) {
      _specials.spawnDrop(x, y);
      _forceNextSpecial = false;
    }
  }

  // --- Estado: PLAYER_DYING ---
  function updatePlayerDying() {
    _player.update(false);
    _stateTimer--;
    if (_stateTimer <= 0) {
      if (_player.lives > 0) {
        _player.respawn(_boss.active);
        _state = _boss.active ? STATES.BOSS_FIGHT : STATES.PLAYING;
      } else {
        _state = STATES.GAME_OVER;
        _stateTimer = 180;
      }
    }
  }

  // --- Estado: WAVE_CLEAR ---
  function updateWaveClear() {
    _stateTimer--;
    if (_stateTimer <= 0) {
      _wave++;
      _playerShotCountInWave = 0;
      _formation.initWave(_wave);
      _bunkers.reset(); // Bunkers restaurados a cada nova onda
      _shots.reset();
      _state = STATES.PLAYING;
    }
  }

  // --- Transição para o Chefe Final aos 67.000 pontos ---
  function triggerBossSequence() {
    _bossTriggered = true;
    _state = STATES.BOSS_INTRO;
    _introPhase = 0;
    _stateTimer = SI.CONFIG.BOSS.INTRO_FREEZE_FRAMES;
    _specials.stopLaser();
  }

  function updateBossIntro() {
    _stateTimer--;
    if (_stateTimer <= 0) {
      if (_introPhase === 0) {
        // Congela e destrói entidades remanescentes sem conceder pontos adicionais
        _introPhase = 1;
        _stateTimer = 30;
        _formation.killAll();
        _ufo.reset();
        _shots.reset();
        _bunkers.reset(); // Bunkers restaurados para o combate final
        SI.Audio.playPlayerExplosion();
      } else if (_introPhase === 1) {
        // Alerta WARNING! por 2.0s
        _introPhase = 2;
        _stateTimer = SI.CONFIG.BOSS.WARNING_FRAMES;
        SI.Audio.playBossWarning();
      } else if (_introPhase === 2) {
        // Chefe surge descendo do topo
        _introPhase = 3;
        _state = STATES.BOSS_FIGHT;
        _boss.startIntro();
      }
    }
  }

  // --- Estado: BOSS_FIGHT ---
  function updateBossFight() {
    const isLaserFiring = _specials.isLaserFiring();
    _player.update(isLaserFiring);

    if (SI.Input.isActionJustPressed('parry')) {
      _player.attemptParry(_shots, _boss, addScore);
    }

    if (!isLaserFiring && SI.Input.isActionDown('fire')) {
      const activeCount = _shots.getEffectivePlayerShotCount();
      if (_player.canShoot(activeCount)) {
        const isPierce = !!_player.activeItems[SI.CONFIG.ITEMS.TYPES.PIERCE];
        const tripleItem = _player.activeItems[SI.CONFIG.ITEMS.TYPES.TRIPLE] || null;
        const pierceItem = _player.activeItems[SI.CONFIG.ITEMS.TYPES.PIERCE] || null;

        _shots.spawnPlayerShot(_player.x, _player.y, isPierce, tripleItem, pierceItem);
        _player.registerShotFired();
      }
    }

    if (!isLaserFiring && SI.Input.isActionJustPressed('special')) {
      _specials.activateSpecial(_player, _formation, _ufo, _shots, _boss, _particles, addScore);
    }

    _specials.update(_player, null, null, _shots, _boss, _particles);
    _boss.update(_player.x, _player.y, _bunkers, _particles);
    _shots.update(_particles);

    _items.update();
    _items.checkPlayerCollection(_player, _toast);
    _specials.checkPlayerCollection(_player, _toast);

    handleBossCollisions();

    // Derrota do chefe
    if (_boss.defeated && _boss.deathTimer >= SI.CONFIG.BOSS.DEATH_EXPLOSION_FRAMES) {
      _state = STATES.VICTORY;
      _stateTimer = 180;
    }
  }

  function handleBossCollisions() {
    const pShots = _shots.playerShots;

    _bunkers.checkPlayerShots(pShots, _particles);

    // Tiros do jogador contra o corpo do chefe e mini-invasores
    for (let i = pShots.length - 1; i >= 0; i--) {
      const s = pShots[i];
      const hitResult = _boss.checkHitByPlayerShot(s, _particles);

      if (hitResult === 'reinforcement') {
        // Abate de reforço do chefe alimenta o MESMO contador global
        registerKill(s.x, s.y, SI.CONFIG.SPECIALS.CHARGE_VALUES.REINFORCEMENT_KILL);
        if (!s.isPierce) {
          pShots.splice(i, 1);
          _shots.playerShotPool.release(s);
        }
      } else if (hitResult === true) {
        // Acerto no corpo do chefe
        pShots.splice(i, 1);
        _shots.playerShotPool.release(s);
      }
    }

    // Projéteis do chefe contra abrigos
    for (let i = _boss.bossShots.length - 1; i >= 0; i--) {
      const bs = _boss.bossShots[i];
      for (const b of _bunkers.bunkers) {
        if (b.checkShotCollision(bs, 3)) {
          _particles.emit(bs.x, bs.y, 4, '#ff2fd0', 1.0, 10, 1);
          _boss.bossShots.splice(i, 1);
          break;
        }
      }
    }

    // Projéteis do chefe contra o hitbox reduzido do jogador
    const playerHitbox = _player.getHitboxCircle();
    for (let i = _boss.bossShots.length - 1; i >= 0; i--) {
      const bs = _boss.bossShots[i];
      if (SI.Util.checkCircleBox(playerHitbox, bs)) {
        _boss.bossShots.splice(i, 1);
        if (_player.hit()) {
          _specials.stopLaser();
          _state = STATES.PLAYER_DYING;
          _stateTimer = SI.CONFIG.PLAYER.RESPAWN_DELAY_FRAMES;
          break;
        }
      }
    }

    // Raio Vertical Fatal (Ataque C - Não-parryable)
    if (_boss.currentAttack === 'beam' && _boss.attackPhase === 'execute' && _boss.telegraphData) {
      const bW = _boss.telegraphData.beamWidth;
      const b1 = { x: _boss.telegraphData.col1 - bW / 2, y: 0, width: bW, height: SI.CONFIG.PLAYER.GROUND_Y };
      if (SI.Util.checkAABB(b1, _player)) {
        if (_player.hit()) {
          _specials.stopLaser();
          _state = STATES.PLAYER_DYING;
          _stateTimer = SI.CONFIG.PLAYER.RESPAWN_DELAY_FRAMES;
          return;
        }
      }
      if (_boss.telegraphData.col2 !== null) {
        const b2 = { x: _boss.telegraphData.col2 - bW / 2, y: 0, width: bW, height: SI.CONFIG.PLAYER.GROUND_Y };
        if (SI.Util.checkAABB(b2, _player)) {
          if (_player.hit()) {
            _specials.stopLaser();
            _state = STATES.PLAYER_DYING;
            _stateTimer = SI.CONFIG.PLAYER.RESPAWN_DELAY_FRAMES;
          }
        }
      }
    }

    // Mini-invasores alcançando a linha do canhão tiram 1 vida
    for (let i = _boss.miniInvaders.length - 1; i >= 0; i--) {
      const m = _boss.miniInvaders[i];
      if (m.alive && m.y + m.height >= SI.CONFIG.PLAYER.CANNON_Y) {
        m.alive = false;
        m.explodingTimer = 12;
        _particles.emit(m.x + m.width / 2, m.y + m.height / 2, 8, '#ff2fd0', 2.0, 15, 1);
        if (_player.hit()) {
          _specials.stopLaser();
          _state = STATES.PLAYER_DYING;
          _stateTimer = SI.CONFIG.PLAYER.RESPAWN_DELAY_FRAMES;
          break;
        }
      }
    }
  }

  function updateBossDeath() {
    _boss.update(_player.x, _player.y, _bunkers, _particles);
  }

  function updateEndScreens() {
    if (SI.Input.isActionJustPressed('confirm') || SI.Input.isActionDown('fire')) {
      _state = STATES.TITLE;
    }
  }

  // --- Atualização de Pontos com Teto Rígido (SCORE_CAP = 67.000) ---
  function addScore(points) {
    if (points <= 0) return;

    _score += points;

    if (!_extraLifeAwarded && _score >= SI.CONFIG.PLAYER.EXTRA_LIFE_SCORE) {
      _extraLifeAwarded = true;
      _player.lives++;
      SI.Audio.playItemCollect();
    }

    if (_score >= SI.CONFIG.BOSS.SCORE_CAP) {
      _score = SI.CONFIG.BOSS.SCORE_CAP;
      if (SI.CONFIG.FEATURES.boss && !_bossTriggered) {
        triggerBossSequence();
      }
    }

    if (_score > _hiScore) {
      _hiScore = _score;
      SI.Util.setStoredHiScore(_hiScore);
    }
  }

  // --- Renderização Completa (224 x 256 escalada) ---
  function render() {
    const ctx = _ctx;
    ctx.save();
    ctx.scale(VIDEO_CFG.RENDER_SCALE, VIDEO_CFG.RENDER_SCALE);

    // Efeito de tremor de tela (screen shake do laser)
    if (_specials.screenShake !== 0) {
      ctx.translate(0, _specials.screenShake);
    }

    // Fundo escuro com gradiente radial e starfield
    ctx.fillStyle = '#05030f';
    ctx.fillRect(0, 0, VIDEO_CFG.LOGICAL_WIDTH, VIDEO_CFG.LOGICAL_HEIGHT);

    renderStarfield(ctx);

    if (_state === STATES.TITLE) {
      renderTitle(ctx);
    } else {
      renderGamePlay(ctx);
    }

    // Toasts de coleta
    _toast.render(ctx);

    // Overlay de Pausa
    if (_isPaused && !_controlsPanel.isOpen()) {
      renderPauseOverlay(ctx);
    }

    // Painel de Comandos (F1)
    if (_controlsPanel.isOpen()) {
      _controlsPanel.render(ctx);
    }

    // Modo Diagnóstico (?debug=1)
    if (_debug) {
      renderDebugInfo(ctx);
    }

    ctx.restore();
  }

  function renderStarfield(ctx) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < _stars.length; i++) {
      const s = _stars[i];
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1.0;
  }

  function renderTitle(ctx) {
    // Cabeçalho clássico de título
    ctx.fillStyle = '#22e6ff';
    ctx.font = '10px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.GAME_TITLE, 112, 45);

    ctx.fillStyle = '#ffd23f';
    ctx.font = '5px "Courier New", ui-monospace, monospace';
    ctx.fillText('EDICAO TOUHOU + GRADIUS III HUD', 112, 58);

    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "Courier New", ui-monospace, monospace';
    ctx.fillText(STRINGS.POINTS_TABLE_TITLE, 112, 80);

    SI.Assets.draw(ctx, 'ufo', 68, 92, 0, 16, 8);
    ctx.textAlign = 'left';
    ctx.fillText(STRINGS.POINTS_UFO, 92, 98);

    SI.Assets.draw(ctx, 'invader_small', 72, 108, 0, 8, 8);
    ctx.fillText(STRINGS.POINTS_SMALL, 92, 114);

    SI.Assets.draw(ctx, 'invader_medium', 70, 124, 0, 11, 8);
    ctx.fillText(STRINGS.POINTS_MEDIUM, 92, 130);

    SI.Assets.draw(ctx, 'invader_large', 70, 140, 0, 12, 8);
    ctx.fillText(STRINGS.POINTS_LARGE, 92, 146);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '5px "Courier New", ui-monospace, monospace';
    ctx.fillText('[F1] PAINEL DE COMANDOS', 112, 175);

    ctx.fillStyle = '#22e6ff';
    ctx.fillText(STRINGS.CREDITS, 112, 190);

    if (Math.floor(Date.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#33d17a';
      ctx.fillText(STRINGS.PUSH_ENTER, 112, 215);
    }
  }

  function renderGamePlay(ctx) {
    _bunkers.render(ctx);

    if (_state === STATES.BOSS_FIGHT || _state === STATES.BOSS_DEATH) {
      _boss.render(ctx);
    } else {
      _formation.render(ctx);
    }

    _ufo.render(ctx);
    _shots.render(ctx);
    _items.render(ctx);
    _specials.render(ctx, _player.x, _player.y);
    _player.render(ctx);
    _particles.render(ctx);

    // Linha do chão arcade
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, SI.CONFIG.PLAYER.GROUND_Y, VIDEO_CFG.LOGICAL_WIDTH, 1);

    // Renderiza HUD de Gradius III
    _hud.render(ctx, {
      player: _player,
      score: _score,
      hiScore: _hiScore,
      wave: _wave,
      boss: _boss,
      state: _state
    });

    // Alertas e Telas Finais
    if (_state === STATES.BOSS_INTRO && _introPhase === 2) {
      ctx.fillStyle = (Math.floor(Date.now() / 150) % 2 === 0) ? '#ff3344' : '#ffd23f';
      ctx.font = '8px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(STRINGS.WARNING, 112, 120);
    } else if (_state === STATES.VICTORY) {
      renderVictoryScreen(ctx);
    } else if (_state === STATES.GAME_OVER) {
      renderGameOverScreen(ctx);
    }
  }

  function renderPauseOverlay(ctx) {
    ctx.fillStyle = 'rgba(5, 3, 15, 0.75)';
    ctx.fillRect(0, 0, VIDEO_CFG.LOGICAL_WIDTH, VIDEO_CFG.LOGICAL_HEIGHT);

    ctx.fillStyle = '#ffd23f';
    ctx.font = '8px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.PAUSED, 112, 120);

    ctx.fillStyle = '#9aa0a6';
    ctx.font = '5px "Courier New", ui-monospace, monospace';
    ctx.fillText('[P] OU [ESC] PARA CONTINUAR', 112, 134);
    ctx.fillText('[F1] PARA COMANDOS', 112, 144);
  }

  function renderVictoryScreen(ctx) {
    ctx.fillStyle = '#33d17a';
    ctx.font = '8px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.VICTORY, 112, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "Courier New", ui-monospace, monospace';
    ctx.fillText(`PONTUACAO FINAL: ${_score}`, 112, 115);
    ctx.fillText(`HI-SCORE: ${_hiScore}`, 112, 127);
    ctx.fillText(`ABATES TOTAIS: ${_globalKillCount}`, 112, 139);

    if (Math.floor(Date.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(STRINGS.PUSH_ENTER, 112, 165);
    }
  }

  function renderGameOverScreen(ctx) {
    ctx.fillStyle = '#ff3344';
    ctx.font = '8px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STRINGS.GAME_OVER, 112, 110);

    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "Courier New", ui-monospace, monospace';
    ctx.fillText(`PONTUACAO: ${_score}`, 112, 128);

    if (Math.floor(Date.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#22e6ff';
      ctx.fillText(STRINGS.PUSH_ENTER, 112, 155);
    }
  }

  // --- Modo Diagnóstico Completo (?debug=1) ---
  function renderDebugInfo(ctx) {
    ctx.save();
    ctx.lineWidth = 0.5;

    // 1. Hitbox circular reduzido do jogador (Verde)
    const pc = _player.getHitboxCircle();
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, pc.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Anel de Parry (Magenta pulsante)
    const pr = _player.getParryRingCircle();
    ctx.strokeStyle = SI.CONFIG.PARRY.COLOR;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Tiros Inimigos
    for (const s of _shots.enemyShots) {
      ctx.strokeStyle = s.parryable ? SI.CONFIG.PARRY.COLOR : '#ff0000';
      ctx.strokeRect(s.x, s.y, s.width, s.height);
    }

    // 4. Invasores
    ctx.strokeStyle = '#ffff00';
    for (const inv of _formation.livingInvaders) {
      ctx.strokeRect(inv.x, inv.y, inv.width, inv.height);
    }

    // 5. Painel de Diagnóstico em Tempo Real
    ctx.fillStyle = 'rgba(5, 3, 15, 0.85)';
    ctx.fillRect(2, 22, 130, 48);

    ctx.fillStyle = '#33d17a';
    ctx.font = '4.5px "Courier New", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`[DEBUG] FPS:${_fps} STATE:${_state}`, 4, 28);
    ctx.fillText(`KILLS:${_globalKillCount} PROX: 20->${20 - (_globalKillCount % 20)} 70->${70 - (_globalKillCount % 70)}`, 4, 35);

    // Exibição dos event.code ativos no Set de teclas (requisito explícito)
    const activeKeysList = SI.Input.getActiveCodesList();
    const keysText = activeKeysList.length > 0 ? activeKeysList.join(',') : '(nenhuma)';
    ctx.fillStyle = '#22e6ff';
    ctx.fillText(`TECLAS:[${keysText.substring(0, 24)}]`, 4, 42);

    // Contadores de drops por tier
    const is = _items.stats;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`TIERS: C:${is.tier0} I:${is.tier1} R:${is.tier2} E:${is.tier3} L:${is.tier4}`, 4, 49);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`[I]:DROP [O]:SPEC [K]:KILL [B]:BOSS`, 4, 56);

    ctx.restore();
  }

  return {
    init,
    STATES
  };
})();
