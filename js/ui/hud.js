/**
 * js/ui/hud.js - Interface visual inspirada no HUD de Gradius III (barra de status metálica).
 * Exibe vidas, score, hi-score, onda, medidor de carga do Especial com brilho dourado ao carregar,
 * até 2 slots de itens comuns com barra de tempo restante e barra do chefe ancorada no topo.
 * Renderização em Canvas para máxima fidelidade e sincronia com o DOM.
 * Namespace global: window.SI.HUD
 */

window.SI = window.SI || {};

window.SI.HUD = (function() {
  const VIDEO_CFG = SI.CONFIG.VIDEO;
  const STRINGS = SI.CONFIG.STRINGS;

  class HUD {
    constructor() {
      // Elementos do DOM (se presentes)
      this.domContainer = document.getElementById('gradius-hud');
      this.domBossBar = document.getElementById('boss-hp-bar');
      this.domBossContainer = document.getElementById('boss-hp-container');
    }

    render(ctx, gameState) {
      const { player, score, hiScore, wave, boss, state } = gameState;

      ctx.save();

      // 1. Cabeçalho de Pontuação no Topo (Grade Lógica)
      this.renderTopHeader(ctx, score, hiScore, wave);

      // 2. Barra de Vida do Chefe no Topo (apenas em BOSS_FIGHT)
      if (state === 'BOSS_FIGHT' || state === 'BOSS_DEATH') {
        this.renderBossHealthBar(ctx, boss);
      }

      // 3. Barra de Status Inferior Estilo Gradius III (Y = 236 até 256)
      this.renderBottomStatusBar(ctx, player, wave);

      ctx.restore();
    }

    renderTopHeader(ctx, score, hiScore, wave) {
      ctx.font = '6px "Courier New", ui-monospace, monospace';
      ctx.textBaseline = 'top';

      // SCORE
      ctx.fillStyle = '#22e6ff';
      ctx.textAlign = 'left';
      ctx.fillText(STRINGS.SCORE_HEADER, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(score).padStart(5, '0'), 12, 12);

      // HI-SCORE
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText(STRINGS.HI_SCORE_HEADER, 112, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(hiScore).padStart(5, '0'), 112, 12);

      // ONDA
      ctx.fillStyle = '#33d17a';
      ctx.textAlign = 'right';
      ctx.fillText(STRINGS.WAVE_HEADER, 212, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(wave).padStart(2, '0'), 212, 12);
    }

    renderBossHealthBar(ctx, boss) {
      if (!boss || !boss.active) return;

      const barW = 140;
      const barH = 5;
      const x = (VIDEO_CFG.LOGICAL_WIDTH - barW) / 2;
      const y = 20;

      // Moldura chanfrada
      ctx.fillStyle = '#05030f';
      ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
      ctx.strokeStyle = '#22e6ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2, y - 2, barW + 4, barH + 4);

      // Cor da fase atual (1: Verde, 2: Amarelo, 3: Vermelho)
      const phase = boss.getPhase();
      let fillColor = '#33d17a';
      if (phase === 2) fillColor = '#ffd23f';
      else if (phase === 3) fillColor = '#ff3344';

      const fillW = Math.max(0, (boss.hp / boss.maxHp) * barW);
      ctx.fillStyle = fillColor;
      ctx.fillRect(x, y, fillW, barH);

      // Rótulo
      ctx.fillStyle = '#ffffff';
      ctx.font = '5px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${STRINGS.BOSS_HP} [FASE ${phase}] - ${Math.ceil(boss.hp)}/${boss.maxHp}`, 112, y - 8);
    }

    renderBottomStatusBar(ctx, player, wave) {
      const barY = 236;
      const barH = 20;
      const w = VIDEO_CFG.LOGICAL_WIDTH;

      // Fundo metálico escuro com bisel (#05030f -> #140a2e)
      ctx.fillStyle = '#0b061c';
      ctx.fillRect(0, barY, w, barH);

      // Linha superior chanfrada ciano neon
      ctx.fillStyle = '#22e6ff';
      ctx.fillRect(0, barY, w, 1);

      // --- Bloco 1: Vidas (Esquerda) ---
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${player.lives}x`, 6, barY + 7);
      SI.Assets.draw(ctx, 'player', 18, barY + 5, 0, 11, 7);

      // --- Bloco 2: Medidor de Carga do Especial (Centro) ---
      this.renderSpecialMeter(ctx, player, 42, barY + 3);

      // --- Bloco 3: Slots de Itens Comuns Ativos (Direita) ---
      this.renderItemSlots(ctx, player, 148, barY + 3);
    }

    renderSpecialMeter(ctx, player, x, y) {
      const spec = player.equippedSpecial;
      if (!spec) return;

      const meterW = 54;
      const meterH = 12;

      // Moldura metálica com cor do tier
      ctx.fillStyle = '#140a2e';
      ctx.fillRect(x, y, meterW, meterH);
      ctx.strokeStyle = spec.color || '#9aa0a6';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, meterW, meterH);

      // Ícone do especial
      const assetKey = 'special_' + spec.type;
      SI.Assets.draw(ctx, assetKey, x + 2, y + 2, 0, 8, 8);

      // Barra de progresso da carga
      const req = player.getRequiredSpecialCharge();
      const cur = player.specialCharge;
      const ratio = Math.min(1.0, cur / req);
      const isReady = player.isSpecialReady();

      const barX = x + 12;
      const barY = y + 2;
      const barW = meterW - 14;
      const barH = 4;

      ctx.fillStyle = '#05030f';
      ctx.fillRect(barX, barY, barW, barH);

      // Se pronto: barra brilha em dourado e pulsa
      if (isReady) {
        const pulse = (Math.sin(Date.now() * 0.01) + 1) * 0.5;
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(barX, barY, barW, barH);

        // Texto pulsante "[X] PRONTO!"
        ctx.fillStyle = pulse > 0.3 ? '#ffd23f' : '#ffffff';
        ctx.font = '5px "Courier New", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText('[X] PRONTO!', barX, y + 8);
      } else {
        ctx.fillStyle = '#22e6ff';
        ctx.fillRect(barX, barY, barW * ratio, barH);

        ctx.fillStyle = '#9aa0a6';
        ctx.font = '5px "Courier New", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${cur}/${req}`, barX, y + 8);
      }
    }

    renderItemSlots(ctx, player, startX, y) {
      const activeKeys = Object.keys(player.activeItems);
      const slotW = 34;
      const slotH = 12;

      for (let i = 0; i < 2; i++) {
        const sx = startX + i * (slotW + 3);
        const type = activeKeys[i];

        ctx.fillStyle = '#140a2e';
        ctx.fillRect(sx, y, slotW, slotH);

        if (type) {
          const item = player.activeItems[type];
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, y, slotW, slotH);

          // Ícone
          SI.Assets.draw(ctx, 'item_' + type, sx + 2, y + 2, 0, 8, 8);

          // Barra de tempo restante
          const remainRatio = item.timer / item.maxDuration;
          ctx.fillStyle = '#05030f';
          ctx.fillRect(sx + 12, y + 3, 18, 3);
          ctx.fillStyle = item.color;
          ctx.fillRect(sx + 12, y + 3, 18 * remainRatio, 3);

          // Rótulo abreviado
          ctx.fillStyle = '#ffffff';
          ctx.font = '4px "Courier New", ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(type.toUpperCase().substring(0, 4), sx + 12, y + 8);
        } else {
          // Slot vazio com moldura cinza tracejada
          ctx.strokeStyle = '#2a1a4a';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, y, slotW, slotH);
          ctx.fillStyle = '#443366';
          ctx.font = '5px "Courier New", ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('-', sx + slotW / 2, y + 4);
        }
      }
    }
  }

  return HUD;
})();
