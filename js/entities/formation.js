/**
 * js/entities/formation.js - Formação clássica de 55 invasores (5 linhas x 11 colunas).
 * Movimento fiel ao arcade original: exatamente UM invasor vivo é atualizado por frame (60 Hz).
 * Aceleração emergente sem tabelas de velocidade.
 * Ciclo de marcha sonoro de 4 notas e detecção de invasão imediata da linha do canhão.
 * Namespace global: window.SI.Formation
 */

window.SI = window.SI || {};

window.SI.Formation = (function() {
  const CFG = SI.CONFIG.FORMATION;

  class Invader {
    constructor(row, col, x, y, type, points) {
      this.row = row;
      this.col = col;
      this.x = x;
      this.y = y;
      this.type = type; // 'invader_small', 'invader_medium', 'invader_large'
      this.points = points;
      this.alive = true;
      this.explodingTimer = 0;
      this.animFrame = 0;

      // Dimensões lógicas exatas
      if (type === 'invader_small') {
        this.width = 8;
        this.height = 8;
      } else if (type === 'invader_medium') {
        this.width = 11;
        this.height = 8;
      } else {
        this.width = 12;
        this.height = 8;
      }
    }
  }

  class Formation {
    constructor() {
      this.invaders = [];
      this.livingInvaders = [];
      this.currentInvaderIndex = 0; // Índice do invasor vivo atual no ciclo de atualização
      this.direction = 1;          // 1 = direita, -1 = esquerda
      this.dropCycleActive = false; // Se o ciclo atual é de descida de 8 px
      this.edgeTriggered = false;   // Se algum invasor tocou a borda durante a varredura
      this.wave = 1;
      this.waveYOffsetIndex = 0;

      this.initWave(1);
    }

    initWave(waveNumber = 1) {
      this.wave = waveNumber;
      this.invaders = [];
      this.livingInvaders = [];
      this.currentInvaderIndex = 0;
      this.direction = 1;
      this.dropCycleActive = false;
      this.edgeTriggered = false;

      // Posição Y inicial da onda conforme ciclo de 8 posições (ref.)
      this.waveYOffsetIndex = (waveNumber - 1) % CFG.WAVE_START_Y_CYCLE.length;
      const startY = CFG.WAVE_START_Y_CYCLE[this.waveYOffsetIndex];
      const startX = CFG.START_X;

      // 5 linhas x 11 colunas = 55 invasores
      for (let r = 0; r < CFG.ROWS; r++) {
        let type = 'invader_large';
        let pts = CFG.POINTS.ROW_BOT;

        if (r === 0) {
          type = 'invader_small';
          pts = CFG.POINTS.ROW_TOP;
        } else if (r === 1 || r === 2) {
          type = 'invader_medium';
          pts = CFG.POINTS.ROW_MID;
        }

        for (let c = 0; c < CFG.COLS; c++) {
          const x = startX + c * CFG.SPACING_X;
          const y = startY + r * CFG.SPACING_Y;
          const invader = new Invader(r, c, x, y, type, pts);
          this.invaders.push(invader);
          this.livingInvaders.push(invader);
        }
      }
    }

    getLivingCount() {
      return this.livingInvaders.length;
    }

    // --- Movimento 1:1 com o Arcade Original ---
    update(bunkers) {
      // 1. Atualiza temporizadores de explosão dos invasores destruídos
      for (let i = 0; i < this.invaders.length; i++) {
        const inv = this.invaders[i];
        if (!inv.alive && inv.explodingTimer > 0) {
          inv.explodingTimer--;
        }
      }

      if (this.livingInvaders.length === 0) return;

      if (this.currentInvaderIndex >= this.livingInvaders.length) {
        this.currentInvaderIndex = 0;
        this.onFullCycleComplete();
      }

      // DECISÃO: Exatamente UM invasor vivo é atualizado a cada frame (60 Hz).
      // A aceleração emerge naturalmente: 55 invasores = 1 passo a cada 55 frames; 1 invasor = 1 passo por frame!
      const invader = this.livingInvaders[this.currentInvaderIndex];
      if (invader && invader.alive) {
        if (this.dropCycleActive) {
          invader.y += CFG.STEP_Y;
          if (bunkers) {
            bunkers.checkInvaderOverlap(invader);
          }
        } else {
          invader.x += this.direction * CFG.STEP_X;

          // Verifica se tocou a borda lateral
          if (
            (this.direction === 1 && invader.x + invader.width >= CFG.MARGIN_RIGHT) ||
            (this.direction === -1 && invader.x <= CFG.MARGIN_LEFT)
          ) {
            this.edgeTriggered = true;
          }
        }

        // Alterna o quadro de animação (2 quadros por passo)
        invader.animFrame = 1 - invader.animFrame;
      }

      // Avança para o próximo invasor vivo no próximo tick
      this.currentInvaderIndex++;
      if (this.currentInvaderIndex >= this.livingInvaders.length) {
        this.currentInvaderIndex = 0;
        this.onFullCycleComplete();
      }
    }

    onFullCycleComplete() {
      // Toca a nota da marcha ao completar o ciclo de todos os vivos
      SI.Audio.playMarchStep();

      if (this.dropCycleActive) {
        this.dropCycleActive = false;
        this.edgeTriggered = false;
      } else if (this.edgeTriggered) {
        this.dropCycleActive = true;
        this.direction = -this.direction;
        this.edgeTriggered = false;
      }
    }

    // Verifica se algum invasor alcançou a linha do canhão (Game Over imediato mesmo com vidas)
    hasReachedCannonLine(cannonY) {
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (inv.y + inv.height >= cannonY) {
          return true;
        }
      }
      return false;
    }

    findLowestInvaderInCol(col) {
      let lowest = null;
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        if (inv.col === col) {
          if (!lowest || inv.y > lowest.y) {
            lowest = inv;
          }
        }
      }
      return lowest;
    }

    findLowestInvaderNearX(targetX) {
      let closest = null;
      let minDiff = Infinity;

      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        const diff = Math.abs((inv.x + inv.width / 2) - targetX);
        if (diff < minDiff) {
          minDiff = diff;
          closest = inv;
        }
      }
      return closest;
    }

    getLowestInvadersAllCols() {
      const result = [];
      for (let c = 0; c < CFG.COLS; c++) {
        const lowest = this.findLowestInvaderInCol(c);
        if (lowest) result.push(lowest);
      }
      return result;
    }

    killInvader(invader) {
      if (!invader.alive) return;
      invader.alive = false;
      invader.explodingTimer = CFG.EXPLOSION_FRAMES;

      const idx = this.livingInvaders.indexOf(invader);
      if (idx !== -1) {
        this.livingInvaders.splice(idx, 1);
        if (this.currentInvaderIndex > idx) {
          this.currentInvaderIndex--;
        }
      }

      SI.Audio.playInvaderExplosion();
    }

    killAll() {
      for (let i = this.livingInvaders.length - 1; i >= 0; i--) {
        const inv = this.livingInvaders[i];
        inv.alive = false;
        inv.explodingTimer = 10;
      }
      this.livingInvaders.length = 0;
      this.currentInvaderIndex = 0;
    }

    render(ctx) {
      // 1. Invasores vivos
      for (let i = 0; i < this.livingInvaders.length; i++) {
        const inv = this.livingInvaders[i];
        SI.Assets.draw(ctx, inv.type, inv.x, inv.y, inv.animFrame, inv.width, inv.height);
      }

      // 2. Explosões temporárias dos destruídos
      for (let i = 0; i < this.invaders.length; i++) {
        const inv = this.invaders[i];
        if (!inv.alive && inv.explodingTimer > 0) {
          SI.Assets.draw(ctx, 'invader_death', inv.x, inv.y, 0, 13, 8);
        }
      }
    }
  }

  return Formation;
})();
