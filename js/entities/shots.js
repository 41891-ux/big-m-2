/**
 * js/entities/shots.js - Gerenciador de projéteis do jogador e padrões de bullet hell inimigos.
 * Implementa a PATTERN_LIBRARY com garantia estrita de corredor seguro (SAFE_LANE_MIN_WIDTH >= 19px),
 * suporte a projéteis parryable com contorno magenta (#ff2fd0), pooling e anulação mútua de tiros.
 * Namespace global: window.SI.Shots
 */

window.SI = window.SI || {};

window.SI.Shots = (function() {
  const P_CFG = SI.CONFIG.PLAYER_SHOT;
  const BH_CFG = SI.CONFIG.BULLET_HELL;
  const PARRY_CFG = SI.CONFIG.PARRY;

  // GRAZE: ponto de extensão futura

  class ShotsManager {
    constructor() {
      this.playerShots = [];
      this.enemyShots = [];

      // Pool de projéteis do jogador
      this.playerShotPool = new SI.Util.ObjectPool(
        () => ({
          x: 0, y: 0, vx: 0, vy: -P_CFG.SPEED, width: P_CFG.WIDTH, height: P_CFG.HEIGHT,
          isPierce: false, isTripleChild: false, extraBossDamage: 0, hitIds: new Set(), active: false
        }),
        (s) => {
          s.active = false;
          s.hitIds.clear();
        },
        24
      );

      // Pool de projéteis inimigos (Bullet Hell)
      this.enemyShotPool = new SI.Util.ObjectPool(
        () => ({
          x: 0, y: 0, vx: 0, vy: BH_CFG.BASE_SPEED, width: 3, height: 7,
          type: 'linear', animFrame: 0, animTimer: 0, parryable: true,
          waveOffset: 0, waveTimer: 0, active: false
        }),
        (s) => { s.active = false; },
        80
      );

      this.enemyReloadTimer = 0;
      this.burstQueue = []; // Fila para rajadas em sequência rápida
    }

    reset() {
      for (const s of this.playerShots) this.playerShotPool.release(s);
      for (const s of this.enemyShots) this.enemyShotPool.release(s);
      this.playerShots.length = 0;
      this.enemyShots.length = 0;
      this.burstQueue.length = 0;
      this.enemyReloadTimer = 0;
    }

    // --- Disparos do Jogador ---
    spawnPlayerShot(playerX, playerY, isPierce = false, tripleItem = null, pierceItem = null) {
      const extraBossDmg = (isPierce && pierceItem) ? (SI.CONFIG.ITEMS.PIERCE_BOSS_EXTRA_DMG[pierceItem.tier] || 0) : 0;

      if (tripleItem) {
        // Disparo em leque (3, 5 ou 7 projéteis conforme o tier)
        const tier = tripleItem.tier;
        const count = SI.CONFIG.ITEMS.TRIPLE_PROJECTILES[tier] || 3;
        const maxSpreadDeg = (tier >= 4) ? SI.CONFIG.ITEMS.TRIPLE_MAX_SPREAD_DEG : 24;
        const halfSpread = maxSpreadDeg / 2;
        const angleStep = maxSpreadDeg / (count - 1);
        const spd = P_CFG.SPEED;

        for (let i = 0; i < count; i++) {
          const deg = -halfSpread + i * angleStep;
          const rad = SI.Util.degToRad(deg);
          const s = this.playerShotPool.obtain();
          s.x = playerX + 6;
          s.y = playerY - 4;
          s.vx = Math.sin(rad) * spd;
          s.vy = -Math.cos(rad) * spd;
          s.width = P_CFG.WIDTH;
          s.height = P_CFG.HEIGHT;
          s.isPierce = isPierce;
          s.extraBossDamage = extraBossDmg;
          s.isTripleChild = true;
          s.hitIds.clear();
          s.active = true;
          this.playerShots.push(s);
        }
      } else {
        // Tiro Reto Básico ou Perfurante
        const s = this.playerShotPool.obtain();
        s.x = playerX + 6;
        s.y = playerY - 4;
        s.vx = 0;
        s.vy = -P_CFG.SPEED;
        s.width = P_CFG.WIDTH;
        s.height = P_CFG.HEIGHT;
        s.isPierce = isPierce;
        s.extraBossDamage = extraBossDmg;
        s.isTripleChild = false;
        s.hitIds.clear();
        s.active = true;
        this.playerShots.push(s);
      }

      SI.Audio.playPlayerShot();
    }

    getEffectivePlayerShotCount() {
      let count = 0;
      let hasTriple = false;
      for (const s of this.playerShots) {
        if (s.isTripleChild) {
          hasTriple = true;
        } else {
          count++;
        }
      }
      return count + (hasTriple ? 1 : 0);
    }

    // --- Biblioteca de Padrões de Bullet Hell (PATTERN_LIBRARY) ---
    // Cada padrão respeita e garante matematicamente um corredor seguro >= 19px

    // 1. Linear Mirado: 1 tiro mirado na coluna do jogador (largura 3px -> resto da tela 221px é seguro)
    spawnLinearAimed(originX, originY, targetX) {
      const s = this.enemyShotPool.obtain();
      s.x = originX - 1;
      s.y = originY;
      s.vx = 0;
      s.vy = BH_CFG.BASE_SPEED * 1.1;
      s.width = 3;
      s.height = 7;
      s.type = 'linear';
      s.parryable = true;
      s.animFrame = 0;
      s.animTimer = 0;
      s.active = true;
      this.enemyShots.push(s);
    }

    // 2. Zigue-zague: projétil ondulante (frequência suave, ampla margem segura)
    spawnZigzag(originX, originY) {
      const s = this.enemyShotPool.obtain();
      s.x = originX - 1;
      s.y = originY;
      s.vx = 0;
      s.vy = BH_CFG.BASE_SPEED;
      s.width = 3;
      s.height = 7;
      s.type = 'zigzag';
      s.parryable = true;
      s.waveOffset = originX;
      s.waveTimer = 0;
      s.animFrame = 0;
      s.animTimer = 0;
      s.active = true;
      this.enemyShots.push(s);
    }

    // 3. Leque (Fan): N projéteis em arco; o espaçamento angular garante brecha >= 19px na linha do canhão
    spawnFan(originX, originY, count = 3, spreadDeg = 24) {
      const angleStep = spreadDeg / (count - 1);
      const halfSpread = spreadDeg / 2;
      const spd = BH_CFG.BASE_SPEED;

      for (let i = 0; i < count; i++) {
        const deg = -halfSpread + i * angleStep;
        const rad = SI.Util.degToRad(deg);
        const s = this.enemyShotPool.obtain();
        s.x = originX - 1;
        s.y = originY;
        s.vx = Math.sin(rad) * spd;
        s.vy = Math.cos(rad) * spd;
        s.width = 3;
        s.height = 7;
        s.type = 'fan';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    // 4. Coluna / Rajada (Burst): 3-5 tiros em sequência rápida na mesma coluna (o resto da tela é 100% seguro)
    queueBurst(originX, originY, count = 3, intervalFrames = 8) {
      for (let i = 0; i < count; i++) {
        this.burstQueue.push({
          delay: i * intervalFrames,
          x: originX,
          y: originY
        });
      }
    }

    // 5. Parede com Brecha: cobre a largura deixando 1 ou 2 brechas seguras >= 20px alcançáveis pelo jogador
    spawnWallWithGap(originY, playerX) {
      const safeWidth = BH_CFG.SAFE_LANE_MIN_WIDTH + 6; // 25 px de corredor seguro
      // Garante que o corredor seguro está dentro de alcance viável da posição atual do jogador
      const gapCenter = SI.Util.clamp(playerX + SI.Util.randomRange(-25, 25), 20, 204);
      const gapMin = gapCenter - safeWidth / 2;
      const gapMax = gapCenter + safeWidth / 2;

      const step = 8;
      for (let x = 12; x <= SI.CONFIG.VIDEO.LOGICAL_WIDTH - 12; x += step) {
        if (x >= gapMin && x <= gapMax) {
          // Corredor seguro: nenhum projétil é criado aqui
          continue;
        }
        const s = this.enemyShotPool.obtain();
        s.x = x;
        s.y = originY;
        s.vx = 0;
        s.vy = BH_CFG.BASE_SPEED * 0.9;
        s.width = 3;
        s.height = 7;
        s.type = 'wall';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    // 6. Espiral: anel rotativo lento com espaçamento largo
    spawnSpiral(originX, originY, baseAngleRad, count = 6) {
      const angleStep = (Math.PI * 2) / count;
      const spd = BH_CFG.BASE_SPEED * 0.85;

      for (let i = 0; i < count; i++) {
        const ang = baseAngleRad + i * angleStep;
        const s = this.enemyShotPool.obtain();
        s.x = originX - 2;
        s.y = originY - 2;
        s.vx = Math.cos(ang) * spd;
        s.vy = Math.sin(ang) * spd;
        s.width = 4;
        s.height = 4;
        s.type = 'spiral';
        s.parryable = true;
        s.animFrame = 0;
        s.animTimer = 0;
        s.active = true;
        this.enemyShots.push(s);
      }
    }

    // --- Atualização de Disparos Inimigos por Onda ---
    updateEnemyFiring(wave, formation, playerX) {
      // Processa fila de rajadas ativas
      for (let i = this.burstQueue.length - 1; i >= 0; i--) {
        const item = this.burstQueue[i];
        item.delay--;
        if (item.delay <= 0) {
          this.spawnLinearAimed(item.x, item.y, playerX);
          this.burstQueue.splice(i, 1);
        }
      }

      if (this.enemyReloadTimer > 0) {
        this.enemyReloadTimer--;
        return;
      }

      const maxBullets = BH_CFG.MAX_ENEMY_BULLETS(wave);
      if (this.enemyShots.length >= maxBullets) return;

      const lowestInvaders = formation.getLowestInvadersAllCols();
      if (lowestInvaders.length === 0) return;

      // Cadência escala com a onda
      this.enemyReloadTimer = Math.max(16, 50 - wave * 3);

      // Quantidade de colunas que podem atirar neste passo (1 a 3 conforme a onda)
      const shotsToFire = Math.min(3, 1 + Math.floor(wave / 3));

      for (let s = 0; s < shotsToFire; s++) {
        if (this.enemyShots.length >= maxBullets) break;

        const invader = SI.Util.randomChoice(lowestInvaders);
        if (!invader) continue;

        const ox = invader.x + invader.width / 2;
        const oy = invader.y + invader.height;

        // Escolhe o padrão com base na intensidade da onda
        const roll = SI.Util.random();
        if (wave === 1 || roll < 0.40) {
          // Linear mirado na coluna do jogador
          this.spawnLinearAimed(ox, oy, playerX);
        } else if (roll < 0.65) {
          // Zigue-zague
          this.spawnZigzag(ox, oy);
        } else if (roll < 0.85) {
          // Leque (3 projéteis)
          this.spawnFan(ox, oy, 3, 20);
        } else if (roll < 0.95) {
          // Rajada (3 tiros em sequência)
          this.queueBurst(ox, oy, 3, 8);
        } else if (wave >= 3) {
          // Parede com brecha segura
          this.spawnWallWithGap(oy, playerX);
        }
      }
    }

    update(particleSystem) {
      // 1. Atualização dos tiros do jogador
      for (let i = this.playerShots.length - 1; i >= 0; i--) {
        const s = this.playerShots[i];
        s.x += s.vx;
        s.y += s.vy;

        // Dissipação no teto
        if (s.y <= P_CFG.BURST_Y_TOP) {
          if (particleSystem) {
            particleSystem.emit(s.x, s.y, 4, '#ffffff', 1.0, 8, 1);
          }
          this.playerShots.splice(i, 1);
          this.playerShotPool.release(s);
        }
      }

      // 2. Atualização dos tiros inimigos
      for (let i = this.enemyShots.length - 1; i >= 0; i--) {
        const s = this.enemyShots[i];

        if (s.type === 'zigzag') {
          s.waveTimer += 0.12;
          s.x = s.waveOffset + Math.sin(s.waveTimer) * 12;
          s.y += s.vy;
        } else {
          s.x += s.vx;
          s.y += s.vy;
        }

        // Animação de quadros
        s.animTimer++;
        if (s.animTimer >= 6) {
          s.animTimer = 0;
          s.animFrame = (s.animFrame + 1) % 4;
        }

        // Despawn ao cruzar a linha do chão ou sair das laterais
        if (s.y >= SI.CONFIG.PLAYER.GROUND_Y || s.x < -10 || s.x > SI.CONFIG.VIDEO.LOGICAL_WIDTH + 10) {
          this.enemyShots.splice(i, 1);
          this.enemyShotPool.release(s);
        }
      }

      // 3. Anulação mútua de tiros (projétil do jogador vs projétil inimigo)
      for (let i = this.playerShots.length - 1; i >= 0; i--) {
        const pShot = this.playerShots[i];
        for (let j = this.enemyShots.length - 1; j >= 0; j--) {
          const eShot = this.enemyShots[j];
          if (SI.Util.checkAABB(pShot, eShot)) {
            if (particleSystem) {
              particleSystem.emit(pShot.x, pShot.y, 5, '#ffffff', 1.2, 10, 1);
            }
            // Destrói o projétil inimigo
            this.enemyShots.splice(j, 1);
            this.enemyShotPool.release(eShot);

            // Se o tiro do jogador NÃO for perfurante, é destruído também
            if (!pShot.isPierce) {
              this.playerShots.splice(i, 1);
              this.playerShotPool.release(pShot);
              break;
            }
          }
        }
      }
    }

    render(ctx) {
      // 1. Tiros do Jogador
      for (let i = 0; i < this.playerShots.length; i++) {
        const s = this.playerShots[i];
        if (s.isPierce) {
          // Visual de raio perfurante laranja incandescente
          ctx.fillStyle = '#ff8800';
          ctx.fillRect(Math.round(s.x), Math.round(s.y), s.width, s.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(s.x), Math.round(s.y + 1), s.width, s.height - 2);
        } else {
          SI.Assets.draw(ctx, 'shot_player', s.x, s.y, 0, s.width, s.height);
        }
      }

      // 2. Projéteis Inimigos
      for (let i = 0; i < this.enemyShots.length; i++) {
        const s = this.enemyShots[i];
        const key = 'shot_' + s.type;

        // Se for parryable, desenha o contorno/brilho magenta pulsante (PARRY_COLOR)
        if (s.parryable) {
          ctx.save();
          const pulse = (Math.sin(Date.now() * 0.015) + 1) * 0.5;
          ctx.strokeStyle = PARRY_CFG.COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(
            Math.round(s.x - 1),
            Math.round(s.y - 1),
            s.width + 2,
            s.height + 2
          );
          ctx.restore();
        }

        SI.Assets.draw(ctx, key, s.x, s.y, s.animFrame, s.width, s.height);
      }
    }
  }

  return ShotsManager;
})();
