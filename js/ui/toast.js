/**
 * js/ui/toast.js - Sistema de notificações (Toasts) não-bloqueantes para coleta de itens e especiais.
 * Exibe no topo-centro por ~2.5s: [Ícone com borda no tier] NOME (Tier N — Nome) — descrição.
 * Suporta fila para drops simultâneos sem sobreposição ou travamentos.
 * Namespace global: window.SI.Toast
 */

window.SI = window.SI || {};

window.SI.Toast = (function() {
  class ToastManager {
    constructor() {
      this.queue = [];
      this.currentToast = null;
      this.displayTimer = 0;
      this.maxDisplayTime = 150; // 2.5s a 60 Hz (150 frames)
      this.fadeTimer = 15;       // 15 frames de fade in / out
      this.domContainer = document.getElementById('toast-container');
    }

    reset() {
      this.queue.length = 0;
      this.currentToast = null;
      this.displayTimer = 0;
      if (this.domContainer) {
        this.domContainer.innerHTML = '';
      }
    }

    showToast(data) {
      // data: { iconKey, name, tierNumber, tierName, tierColor, description }
      this.queue.push(data);
    }

    update() {
      if (!this.currentToast && this.queue.length > 0) {
        this.currentToast = this.queue.shift();
        this.displayTimer = this.maxDisplayTime;
      }

      if (this.currentToast) {
        this.displayTimer--;
        if (this.displayTimer <= 0) {
          this.currentToast = null;
        }
      }
    }

    render(ctx) {
      if (!this.currentToast) return;

      const t = this.currentToast;
      const w = 180;
      const h = 18;
      const x = (SI.CONFIG.VIDEO.LOGICAL_WIDTH - w) / 2;
      const y = 28;

      // Cálculo de alpha para entrada e saída suaves
      let alpha = 1.0;
      if (this.displayTimer > this.maxDisplayTime - this.fadeTimer) {
        alpha = (this.maxDisplayTime - this.displayTimer) / this.fadeTimer;
      } else if (this.displayTimer < this.fadeTimer) {
        alpha = this.displayTimer / this.fadeTimer;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      // Fundo escuro com bisel chanfrado
      ctx.fillStyle = '#0b061c';
      ctx.fillRect(x, y, w, h);

      // Moldura na cor do Tier de qualidade
      ctx.strokeStyle = t.tierColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      // Ícone com borda colorida
      ctx.strokeRect(x + 2, y + 2, 14, 14);
      SI.Assets.draw(ctx, t.iconKey, x + 5, y + 5, 0, 8, 8);

      // Linha 1: NOME (Tier N — Nome do Tier)
      ctx.fillStyle = t.tierColor;
      ctx.font = '5px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${t.name} (Tier ${t.tierNumber} — ${t.tierName})`, x + 20, y + 6);

      // Linha 2: Descrição de uma linha
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '4.5px "Courier New", ui-monospace, monospace';
      // Trunca para caber na grade lógica se necessário
      const maxDescLen = 42;
      const shortDesc = t.description.length > maxDescLen
        ? t.description.substring(0, maxDescLen) + '...'
        : t.description;
      ctx.fillText(shortDesc, x + 20, y + 13);

      ctx.restore();
    }
  }

  return ToastManager;
})();
