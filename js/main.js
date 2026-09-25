/**
 * js/main.js - Ponto de entrada da aplicação.
 * Inicializa os módulos de entrada, áudio e o núcleo do jogo após o carregamento do DOM.
 * Namespace global: window.SI
 */

window.SI = window.SI || {};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('[SI Main] Elemento #game-canvas não encontrado no documento.');
    return;
  }

  // Inicializa o gerenciador central de entradas
  SI.Input.init();

  // Inicializa o núcleo e loop do jogo
  SI.Game.init(canvas);

  console.log('[SI Main] Invasores Arcade v2 inicializado com sucesso.');
});
