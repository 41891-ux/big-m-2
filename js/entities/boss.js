/**
 * js/entities/boss.js - Chefe Final acionado aos 67.000 pontos.
 * Barra de vida (150 HP), 3 fases de combate com velocidade e agressividade progressivas,
 * 4 ataques telegrafados com aviso >= 0.5s (Leque, Cortina com brechas, Raio Vertical não-parryable e Espiral),
 * reforços de mini-invasores e sequência dramática de derrota.
 * Namespace global: window.SI.Boss
 */

window.SI = window.SI || {};

window.SI.Boss = (function() {
  const CFG = SI.CONFIG.BOSS;
  const BH_CFG = SI.CONFIG.BULLET_HELL;

  class MiniInvader {
    constructor(x, y, col) {
      this.x = x;
      this.y = y;
      this.col = col;
      this.width = 11;
      this.height = 8;
      this.type = 'invader_medium';
      this.alive = true;
      this.animFrame = 0;
      this.explodingTimer = 0;
    }
  }

  class Boss {
    constructor() {
      this.reset();
    }

    reset() {
      this.active = false;
      this.defeated = false;
      this.x = (SI.CONFIG.VIDEO.LOGICAL_WIDTH - CFG.WIDTH) / 2;
      this.y = -CFG.HEIGHT;
      this.width = CFG.WIDTH;
      this.height = CFG.HEIGHT;
      this.hp = CFG.MAX_HP;
      this.maxHp = CFG.MAX_HP;
      this.isInvulnerable = false;
      this.invulnerableTimer = 0;
      this.damageFlashTimer = 0;

      this.direction = 1;
      this.baseSpeed = CFG.PHASES.PHASE_1.speed;
      this.oscillationTimer = 0;

      // Ataques
      this.attackCooldown = 120; // 2s iniciais
      this.currentAttack = null; // 'fan', 'curtain', 'beam', 'spiral'
      this.attackPhase = 'idle'; // 'telegraph', 'execute'
      this.attackTimer = 0;
      this.telegraphData = null;
      this.spiralAngle = 0;

      // Reforços
      this.miniInvaders = [];
      this.miniCycleIndex = 0;
      this.miniDirection = 1;
      this.miniDropActive = false;
      this.miniEdgeReached = false;
      this.reinforcementTimer = CFG.REINFORCEMENTS.INTERVAL_FRAMES;
      this.spawnedThreshold50 = false;
      this.spawnedThreshold25 = false;

      // Projéteis do chefe
      this.bossShots = [];

      this.deathTimer = 0;
    }

    startIntro() {
      this.reset();
      this.active = true;
      this.isInvulnerable = true;
      this.invulnerableTimer = CFG.DESCEND_FRAMES + CFG.INVULNERABLE_FRAMES;
      this.y = -CFG.HEIGHT;
    }

    getPhase() {
      const ratio = this.hp / this.maxHp;
      if (ratio > CFG.PHASES.PHASE_2.hpThreshold) return 1;
      if (ratio > CFG.PHASES.PHASE_3.hpThreshold) return 2;
      return 3;
    }

    update(playerX, playerY, bunkers, particleSystem) {
      if (!this.active) return;

      if (this.damageFlashTimer > 0) this.damageFlashTimer--;
      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer--;
        if (this.invulnerableTimer <= 0) {
          this.isInvulnerable = false;
        }
      }

      // Descida inicial até a posição Y de combate
      if (this.y < CFG.Y_FIGHT) {
        this.y += (CFG.Y_FIGHT - (-CFG.HEIGHT)) / CFG.DESCEND_FRAMES;
        if (this.y >= CFG.Y_FIGHT) {
          this.y = CFG.Y_FIGHT;
        }
        return;
      }

      // Sequência de Derrota
      if (this.defeated) {
        this.deathTimer++;
        if (particleSystem && Math.random() < 0.75) {
          const rx = this.x + SI.Util.randomRange(2, this.width - 2);
          const ry = this.y + SI.Util.randomRange(2, this.height - 2);
          particleSystem.emit(rx, ry, 10, SI.Util.randomChoice(['#ff2fd0', '#ffd23f', '#ffffff']), 2.0, 20, 1);
        }
        return;
      }

      this.updateMovement();
      this.updateAttacks(playerX, playerY);
      this.updateReinforcements(bunkers);
      this.updateBossShots();
    }

    updateMovement() {
      const phase = this.getPhase();
      if (phase === 1) this.baseSpeed = CFG.PHASES.PHASE_1.speed;
      else if (phase === 2) this.baseSpeed = CFG.PHASES.PHASE_2.speed;
      else this.baseSpeed = CFG.PHASES.PHASE_3.speed;

      this.x += this.direction * this.baseSpeed;
      if (this.x <= 16) {
        this.x = 16;
        this.direction = 1;
      } else if (this.x + this.width >= SI.CONFIG.VIDEO.LOGICAL_WIDTH - 16) {
        this.x = SI.CONFIG.VIDEO.LOGICAL_WIDTH - 16 - this.width;
        this.direction = -1;
      }

      this.oscillationTimer += 0.05;
      this.y = CFG.Y_FIGHT + Math.sin(this.oscillationTimer) * 4;
    }

    updateAttacks(playerX, playerY) {
      if (this.isInvulnerable) return;

      if (!this.currentAttack) {
        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
          this.decideNextAttack(playerX);
        }
        return;
      }

      if (this.attackPhase === 'telegraph') {
        this.attackTimer--;
        if (this.attackTimer <= 0) {
          this.executeAttack(playerX, playerY);
        }
      } else if (this.attackPhase === 'execute') {
        this.attackTimer--;

        // Execução contínua da espiral durante a fase 3
        if (this.currentAttack === 'spiral' && this.attackTimer > 0 && this.attackTimer % 5 === 0) {
          this.spiralAngle += 0.35;
          this.spawnSpiralRing(this.spiralAngle);
        }

        if (this.attackTimer <= 0) {
          this.currentAttack = null;
          this.attackPhase = 'idle';
          this.telegraphData = null;
          const phase = this.getPhase();
          this.attackCooldown = (phase === 3) ? 50 : (phase === 2 ? 80 : 110);
        }
      }
    }

    decideNextAttack(playerX) {
      const phase = this.getPhase();
      const choices = ['fan', 'curtain'];

      if (phase >= 2) {
        choices.push('beam');
      }
      if (phase === 3) {
        choices.push('spiral');
      }

      this.currentAttack = SI.Util.randomChoice(choices);
      this.attackPhase = 'telegraph';

      if (this.currentAttack === 'fan') {
        this.attackTimer = 36; // 0.6s de aviso
        this.telegraphData = { type: 'fan' };
      } else if (this.currentAttack === 'curtain') {
        this.attackTimer = 42; // 0.7s de aviso
        const gapWidth = BH_CFG.SAFE_LANE_MIN_WIDTH + 6; // >= 25px
        const gap1 = SI.Util.clamp(playerX - 15 + SI.Util.randomRange(-15, 15), 24, 90);
        const gap2 = SI.Util.clamp(gap1 + SI.Util.randomRange(60, 90), 120, 195);
        this.telegraphData = { type: 'curtain', gap1, gap2, gapWidth };
      } else if (this.currentAttack === 'beam') {
        this.attackTimer = 60; // 1.0s de aviso nas colunas miradas (ref.)
        const col1 = SI.Util.clamp(playerX + 6, 20, 204);
        const col2 = (phase === 3) ? (col1 < 112 ? col1 + 60 : col1 - 60) : null;
        this.telegraphData = { type: 'beam', col1, col2, beamWidth: 16 };
      } else if (this.currentAttack === 'spiral') {
        this.attackTimer = 36;
        this.telegraphData = { type: 'spiral' };
        this.spiralAngle = 0;
      }
    }

    executeAttack(playerX, playerY) {
      this.attackPhase = 'execute';

      if (this.currentAttack === 'fan') {
        this.attackTimer = 25;
        const count = (this.getPhase() === 3) ? 7 : 5;
        this.spawnFanBurst(playerX, playerY, count);

        // Segunda rajada após 0.25s
        setTimeout(() => {
          if (this.active && !this.defeated) {
            this.spawnFanBurst(playerX, playerY, count);
          }
        }, 250);
      } else if (this.currentAttack === 'curtain') {
        this.attackTimer = 20;
        const data = this.telegraphData;
        const step = 8;
        for (let x = 12; x < SI.CONFIG.VIDEO.LOGICAL_WIDTH - 12; x += step) {
          const inGap1 = (x >= data.gap1 - 2 && x <= data.gap1 + data.gapWidth + 2);
          const inGap2 = (x >= data.gap2 - 2 && x <= data.gap2 + data.gapWidth + 2);
          if (!inGap1 && !inGap2) {
            this.bossShots.push({
              x: x,
              y: this.y + this.height,
              vx: 0,
              vy: 1.6,
              width: 4,
              height: 6,
              parryable: true,
              active: true
            });
          }
        }
      } else if (this.currentAttack === 'beam') {
        this.attackTimer = 30; // 0.5s de raio contínuo fatal
      } else if (this.currentAttack === 'spiral') {
        this.attackTimer = 45; // Emite anéis rotativos por 45 frames
      }
    }

    spawnFanBurst(playerX, playerY, count) {
      const originX = this.x + this.width / 2;
      const originY = this.y + this.height - 2;
      const targetX = playerX + SI.CONFIG.PLAYER.WIDTH / 2;
      const targetY = playerY + SI.CONFIG.PLAYER.HEIGHT / 2;

      const baseAngle = Math.atan2(targetY - originY, targetX - originX);
      const spreadAngle = SI.Util.degToRad(36);
      const angleStep = spreadAngle / (count - 1);
      const startAngle = baseAngle - spreadAngle / 2;

      for (let i = 0; i < count; i++) {
        const ang = startAngle + i * angleStep;
        const spd = 1.75;
        this.bossShots.push({
          x: originX,
          y: originY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          width: 4,
          height: 6,
          parryable: true,
          active: true
        });
      }
    }

    spawnSpiralRing(baseAngleRad) {
      const originX = this.x + this.width / 2;
      const originY = this.y + this.height / 2;
      const count = 6;
      const angleStep = (Math.PI * 2) / count;
      const spd = 1.4;

      for (let i = 0; i < count; i++) {
        const ang = baseAngleRad + i * angleStep;
        this.bossShots.push({
          x: originX - 2,
          y: originY - 2,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          width: 4,
          height: 4,
          parryable: true,
          active: true
        });
      }
    }

    updateBossShots() {
      for (let i = this.bossShots.length - 1; i >= 0; i--) {
        const s = this.bossShots[i];
        s.x += s.vx;
        s.y += s.vy;

        if (s.y > SI.CONFIG.PLAYER.GROUND_Y || s.x < -10 || s.x > SI.CONFIG.VIDEO.LOGICAL_WIDTH + 10) {
          this.bossShots.splice(i, 1);
        }
      }
    }

    updateReinforcements(bunkers) {
      const hpRatio = this.hp / this.maxHp;

      if (!this.spawnedThreshold50 && hpRatio <= 0.50) {
        this.spawnedThreshold50 = true;
        this.spawnReinforcements();
      }
      if (!this.spawnedThreshold25 && hpRatio <= 0.25) {
        this.spawnedThreshold25 = true;
        this.spawnReinforcements();
      }

      if (this.getPhase() >= 2) {
        this.reinforcementTimer--;
        if (this.reinforcementTimer <= 0) {
          this.reinforcementTimer = CFG.REINFORCEMENTS.INTERVAL_FRAMES;
          this.spawnReinforcements();
        }
      }

      // Atualiza movimento dos mini-invasores
      const living = this.miniInvaders.filter(m => m.alive);
      if (living.length === 0) return;

      if (this.miniCycleIndex >= living.length) {
        this.miniCycleIndex = 0;
        if (this.miniDropActive) {
          this.miniDropActive = false;
          this.miniEdgeReached = false;
        } else if (this.miniEdgeReached) {
          this.miniDropActive = true;
          this.miniDirection = -this.miniDirection;
          this.miniEdgeReached = false;
        }
      }

      const mini = living[this.miniCycleIndex];
      if (mini && mini.alive) {
        if (this.miniDropActive) {
          mini.y += 6;
          if (bunkers) bunkers.checkInvaderOverlap(mini);
        } else {
          mini.x += this.miniDirection * 2;
          if (mini.x <= 10 || mini.x + mini.width >= SI.CONFIG.VIDEO.LOGICAL_WIDTH - 10) {
            this.miniEdgeReached = true;
          }
        }
        mini.animFrame = 1 - mini.animFrame;
      }

      this.miniCycleIndex++;
    }

    spawnReinforcements() {
      const currentAlive = this.miniInvaders.filter(m => m.alive).length;
      const countToSpawn = Math.min(
        CFG.REINFORCEMENTS.SPAWN_COUNT,
        CFG.REINFORCEMENTS.MAX_ALIVE - currentAlive
      );

      if (countToSpawn <= 0) return;

      const startX = this.x + 4;
      const startY = this.y + this.height + 4;
      for (let i = 0; i < countToSpawn; i++) {
        const mini = new MiniInvader(startX + (i % 4) * 14, startY + Math.floor(i / 4) * 12, i);
        this.miniInvaders.push(mini);
      }
    }

    takeDamage(amount, particleSystem) {
      if (!this.active || this.hp <= 0 || this.isInvulnerable) return;

      this.hp -= amount;
      this.damageFlashTimer = 6;
      SI.Audio.playBossHit();

      if (particleSystem) {
        particleSystem.emit(
          this.x + this.width / 2 + SI.Util.randomRange(-15, 15),
          this.y + this.height / 2 + SI.Util.randomRange(-8, 8),
          6,
          '#ffffff',
          1.5,
          10,
          1
        );
      }

      if (this.hp <= 0) {
        this.hp = 0;
        this.defeated = true;
        this.deathTimer = 0;
        SI.Audio.playBossDefeatExplosion();
      }
    }

    checkHitByPlayerShot(shot, particleSystem) {
      if (!this.active || this.hp <= 0 || this.isInvulnerable) return false;

      // Colisão com o corpo do chefe
      if (SI.Util.checkAABB(shot, this)) {
        const dmg = 1 + (shot.extraBossDamage || 0);
        this.takeDamage(dmg, particleSystem);
        return true;
      }

      // Colisão com os mini-invasores de reforço
      for (let i = 0; i < this.miniInvaders.length; i++) {
        const mini = this.miniInvaders[i];
        if (mini.alive && SI.Util.checkAABB(shot, mini)) {
          mini.alive = false;
          mini.explodingTimer = 12;
          SI.Audio.playInvaderExplosion();
          if (particleSystem) {
            particleSystem.emit(mini.x + mini.width / 2, mini.y + mini.height / 2, 8, '#22e6ff', 1.5, 12, 1);
          }
          // Incrementa contador global no loop principal
          return 'reinforcement';
        }
      }

      return false;
    }

    render(ctx) {
      if (!this.active) return;

      ctx.save();

      // 1. Avisos Visuais dos Ataques (Telegraph >= 0.5s)
      if (this.attackPhase === 'telegraph' && this.telegraphData) {
        const tType = this.telegraphData.type;

        if (tType === 'fan' || tType === 'spiral') {
          const pulse = (Math.sin(this.attackTimer * 0.4) + 1) * 0.5;
          ctx.strokeStyle = `rgba(255, 47, 208, ${0.4 + pulse * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(this.x + 4, this.y + this.height - 2, 4 + pulse * 3, 0, Math.PI * 2);
          ctx.arc(this.x + this.width - 4, this.y + this.height - 2, 4 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        } else if (tType === 'curtain') {
          ctx.fillStyle = (Math.floor(this.attackTimer / 4) % 2 === 0) ? 'rgba(255, 47, 208, 0.4)' : 'rgba(255, 210, 63, 0.4)';
          ctx.fillRect(0, this.y + this.height + 2, SI.CONFIG.VIDEO.LOGICAL_WIDTH, 2);
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(this.telegraphData.gap1, this.y + this.height + 1, this.telegraphData.gapWidth, 4);
          ctx.fillRect(this.telegraphData.gap2, this.y + this.height + 1, this.telegraphData.gapWidth, 4);
        } else if (tType === 'beam') {
          const pulse = (Math.sin(this.attackTimer * 0.5) + 1) * 0.5;
          ctx.fillStyle = `rgba(255, 51, 68, ${0.15 + pulse * 0.3})`;
          const bW = this.telegraphData.beamWidth;
          ctx.fillRect(this.telegraphData.col1 - bW / 2, 0, bW, SI.CONFIG.PLAYER.GROUND_Y);
          if (this.telegraphData.col2 !== null) {
            ctx.fillRect(this.telegraphData.col2 - bW / 2, 0, bW, SI.CONFIG.PLAYER.GROUND_Y);
          }
        }
      }

      // 2. Execução do Raio Vertical (Ataque C - Não-parryable)
      if (this.currentAttack === 'beam' && this.attackPhase === 'execute' && this.telegraphData) {
        const bW = this.telegraphData.beamWidth;
        const grad = ctx.createLinearGradient(0, 0, bW, 0);
        grad.addColorStop(0, 'rgba(255, 51, 68, 0.4)');
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, 'rgba(255, 51, 68, 0.4)');

        ctx.fillStyle = grad;
        ctx.fillRect(this.telegraphData.col1 - bW / 2, 0, bW, SI.CONFIG.PLAYER.GROUND_Y);
        if (this.telegraphData.col2 !== null) {
          ctx.fillRect(this.telegraphData.col2 - bW / 2, 0, bW, SI.CONFIG.PLAYER.GROUND_Y);
        }
      }

      // 3. Desenho do Chefe com Flash de Dano
      if (this.damageFlashTimer > 0) {
        SI.Assets.draw(ctx, 'boss', this.x, this.y, 0, this.width, this.height);
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.restore();
      } else {
        const frame = (Math.floor(this.oscillationTimer * 2) % 2);
        SI.Assets.draw(ctx, 'boss', this.x, this.y, frame, this.width, this.height);
      }

      // 4. Mini-invasores de reforço
      for (const mini of this.miniInvaders) {
        if (mini.alive) {
          SI.Assets.draw(ctx, mini.type, mini.x, mini.y, mini.animFrame, mini.width, mini.height);
        } else if (mini.explodingTimer > 0) {
          SI.Assets.draw(ctx, 'invader_death', mini.x, mini.y, 0, 13, 8);
        }
      }

      // 5. Projéteis do chefe
      for (const s of this.bossShots) {
        if (s.parryable) {
          ctx.save();
          ctx.strokeStyle = SI.CONFIG.PARRY.COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(s.x - 1), Math.round(s.y - 1), s.width + 2, s.height + 2);
          ctx.restore();
        }
        SI.Assets.draw(ctx, 'boss_shot', s.x, s.y, 0, s.width, s.height);
      }

      ctx.restore();
    }
  }

  return Boss;
})();
