/**
 * js/entities/player.js - Canhão do jogador, movimentação horizontal, modo foco,
 * hitbox reduzido de 3px, anel de parry e gerenciamento de itens ativos e especial.
 * Namespace global: window.SI.Player
 */

window.SI = window.SI || {};

window.SI.Player = (function() {
  const P_CFG = SI.CONFIG.PLAYER;
  const PARRY_CFG = SI.CONFIG.PARRY;

  class Player {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = P_CFG.START_X;
      this.y = P_CFG.START_Y;
      this.width = P_CFG.WIDTH;
      this.height = P_CFG.HEIGHT;
      this.lives = P_CFG.INITIAL_LIVES;
      this.alive = true;
      this.deathTimer = 0;
      this.invulnerableTimer = 0;
      this.shotCooldown = 0;

      // Hitbox circular reduzido (3px) para bullet hell
      this.hitboxRadius = P_CFG.HITBOX_RADIUS;

      // Anel de parry (10.5px)
      this.parryRingRadius = PARRY_CFG.RING_RADIUS;
      this.parryPulseTimer = 0;     // Feedback visual do parry
      this.parryCooldownTimer = 0;  // Previne spam descontrolado de parry

      // Efeito de feedback "PARRY!"
      this.parryFeedbacks = [];

      // Itens Comuns Ativos (Máximo de 2 slots simultâneos)
      // Chave -> { timer, maxDuration, tier, mult, name, desc }
      this.activeItems = {};

      // Especial Equipado e Barra de Carga
      this.equippedSpecial = {
        type: SI.CONFIG.SPECIALS.TYPES.LASER,
        tier: 0,
        mult: 1.0,
        name: SI.CONFIG.STRINGS.LASER_NAME,
        desc: SI.CONFIG.STRINGS.LASER_DESC
      };
      this.specialCharge = 0;

      // Estado de Foco
      this.isFocusing = false;
    }

    getCenterX() {
      return this.x + this.width / 2;
    }

    getCenterY() {
      return this.y + this.height / 2;
    }

    getHitboxCircle() {
      return {
        x: this.getCenterX(),
        y: this.getCenterY(),
        radius: this.hitboxRadius
      };
    }

    getParryRingCircle() {
      return {
        x: this.getCenterX(),
        y: this.getCenterY(),
        radius: this.parryRingRadius
      };
    }

    update(isLaserActive = false) {
      if (!this.alive) {
        if (this.deathTimer > 0) this.deathTimer--;
        return;
      }

      // 1. Atualização dos timers de invulnerabilidade e cooldowns
      if (this.invulnerableTimer > 0) this.invulnerableTimer--;
      if (this.shotCooldown > 0) this.shotCooldown--;
      if (this.parryPulseTimer > 0) this.parryPulseTimer--;
      if (this.parryCooldownTimer > 0) this.parryCooldownTimer--;

      // 2. Atualização dos itens comuns ativos
      for (const type in this.activeItems) {
        const item = this.activeItems[type];
        item.timer--;
        if (item.timer <= 0) {
          delete this.activeItems[type];
        }
      }

      // 3. Atualização dos textos flutuantes de feedback do parry
      for (let i = this.parryFeedbacks.length - 1; i >= 0; i--) {
        const fb = this.parryFeedbacks[i];
        fb.y -= 0.5;
        fb.alpha -= 0.03;
        if (fb.alpha <= 0) {
          this.parryFeedbacks.splice(i, 1);
        }
      }

      // 4. Modo Foco (Shift)
      this.isFocusing = SI.CONFIG.FEATURES.focusMode && SI.Input.isActionDown('focus');

      // 5. Cálculo da velocidade de deslocamento
      let currentSpeed = P_CFG.SPEED;
      if (this.isFocusing) {
        currentSpeed *= P_CFG.FOCUS_SPEED_MULT; // 2.5 * 0.4 = 1.0 px/frame
      }
      if (isLaserActive) {
        currentSpeed *= SI.CONFIG.SPECIALS.LASER.PLAYER_SPEED_FACTOR; // 50% durante laser
      }

      // 6. Movimentação Estritamente Horizontal (Arcade Space Invaders)
      if (SI.Input.isActionDown('moveLeft')) {
        this.x -= currentSpeed;
      }
      if (SI.Input.isActionDown('moveRight')) {
        this.x += currentSpeed;
      }

      // Delimitação estrita nos limites da tela lógica
      this.x = SI.Util.clamp(this.x, P_CFG.MIN_X, P_CFG.MAX_X);
    }

    // --- Mecânica de Parry ---
    attemptParry(shotsManager, boss, addScoreCallback) {
      if (!SI.CONFIG.FEATURES.parry || !this.alive || this.parryCooldownTimer > 0) return false;

      this.parryCooldownTimer = 12; // Cooldown mínimo entre tentativas de parry
      this.parryPulseTimer = 10;

      const playerCenter = { x: this.getCenterX(), y: this.getCenterY() };
      let parriedAny = false;

      // 1. Verifica tiros inimigos comuns e padrões
      if (shotsManager && shotsManager.enemyShots) {
        for (let i = shotsManager.enemyShots.length - 1; i >= 0; i--) {
          const s = shotsManager.enemyShots[i];
          if (!s.parryable) continue;

          // Centro do projétil
          const sx = s.x + s.width / 2;
          const sy = s.y + s.height / 2;
          const dist = SI.Util.distance(playerCenter.x, playerCenter.y, sx, sy);

          // Verifica se está dentro do anel ou alcançando-o na janela de tempo (180ms)
          const maxReachDist = this.parryRingRadius + (s.vy || 1.25) * 8;
          if (dist <= maxReachDist) {
            // Sucesso no Parry!
            shotsManager.enemyShots.splice(i, 1);
            shotsManager.enemyShotPool.release(s);
            this.onParrySuccess(sx, sy, addScoreCallback);
            parriedAny = true;
            break;
          }
        }
      }

      // 2. Verifica projéteis do chefe
      if (!parriedAny && boss && boss.active && boss.bossShots) {
        for (let i = boss.bossShots.length - 1; i >= 0; i--) {
          const bs = boss.bossShots[i];
          if (bs.parryable === false) continue; // Raio vertical não é parryable

          const sx = bs.x + bs.width / 2;
          const sy = bs.y + bs.height / 2;
          const dist = SI.Util.distance(playerCenter.x, playerCenter.y, sx, sy);

          if (dist <= this.parryRingRadius + 10) {
            boss.bossShots.splice(i, 1);
            this.onParrySuccess(sx, sy, addScoreCallback);
            parriedAny = true;
            break;
          }
        }
      }

      if (!parriedAny) {
        SI.Audio.playParryAttempt();
      }

      return parriedAny;
    }

    onParrySuccess(x, y, addScoreCallback) {
      // 1. Concede invencibilidade de 300ms (18 frames)
      const iframes = Math.round(PARRY_CFG.IFRAMES_MS / (1000 / 60));
      this.invulnerableTimer = Math.max(this.invulnerableTimer, iframes);

      // 2. Bônus de pontuação
      if (addScoreCallback) {
        addScoreCallback(PARRY_CFG.SCORE_BONUS);
      }

      // 3. Recarrega +1 unidade no medidor do Especial
      this.addSpecialCharge(SI.CONFIG.SPECIALS.CHARGE_VALUES.PARRY_SUCCESS);

      // 4. Som de sucesso límpido
      SI.Audio.playParrySuccess();

      // 5. Feedback visual "PARRY!"
      this.parryFeedbacks.push({
        x: x || this.getCenterX(),
        y: (y || this.y) - 6,
        alpha: 1.0,
        scale: 1.2
      });
    }

    // --- Disparo do Jogador ---
    canShoot(activeCount) {
      if (!this.alive) return false;

      const rapidItem = this.activeItems[SI.CONFIG.ITEMS.TYPES.RAPID];
      if (rapidItem) {
        const tier = rapidItem.tier;
        const maxShots = SI.CONFIG.ITEMS.RAPID_MAX_SHOTS[tier] || 4;
        return activeCount < maxShots && this.shotCooldown <= 0;
      }

      // Regra clássica: apenas UM disparo na tela por vez (ref.)
      return activeCount < SI.CONFIG.PLAYER_SHOT.MAX_NORMAL;
    }

    registerShotFired() {
      const rapidItem = this.activeItems[SI.CONFIG.ITEMS.TYPES.RAPID];
      if (rapidItem) {
        this.shotCooldown = SI.CONFIG.ITEMS.RAPID_COOLDOWN_FRAMES;
      }
    }

    // --- Coleta de Itens Comuns ---
    addItem(type, tierObj) {
      const baseSec = SI.CONFIG.ITEMS.BASE_DURATION_SEC;
      const durationFrames = Math.round(baseSec * tierObj.mult * 60);

      // Se já existirem 2 itens ativos diferentes, remove o com menor tempo restante
      const activeKeys = Object.keys(this.activeItems);
      if (!this.activeItems[type] && activeKeys.length >= SI.CONFIG.ITEMS.MAX_ACTIVE) {
        let lowestKey = activeKeys[0];
        let lowestTimer = this.activeItems[lowestKey].timer;
        for (let i = 1; i < activeKeys.length; i++) {
          if (this.activeItems[activeKeys[i]].timer < lowestTimer) {
            lowestKey = activeKeys[i];
            lowestTimer = this.activeItems[lowestKey].timer;
          }
        }
        delete this.activeItems[lowestKey];
      }

      let name = '';
      let desc = '';
      if (type === SI.CONFIG.ITEMS.TYPES.PIERCE) {
        name = SI.CONFIG.STRINGS.PIERCE_NAME;
        desc = SI.CONFIG.STRINGS.PIERCE_DESC;
      } else if (type === SI.CONFIG.ITEMS.TYPES.RAPID) {
        name = SI.CONFIG.STRINGS.RAPID_NAME;
        desc = SI.CONFIG.STRINGS.RAPID_DESC;
      } else if (type === SI.CONFIG.ITEMS.TYPES.TRIPLE) {
        name = SI.CONFIG.STRINGS.TRIPLE_NAME;
        desc = SI.CONFIG.STRINGS.TRIPLE_DESC;
      }

      this.activeItems[type] = {
        timer: durationFrames,
        maxDuration: durationFrames,
        tier: tierObj.tier,
        mult: tierObj.mult,
        color: tierObj.color,
        name: name,
        desc: desc
      };

      SI.Audio.playItemCollect();
    }

    // --- Coleta e Gerenciamento de Especiais ---
    equipSpecial(type, tierObj) {
      let name = '';
      let desc = '';
      if (type === SI.CONFIG.SPECIALS.TYPES.LASER) {
        name = SI.CONFIG.STRINGS.LASER_NAME;
        desc = SI.CONFIG.STRINGS.LASER_DESC;
      } else {
        name = SI.CONFIG.STRINGS.BOMB_NAME;
        desc = SI.CONFIG.STRINGS.BOMB_DESC;
      }

      // DECISÃO: Equipar um Especial NOVO substitui o atual e ZERA o medidor, mesmo se estava cheio (regra explícita)
      this.equippedSpecial = {
        type: type,
        tier: tierObj.tier,
        mult: tierObj.mult,
        color: tierObj.color,
        name: name,
        desc: desc
      };
      this.specialCharge = 0;

      SI.Audio.playItemCollect();
    }

    addSpecialCharge(amount = 1) {
      const maxCharge = this.getRequiredSpecialCharge();
      this.specialCharge = Math.min(maxCharge, this.specialCharge + amount);
    }

    getRequiredSpecialCharge() {
      const tier = this.equippedSpecial ? this.equippedSpecial.tier : 0;
      return SI.CONFIG.SPECIALS.CHARGE_REQUIRED_BY_TIER[tier] || 15;
    }

    isSpecialReady() {
      return this.specialCharge >= this.getRequiredSpecialCharge();
    }

    consumeSpecial() {
      if (this.isSpecialReady()) {
        this.specialCharge = 0;
        return true;
      }
      return false;
    }

    // --- Dano e Morte ---
    hit() {
      if (!this.alive || this.invulnerableTimer > 0) return false;

      this.alive = false;
      this.lives--;
      this.deathTimer = P_CFG.RESPAWN_DELAY_FRAMES;
      SI.Audio.playPlayerExplosion();
      return true;
    }

    respawn(isBossFight = false) {
      this.x = P_CFG.START_X;
      this.y = P_CFG.START_Y;
      this.alive = true;
      this.deathTimer = 0;
      this.shotCooldown = 0;
      this.invulnerableTimer = isBossFight ? SI.CONFIG.BOSS.PLAYER_RESPAWN_INVULN_FRAMES : 60;
    }

    render(ctx) {
      const cx = this.getCenterX();
      const cy = this.getCenterY();

      // 1. Se estiver morto, desenha animação de explosão
      if (!this.alive) {
        const frame = Math.floor(this.deathTimer / 8) % 2;
        SI.Assets.draw(ctx, 'player_death', this.x - 1, this.y, frame, 15, 8);
        return;
      }

      // 2. Efeito de piscar durante invulnerabilidade
      if (this.invulnerableTimer > 0) {
        if (Math.floor(this.invulnerableTimer / 4) % 2 === 0) {
          // Frame invisível do piscar
          return;
        }
      }

      // 3. Desenho do sprite do Canhão
      SI.Assets.draw(ctx, 'player', this.x, this.y, 0, this.width, this.height);

      // 4. Modo Foco: exibe o hitbox circular brilhante (padrão clássico Touhou)
      if (this.isFocusing) {
        ctx.save();
        // Círculo externo pulsante
        ctx.strokeStyle = '#22e6ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, this.hitboxRadius + 1, 0, Math.PI * 2);
        ctx.stroke();

        // Ponto central vermelho/branco brilhante
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Pulso visual do Parry (anel magenta expandindo)
      if (this.parryPulseTimer > 0) {
        ctx.save();
        const progress = 1 - (this.parryPulseTimer / 10);
        ctx.strokeStyle = PARRY_CFG.COLOR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, this.parryRingRadius * (0.8 + progress * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Textos de feedback "PARRY!"
      for (const fb of this.parryFeedbacks) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 47, 208, ${fb.alpha})`;
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(SI.CONFIG.STRINGS.PARRY_TEXT, Math.round(fb.x), Math.round(fb.y));
        ctx.restore();
      }
    }
  }

  return Player;
})();
