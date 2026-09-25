/**
 * js/entities/ufo.js - Nave Mistério (UFO) do topo da tela.
 * Surge a cada ~25s (com >= 8 invasores vivos), alterna sentido,
 * implementa o cálculo de 300 pontos (23º tiro e a cada 15) e sempre dropa um item comum.
 * Namespace global: window.SI.UFO
 */

window.SI = window.SI || {};

window.SI.UFO = (function() {
  const CFG = SI.CONFIG.UFO;

  class UFO {
    constructor() {
      this.reset();
    }

    reset() {
      this.active = false;
      this.x = -30;
      this.y = CFG.Y;
      this.width = CFG.WIDTH;
      this.height = CFG.HEIGHT;
      this.speed = CFG.SPEED;
      this.direction = 1; // 1 = esquerda->direita, -1 = direita->esquerda
      this.spawnTimer = CFG.SPAWN_INTERVAL_FRAMES;
      this.pointsDisplayTimer = 0;
      this.pointsAwarded = 0;
      this.pointsX = 0;
      this.pointsY = 0;
      this.explodingTimer = 0;
      SI.Audio.stopUfoSound();
    }

    update(livingInvadersCount) {
      if (this.pointsDisplayTimer > 0) this.pointsDisplayTimer--;
      if (this.explodingTimer > 0) this.explodingTimer--;

      if (!this.active) {
        if (livingInvadersCount >= CFG.MIN_INVADERS_ALIVE) {
          this.spawnTimer--;
          if (this.spawnTimer <= 0) {
            this.spawn();
          }
        }
        return;
      }

      this.x += this.direction * this.speed;

      // Despawn ao sair completamente da tela
      if (
        (this.direction === 1 && this.x > SI.CONFIG.VIDEO.LOGICAL_WIDTH + 10) ||
        (this.direction === -1 && this.x < -30)
      ) {
        this.despawn();
      }
    }

    spawn() {
      this.active = true;
      this.explodingTimer = 0;
      this.direction = -this.direction;

      if (this.direction === 1) {
        this.x = -CFG.WIDTH;
      } else {
        this.x = SI.CONFIG.VIDEO.LOGICAL_WIDTH;
      }

      SI.Audio.startUfoSound();
    }

    despawn() {
      this.active = false;
      this.spawnTimer = CFG.SPAWN_INTERVAL_FRAMES;
      SI.Audio.stopUfoSound();
    }

    calculatePoints(playerShotCountInWave) {
      // Regra clássica do arcade: 300 pontos no 23º tiro e a cada 15 tiros subsequentes
      if (playerShotCountInWave === 23 || (playerShotCountInWave > 23 && (playerShotCountInWave - 23) % 15 === 0)) {
        return 300;
      }
      const tableIndex = (playerShotCountInWave - 1) % CFG.POINTS_TABLE.length;
      return CFG.POINTS_TABLE[Math.max(0, tableIndex)];
    }

    hit(playerShotCountInWave) {
      if (!this.active) return 0;

      const pts = this.calculatePoints(playerShotCountInWave);
      this.pointsAwarded = pts;
      this.pointsX = this.x;
      this.pointsY = this.y;
      this.pointsDisplayTimer = CFG.SCORE_DISPLAY_FRAMES;
      this.explodingTimer = 16;

      this.active = false;
      this.spawnTimer = CFG.SPAWN_INTERVAL_FRAMES;
      SI.Audio.stopUfoSound();
      SI.Audio.playInvaderExplosion();

      return pts;
    }

    render(ctx) {
      if (this.active) {
        SI.Assets.draw(ctx, 'ufo', this.x, this.y, 0, this.width, this.height);
      } else if (this.explodingTimer > 0) {
        SI.Assets.draw(ctx, 'ufo_death', this.pointsX, this.pointsY, 0, 21, 8);
      }

      if (this.pointsDisplayTimer > 0) {
        ctx.save();
        ctx.fillStyle = '#ff3344';
        ctx.font = '7px monospace';
        ctx.fillText(String(this.pointsAwarded), Math.round(this.pointsX), Math.round(this.pointsY + 7));
        ctx.restore();
      }
    }
  }

  return UFO;
})();
