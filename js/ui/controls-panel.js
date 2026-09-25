/**
 * js/ui/controls-panel.js - Painel de Comandos acessível pela tecla F1 e na tela de título.
 * Gera a tabela Ação -> Tecla(s) dinamicamente a partir do objeto SI.CONFIG.KEYBINDS.
 * Pausa o jogo ao abrir durante a partida e fecha com F1 ou Esc.
 * Namespace global: window.SI.ControlsPanel
 */

window.SI = window.SI || {};

window.SI.ControlsPanel = (function() {
  class ControlsPanel {
    constructor() {
      this.visible = false;
      this.tableData = [];
      this.buildTableData();
    }

    buildTableData() {
      const KB = SI.CONFIG.KEYBINDS;
      const LABELS = SI.CONFIG.KEYBIND_LABELS;
      this.tableData = [];

      for (const action in KB) {
        const codes = KB[action];
        const label = (LABELS && LABELS[action]) || action;

        // Formata os nomes físicos das teclas para exibição amigável
        const friendlyKeys = codes.map(c => this.formatCodeName(c)).join(' ou ');

        this.tableData.push({
          action: label,
          keys: friendlyKeys
        });
      }
    }

    formatCodeName(code) {
      if (code.startsWith('Key')) return code.substring(3);
      if (code.startsWith('Digit')) return code.substring(5);
      if (code.startsWith('Arrow')) return 'Seta ' + code.substring(5);
      if (code === 'Space') return 'Espaço';
      if (code === 'Escape') return 'Esc';
      if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
      return code;
    }

    toggle() {
      this.visible = !this.visible;
      return this.visible;
    }

    open() {
      this.visible = true;
    }

    close() {
      this.visible = false;
    }

    isOpen() {
      return this.visible;
    }

    update() {
      // Se F1 ou Escape forem pressionados enquanto aberto, fecha o painel
      if (this.visible) {
        if (SI.Input.isCodeJustPressed('F1') || SI.Input.isCodeJustPressed('Escape')) {
          this.close();
        }
      }
    }

    render(ctx) {
      if (!this.visible) return;

      const w = 196;
      const h = 200;
      const x = (SI.CONFIG.VIDEO.LOGICAL_WIDTH - w) / 2;
      const y = (SI.CONFIG.VIDEO.LOGICAL_HEIGHT - h) / 2;

      ctx.save();

      // Escurecimento de fundo
      ctx.fillStyle = 'rgba(5, 3, 15, 0.88)';
      ctx.fillRect(0, 0, SI.CONFIG.VIDEO.LOGICAL_WIDTH, SI.CONFIG.VIDEO.LOGICAL_HEIGHT);

      // Caixa principal metálica estilo Gradius III
      ctx.fillStyle = '#0b061c';
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = '#22e6ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      // Linhas decorativas chanfradas
      ctx.strokeStyle = '#ff2fd0';
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

      // Título: COMANDOS
      ctx.fillStyle = '#ffd23f';
      ctx.font = '8px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMANDOS', 112, y + 14);

      // Linha divisória
      ctx.strokeStyle = '#22e6ff';
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 20);
      ctx.lineTo(x + w - 8, y + 20);
      ctx.stroke();

      // Cabeçalho da Tabela
      ctx.fillStyle = '#22e6ff';
      ctx.font = '5px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('AÇÃO', x + 10, y + 30);
      ctx.textAlign = 'right';
      ctx.fillText('TECLA(S)', x + w - 10, y + 30);

      // Linhas da Tabela geradas dinamicamente a partir de KEYBINDS
      ctx.font = '4.5px "Courier New", ui-monospace, monospace';
      let rowY = y + 40;
      const rowHeight = 13;

      for (let i = 0; i < this.tableData.length; i++) {
        const item = this.tableData[i];

        // Efeito zebra suave nas linhas
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(34, 230, 255, 0.05)';
          ctx.fillRect(x + 8, rowY - 2, w - 16, rowHeight - 1);
        }

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(item.action, x + 10, rowY + 6);

        ctx.fillStyle = '#ffd23f';
        ctx.textAlign = 'right';
        ctx.fillText(item.keys, x + w - 10, rowY + 6);

        rowY += rowHeight;
      }

      // Rodapé
      ctx.fillStyle = '#9aa0a6';
      ctx.font = '4.5px "Courier New", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[F1] ou [ESC] para Fechar', 112, y + h - 8);

      ctx.restore();
    }
  }

  return ControlsPanel;
})();
