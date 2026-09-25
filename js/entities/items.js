/**
 * js/entities/items.js - Sistema de itens com 5 tiers de qualidade e drops determinísticos a cada 20 abates.
 * Controla cápsulas em queda, sorteio ponderado de tiers, duração escalada por multiplicador
 * e exibição de toast não-bloqueante na coleta.
 * Namespace global: window.SI.Items
 */

window.SI = window.SI || {};

window.SI.Items = (function() {
  const ITM_CFG = SI.CONFIG.ITEMS;
  const TIER_TABLE = SI.CONFIG.TIER_TABLE;

  class ItemCapsule {
    constructor(type, tierObj, x, y) {
      this.type = type;       // 'pierce', 'rapid', 'triple'
      this.tier = tierObj;    // Objeto do tier com { tier, name, mult, color }
      this.x = x;
      this.y = y;
      this.width = ITM_CFG.WIDTH;
      this.height = ITM_CFG.HEIGHT;
      this.speed = ITM_CFG.FALL_SPEED;
      this.active = true;
    }

    update() {
      // Desce reta e devagar (ref.)
      this.y += this.speed;

      // Some ao sair pelo fundo da tela
      if (this.y > SI.CONFIG.VIDEO.LOGICAL_HEIGHT) {
        this.active = false;
      }
    }

    render(ctx) {
      const assetKey = 'item_' + this.type;

      // Desenha moldura / glow colorido indicando o Tier de qualidade (DECISÃO: sem 5 sprites redundantes)
      ctx.save();
      ctx.strokeStyle = this.tier.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(this.x - 1), Math.round(this.y - 1), this.width + 2, this.height + 2);
      ctx.restore();

      SI.Assets.draw(ctx, assetKey, this.x, this.y, 0, this.width, this.height);
    }
  }

  class ItemsManager {
    constructor() {
      this.capsules = [];

      // Estatísticas de drops por tier para auditoria e modo debug (?debug=1)
      this.stats = {
        total: 0,
        tier0: 0, // Comum
        tier1: 0, // Incomum
        tier2: 0, // Raro
        tier3: 0, // Épico
        tier4: 0  // Lendário
      };
    }

    reset() {
      this.capsules.length = 0;
    }

    update() {
      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        c.update();
        if (!c.active) {
          this.capsules.splice(i, 1);
        }
      }
    }

    // Sorteio ponderado rigoroso segundo os pesos da TIER_TABLE
    rollTier() {
      const picked = SI.Util.weightedChoice(TIER_TABLE);
      this.stats['tier' + picked.tier]++;
      this.stats.total++;
      return picked;
    }

    // Sorteia um tipo comum entre Pierce, Rapid e Triple
    rollType() {
      const types = [
        ITM_CFG.TYPES.PIERCE,
        ITM_CFG.TYPES.RAPID,
        ITM_CFG.TYPES.TRIPLE
      ];
      return SI.Util.randomChoice(types);
    }

    // Drop determinístico acionado pelo contador global de abates (múltiplo de 20)
    spawnDrop(x, y, forcedType = null, forcedTierIndex = null) {
      if (!SI.CONFIG.FEATURES.items) return;

      const type = forcedType || this.rollType();
      const tier = (forcedTierIndex !== null && TIER_TABLE[forcedTierIndex])
        ? TIER_TABLE[forcedTierIndex]
        : this.rollTier();

      const capsule = new ItemCapsule(type, tier, x - ITM_CFG.WIDTH / 2, y);
      this.capsules.push(capsule);
    }

    // Drop garantido pelo UFO destruído (sempre solta item comum)
    dropFromUFO(x, y) {
      if (!SI.CONFIG.FEATURES.items) return;
      this.spawnDrop(x, y);
    }

    // Verifica coleta por contato com o canhão do jogador
    checkPlayerCollection(player, toastManager) {
      if (!player.alive) return;

      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        if (SI.Util.checkAABB(c, player)) {
          // Coletou o item comum!
          player.addItem(c.type, c.tier);

          // Dispara toast não-bloqueante no topo da tela
          if (toastManager) {
            const item = player.activeItems[c.type];
            toastManager.showToast({
              iconKey: 'item_' + c.type,
              name: item.name,
              tierNumber: c.tier.tier,
              tierName: c.tier.name,
              tierColor: c.tier.color,
              description: item.desc
            });
          }

          this.capsules.splice(i, 1);
        }
      }
    }

    render(ctx) {
      for (let i = 0; i < this.capsules.length; i++) {
        this.capsules[i].render(ctx);
      }
    }
  }

  return ItemsManager;
})();
