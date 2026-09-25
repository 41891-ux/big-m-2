/**
 * js/entities/specials.js - Sistema de armas Especiais recarregáveis por abates e parry.
 * Implementa o Laser Convergente (Cuphead Converge) e a Bomba Estelar,
 * drops determinísticos a cada 70 abates com tiers de qualidade e consumo total de carga.
 * Namespace global: window.SI.Specials
 */

window.SI = window.SI || {};

window.SI.Specials = (function() {
  const SP_CFG = SI.CONFIG.SPECIALS;
  const TIER_TABLE = SI.CONFIG.TIER_TABLE;

  class SpecialCapsule {
    constructor(type, tierObj, x, y) {
      this.type = type;       // 'laser' ou 'bomb'
      this.tier = tierObj;    // { tier, name, mult, color }
      this.x = x;
      this.y = y;
      this.width = 8;
      this.height = 8;
      this.speed = 0.75;
      this.active = true;
    }

    update() {
      this.y += this.speed;
      if (this.y > SI.CONFIG.VIDEO.LOGICAL_HEIGHT) {
        this.active = false;
      }
    }

    render(ctx) {
      const assetKey = 'special_' + this.type;

      ctx.save();
      ctx.strokeStyle = this.tier.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(this.x - 1), Math.round(this.y - 1), this.width + 2, this.height + 2);
      ctx.restore();

      SI.Assets.draw(ctx, assetKey, this.x, this.y, 0, this.width, this.height);
    }
  }

  class SpecialsManager {
    constructor() {
      this.capsules = [];

      // Estado de ativação do Laser Convergente
      this.laserActive = false;
      this.laserPhase = 'idle'; // 'idle', 'converge', 'beam'
      this.laserTimer = 0;
      this.laserTickTimer = 0;
      this.laserAudioLoop = null;
      this.laserMult = 1.0;
      this.screenShake = 0;

      // Estado de ativação da Bomba Estelar
      this.bombEffectTimer = 0;
      this.bombMaxTimer = 0;
      this.bombRadius = 0;

      this.stats = {
        total: 0,
        tier0: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0,
        tier4: 0
      };
    }

    reset() {
      this.capsules.length = 0;
      this.stopLaser();
      this.bombEffectTimer = 0;
    }

    stopLaser() {
      this.laserActive = false;
      this.laserPhase = 'idle';
      this.laserTimer = 0;
      this.laserTickTimer = 0;
      this.screenShake = 0;
      if (this.laserAudioLoop && this.laserAudioLoop.osc) {
        try {
          this.laserAudioLoop.osc.stop();
          this.laserAudioLoop.osc.disconnect();
        } catch (e) {}
        this.laserAudioLoop = null;
      }
    }

    isLaserFiring() {
      return this.laserActive;
    }

    rollTier() {
      const picked = SI.Util.weightedChoice(TIER_TABLE);
      this.stats['tier' + picked.tier]++;
      this.stats.total++;
      return picked;
    }

    rollType() {
      const types = [SP_CFG.TYPES.LASER, SP_CFG.TYPES.BOMB];
      return SI.Util.randomChoice(types);
    }

    // Drop determinístico acionado a cada 70 abates
    spawnDrop(x, y, forcedType = null, forcedTierIndex = null) {
      if (!SI.CONFIG.FEATURES.specials) return;

      const type = forcedType || this.rollType();
      const tier = (forcedTierIndex !== null && TIER_TABLE[forcedTierIndex])
        ? TIER_TABLE[forcedTierIndex]
        : this.rollTier();

      // Desloca levemente em X caso coincida com o drop do 20º abate (ex: abate 140)
      const capsule = new SpecialCapsule(type, tier, x + 4, y);
      this.capsules.push(capsule);
    }

    // Coleta pelo canhão
    checkPlayerCollection(player, toastManager) {
      if (!player.alive) return;

      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        if (SI.Util.checkAABB(c, player)) {
          // Equipa o Especial no jogador (zera medidor)
          player.equipSpecial(c.type, c.tier);

          if (toastManager) {
            toastManager.showToast({
              iconKey: 'special_' + c.type,
              name: player.equippedSpecial.name,
              tierNumber: c.tier.tier,
              tierName: c.tier.name,
              tierColor: c.tier.color,
              description: player.equippedSpecial.desc
            });
          }

          this.capsules.splice(i, 1);
        }
      }
    }

    // --- Ativação de Especial ---
    activateSpecial(player, formation, ufo, shotsManager, boss, particleSystem, addScoreCallback) {
      if (!player.isSpecialReady()) return false;

      // Consome toda a carga
      player.consumeSpecial();
      const spec = player.equippedSpecial;
      const mult = spec.mult;

      if (spec.type === SP_CFG.TYPES.LASER) {
        // Dispara o Laser Convergente
        this.laserActive = true;
        this.laserPhase = 'converge';
        this.laserTimer = SP_CFG.LASER.CONVERGE_FRAMES; // 21 frames (0.35s)
        this.laserTickTimer = 0;
        this.laserMult = mult;
        this.screenShake = 0;
        SI.Audio.playLaserCharge();
      } else if (spec.type === SP_CFG.TYPES.BOMB) {
        // Dispara a Bomba Estelar
        this.triggerBomb(player, mult, formation, ufo, shotsManager, boss, particleSystem, addScoreCallback);
      }

      return true;
    }

    // Execução instantânea da Bomba Estelar
    triggerBomb(player, mult, formation, ufo, shotsManager, boss, particleSystem, addScoreCallback) {
      // 1. Apaga todos os tiros inimigos da tela
      if (shotsManager && shotsManager.enemyShots) {
        for (const s of shotsManager.enemyShots) {
          if (particleSystem) {
            particleSystem.emit(s.x, s.y, 4, '#ffd23f', 1.5, 10, 1);
          }
          shotsManager.enemyShotPool.release(s);
        }
        shotsManager.enemyShots.length = 0;
      }

      // 2. Apaga projéteis do chefe
      if (boss && boss.active && boss.bossShots) {
        for (const bs of boss.bossShots) {
          if (particleSystem) {
            particleSystem.emit(bs.x, bs.y, 4, '#ffd23f', 1.5, 10, 1);
          }
        }
        boss.bossShots.length = 0;
      }

      // 3. Elimina todos os invasores comuns visíveis
      if (formation && formation.livingInvaders) {
        for (let i = formation.livingInvaders.length - 1; i >= 0; i--) {
          const inv = formation.livingInvaders[i];
          if (addScoreCallback) addScoreCallback(inv.points);
          formation.killInvader(inv);
        }
      }

      // 4. Se UFO estiver ativo, destrói com pontuação
      if (ufo && ufo.active) {
        const pts = ufo.hit(23);
        if (addScoreCallback) addScoreCallback(pts);
      }

      // 5. Causa 5 * mult de dano ao chefe (se em luta)
      if (boss && boss.active && boss.hp > 0 && !boss.isInvulnerable) {
        const dmg = SP_CFG.BOMB.BOSS_DAMAGE(mult);
        boss.takeDamage(dmg, particleSystem);
      }

      // 6. Elimina mini-invasores de reforço do chefe
      if (boss && boss.miniInvaders) {
        for (const mini of boss.miniInvaders) {
          if (mini.alive) {
            mini.alive = false;
            mini.explodingTimer = 10;
          }
        }
      }

      // 7. Concede invencibilidade breve ao jogador (min(1.0 * mult, 2.5) segundos)
      const iframesSec = SP_CFG.BOMB.IFRAMES_SEC(mult);
      const iframesFrames = Math.round(iframesSec * 60);
      player.invulnerableTimer = Math.max(player.invulnerableTimer, iframesFrames);

      // 8. Efeito visual e sonoro da onda de choque
      this.bombEffectTimer = 30; // 0.5s de efeito
      this.bombMaxTimer = 30;
      this.bombRadius = 0;
      SI.Audio.playBombBlast();
    }

    update(player, formation, ufo, shotsManager, boss, particleSystem) {
      // 1. Atualização das cápsulas em queda
      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        c.update();
        if (!c.active) {
          this.capsules.splice(i, 1);
        }
      }

      // 2. Atualização da Bomba Estelar
      if (this.bombEffectTimer > 0) {
        this.bombEffectTimer--;
        const progress = 1 - (this.bombEffectTimer / this.bombMaxTimer);
        this.bombRadius = progress * SI.CONFIG.VIDEO.LOGICAL_HEIGHT * 1.2;
      }

      // 3. Atualização do Laser Convergente
      if (!this.laserActive) return;

      if (this.laserPhase === 'converge') {
        this.laserTimer--;
        if (this.laserTimer <= 0) {
          this.laserPhase = 'beam';
          const durSec = SP_CFG.LASER.DURATION_SEC(this.laserMult);
          this.laserTimer = Math.round(durSec * 60);
          this.laserAudioLoop = SI.Audio.playLaserBeamLoop();
        }
      } else if (this.laserPhase === 'beam') {
        this.laserTimer--;
        this.screenShake = Math.sin(this.laserTimer * 0.8) * 1.5;

        if (particleSystem && Math.random() < 0.6) {
          particleSystem.emit(player.getCenterX(), player.y, 3, '#22e6ff', 1.5, 8, 1);
        }

        // Dano a cada 6 frames
        this.laserTickTimer++;
        if (this.laserTickTimer >= SP_CFG.LASER.TICK_DAMAGE_INTERVAL) {
          this.laserTickTimer = 0;
          this.applyLaserDamage(player, formation, ufo, shotsManager, boss, particleSystem);
        }

        if (this.laserTimer <= 0) {
          this.stopLaser();
        }
      }
    }

    applyLaserDamage(player, formation, ufo, shotsManager, boss, particleSystem) {
      const beamW = SP_CFG.LASER.BEAM_WIDTH;
      const laserBox = {
        x: player.getCenterX() - beamW / 2,
        y: 0,
        width: beamW,
        height: player.y
      };

      // Apaga tiros inimigos na área do raio
      if (shotsManager && shotsManager.enemyShots) {
        for (let i = shotsManager.enemyShots.length - 1; i >= 0; i--) {
          const s = shotsManager.enemyShots[i];
          if (SI.Util.checkAABB(laserBox, s)) {
            if (particleSystem) {
              particleSystem.emit(s.x, s.y, 3, '#22e6ff', 1.0, 8, 1);
            }
            shotsManager.enemyShots.splice(i, 1);
            shotsManager.enemyShotPool.release(s);
          }
        }
      }

      // Elimina invasores na área
      if (formation && formation.livingInvaders) {
        for (let i = formation.livingInvaders.length - 1; i >= 0; i--) {
          const inv = formation.livingInvaders[i];
          if (SI.Util.checkAABB(laserBox, inv)) {
            formation.killInvader(inv);
            if (particleSystem) {
              particleSystem.emit(inv.x + inv.width / 2, inv.y + inv.height / 2, 8, '#22e6ff', 2.0, 12, 1);
            }
          }
        }
      }

      // Elimina UFO na área
      if (ufo && ufo.active) {
        if (SI.Util.checkAABB(laserBox, ufo)) {
          ufo.hit(23);
        }
      }

      // Causa dano no chefe (2 * mult por tick)
      if (boss && boss.active && boss.hp > 0 && !boss.isInvulnerable) {
        if (SI.Util.checkAABB(laserBox, boss)) {
          const tickDmg = SP_CFG.LASER.DAMAGE_PER_TICK(this.laserMult);
          boss.takeDamage(tickDmg, particleSystem);
        }

        // Mini-invasores de reforço
        for (let i = 0; i < boss.miniInvaders.length; i++) {
          const mini = boss.miniInvaders[i];
          if (mini.alive && SI.Util.checkAABB(laserBox, mini)) {
            mini.alive = false;
            mini.explodingTimer = 10;
          }
        }
      }
    }

    render(ctx, playerX, playerY) {
      // 1. Renderiza cápsulas em queda
      for (let i = 0; i < this.capsules.length; i++) {
        this.capsules[i].render(ctx);
      }

      // 2. Renderiza efeito de expansão da Bomba Estelar
      if (this.bombEffectTimer > 0) {
        ctx.save();
        const alpha = this.bombEffectTimer / this.bombMaxTimer;
        ctx.strokeStyle = `rgba(255, 210, 63, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(112, 128, this.bombRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
        ctx.fillRect(0, 0, SI.CONFIG.VIDEO.LOGICAL_WIDTH, SI.CONFIG.VIDEO.LOGICAL_HEIGHT);
        ctx.restore();
      }

      // 3. Renderiza Laser Convergente
      if (!this.laserActive) return;

      const cannonCX = playerX + SI.CONFIG.PLAYER.WIDTH / 2;

      ctx.save();
      if (this.laserPhase === 'converge') {
        const progress = 1 - (this.laserTimer / SP_CFG.LASER.CONVERGE_FRAMES);
        const spread = (1 - progress) * 26;

        ctx.strokeStyle = '#22e6ff';
        ctx.lineWidth = 1.5;

        // Feixe central
        ctx.beginPath();
        ctx.moveTo(cannonCX, playerY);
        ctx.lineTo(cannonCX, 0);
        ctx.stroke();

        // Feixes laterais convergindo
        ctx.beginPath();
        ctx.moveTo(cannonCX, playerY);
        ctx.lineTo(cannonCX - spread, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cannonCX, playerY);
        ctx.lineTo(cannonCX + spread, 0);
        ctx.stroke();
      } else if (this.laserPhase === 'beam') {
        const w = SP_CFG.LASER.BEAM_WIDTH;
        const x = cannonCX - w / 2;
        const h = playerY;

        // Gradiente do feixe contínuo
        const grad = ctx.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, 'rgba(34, 230, 255, 0.2)');
        grad.addColorStop(0.3, 'rgba(34, 230, 255, 0.85)');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(0.7, 'rgba(34, 230, 255, 0.85)');
        grad.addColorStop(1, 'rgba(34, 230, 255, 0.2)');

        ctx.fillStyle = grad;
        ctx.fillRect(Math.round(x), 0, w, h);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(x + 2), 0, w - 4, h);
      }
      ctx.restore();
    }
  }

  return SpecialsManager;
})();
