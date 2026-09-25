/**
 * js/assets.js - Manifesto de assets, carregador seguro e gerador de placeholders procedurais.
 * Totalmente seguro para execução via file:// (sem tainting) e tolerante a ausência total de imagens.
 * Namespace global: window.SI.Assets
 */

window.SI = window.SI || {};

window.SI.Assets = (function() {
  const MANIFEST = {
    player:          { src: 'assets/player.png',          w: 13, h: 8,  frames: 1, fps: 0 },
    player_death:    { src: 'assets/player_death.png',    w: 15, h: 8,  frames: 2, fps: 5 },
    invader_small:   { src: 'assets/invader_small.png',   w: 8,  h: 8,  frames: 2, fps: 2 },
    invader_medium:  { src: 'assets/invader_medium.png',  w: 11, h: 8,  frames: 2, fps: 2 },
    invader_large:   { src: 'assets/invader_large.png',   w: 12, h: 8,  frames: 2, fps: 2 },
    invader_death:   { src: 'assets/invader_death.png',   w: 13, h: 8,  frames: 1, fps: 0 },
    ufo:             { src: 'assets/ufo.png',             w: 16, h: 8,  frames: 1, fps: 0 },
    ufo_death:       { src: 'assets/ufo_death.png',       w: 21, h: 8,  frames: 1, fps: 0 },
    bunker:          { src: 'assets/bunker.png',          w: 22, h: 16, frames: 1, fps: 0 },
    shot_player:     { src: 'assets/shot_player.png',     w: 1,  h: 4,  frames: 1, fps: 0 },
    shot_linear:     { src: 'assets/shot_linear.png',     w: 3,  h: 7,  frames: 4, fps: 8 },
    shot_zigzag:     { src: 'assets/shot_zigzag.png',     w: 3,  h: 7,  frames: 4, fps: 8 },
    shot_fan:        { src: 'assets/shot_fan.png',        w: 3,  h: 7,  frames: 4, fps: 8 },
    shot_wall:       { src: 'assets/shot_wall.png',       w: 3,  h: 7,  frames: 4, fps: 8 },
    shot_spiral:     { src: 'assets/shot_spiral.png',     w: 4,  h: 4,  frames: 4, fps: 8 },
    item_pierce:     { src: 'assets/item_pierce.png',     w: 8,  h: 8,  frames: 1, fps: 0 },
    item_rapid:      { src: 'assets/item_rapid.png',      w: 8,  h: 8,  frames: 1, fps: 0 },
    item_triple:     { src: 'assets/item_triple.png',     w: 8,  h: 8,  frames: 1, fps: 0 },
    special_laser:   { src: 'assets/special_laser.png',   w: 8,  h: 8,  frames: 1, fps: 0 },
    special_bomb:    { src: 'assets/special_bomb.png',    w: 8,  h: 8,  frames: 1, fps: 0 },
    boss:            { src: 'assets/boss.png',            w: 48, h: 24, frames: 2, fps: 3 },
    boss_shot:       { src: 'assets/boss_shot.png',       w: 4,  h: 6,  frames: 2, fps: 8 },
    background:      { src: 'assets/background.png',      w: 224,h: 256,frames: 1, fps: 0 },
    laser:           { src: 'assets/laser.png',           w: 39, h: 256,frames: 1, fps: 0 },
    hud_panel_frame: { src: 'assets/hud_panel_frame.png', w: 224,h: 24, frames: 1, fps: 0 }
  };

  const _images = {};
  const _warnedMissing = {};
  let _loadedCount = 0;
  let _totalCount = 0;
  let _allDone = false;

  function init(onComplete) {
    const keys = Object.keys(MANIFEST);
    _totalCount = keys.length;

    if (_totalCount === 0) {
      _allDone = true;
      if (onComplete) onComplete();
      return;
    }

    keys.forEach(key => {
      const def = MANIFEST[key];
      const img = new Image();

      img.onload = function() {
        _images[key] = { img: img, loaded: true, def: def };
        _loadedCount++;
        checkCompletion(onComplete);
      };

      img.onerror = function() {
        _images[key] = { img: null, loaded: false, def: def };
        if (!_warnedMissing[key]) {
          console.warn(`[SI Assets] Textura ausente para "${key}" (${def.src}). Usando placeholder procedural.`);
          _warnedMissing[key] = true;
        }
        _loadedCount++;
        checkCompletion(onComplete);
      };

      img.src = def.src;
    });
  }

  function checkCompletion(onComplete) {
    if (_loadedCount >= _totalCount && !_allDone) {
      _allDone = true;
      if (onComplete) onComplete();
    }
  }

  function isReady() {
    return _allDone;
  }

  function getManifestDef(key) {
    return MANIFEST[key] || null;
  }

  function draw(ctx, key, x, y, frameIndex = 0, customW = null, customH = null) {
    const asset = _images[key];
    const def = MANIFEST[key];
    const w = customW !== null ? customW : (def ? def.w : 8);
    const h = customH !== null ? customH : (def ? def.h : 8);

    if (asset && asset.loaded && asset.img) {
      const numFrames = def.frames || 1;
      const safeFrame = frameIndex % numFrames;
      const frameW = asset.img.width / numFrames;
      const frameH = asset.img.height;

      ctx.drawImage(
        asset.img,
        safeFrame * frameW, 0, frameW, frameH,
        Math.round(x), Math.round(y), w, h
      );
    } else {
      drawPlaceholder(ctx, key, Math.round(x), Math.round(y), w, h, frameIndex);
    }
  }

  function drawPlaceholder(ctx, key, x, y, w, h, frameIndex) {
    ctx.save();

    switch (key) {
      case 'player': {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(x + 5, y, 3, 2);
        ctx.fillRect(x + 4, y + 2, 5, 2);
        ctx.fillRect(x + 1, y + 4, 11, 2);
        ctx.fillRect(x, y + 6, 13, 2);
        break;
      }

      case 'player_death': {
        ctx.fillStyle = (frameIndex % 2 === 0) ? '#00ff00' : '#ff3344';
        ctx.fillRect(x + 1, y + 2, 4, 2);
        ctx.fillRect(x + 9, y + 1, 4, 2);
        ctx.fillRect(x + 2, y + 5, 11, 2);
        ctx.fillRect(x + 6, y + 3, 3, 2);
        break;
      }

      case 'invader_small': {
        ctx.fillStyle = '#ffffff';
        if (frameIndex % 2 === 0) {
          ctx.fillRect(x + 3, y, 2, 1);
          ctx.fillRect(x + 2, y + 1, 4, 1);
          ctx.fillRect(x + 1, y + 2, 6, 1);
          ctx.fillRect(x, y + 3, 2, 1); ctx.fillRect(x + 3, y + 3, 2, 1); ctx.fillRect(x + 6, y + 3, 2, 1);
          ctx.fillRect(x, y + 4, 8, 1);
          ctx.fillRect(x + 2, y + 5, 1, 1); ctx.fillRect(x + 5, y + 5, 1, 1);
          ctx.fillRect(x + 1, y + 6, 1, 1); ctx.fillRect(x + 6, y + 6, 1, 1);
          ctx.fillRect(x, y + 7, 1, 1); ctx.fillRect(x + 7, y + 7, 1, 1);
        } else {
          ctx.fillRect(x + 3, y, 2, 1);
          ctx.fillRect(x + 2, y + 1, 4, 1);
          ctx.fillRect(x + 1, y + 2, 6, 1);
          ctx.fillRect(x, y + 3, 2, 1); ctx.fillRect(x + 3, y + 3, 2, 1); ctx.fillRect(x + 6, y + 3, 2, 1);
          ctx.fillRect(x, y + 4, 8, 1);
          ctx.fillRect(x + 2, y + 5, 4, 1);
          ctx.fillRect(x + 1, y + 6, 2, 1); ctx.fillRect(x + 5, y + 6, 2, 1);
          ctx.fillRect(x + 2, y + 7, 1, 1); ctx.fillRect(x + 5, y + 7, 1, 1);
        }
        break;
      }

      case 'invader_medium': {
        ctx.fillStyle = '#22e6ff';
        if (frameIndex % 2 === 0) {
          ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 8, y, 1, 1);
          ctx.fillRect(x + 3, y + 1, 1, 1); ctx.fillRect(x + 7, y + 1, 1, 1);
          ctx.fillRect(x + 2, y + 2, 7, 1);
          ctx.fillRect(x + 1, y + 3, 2, 1); ctx.fillRect(x + 4, y + 3, 3, 1); ctx.fillRect(x + 8, y + 3, 2, 1);
          ctx.fillRect(x, y + 4, 11, 1);
          ctx.fillRect(x, y + 5, 1, 1); ctx.fillRect(x + 2, y + 5, 7, 1); ctx.fillRect(x + 10, y + 5, 1, 1);
          ctx.fillRect(x, y + 6, 1, 1); ctx.fillRect(x + 2, y + 6, 1, 1); ctx.fillRect(x + 8, y + 6, 1, 1); ctx.fillRect(x + 10, y + 6, 1, 1);
          ctx.fillRect(x + 3, y + 7, 2, 1); ctx.fillRect(x + 6, y + 7, 2, 1);
        } else {
          ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x + 8, y, 1, 1);
          ctx.fillRect(x, y + 1, 1, 1); ctx.fillRect(x + 10, y + 1, 1, 1);
          ctx.fillRect(x, y + 2, 1, 1); ctx.fillRect(x + 2, y + 2, 7, 1); ctx.fillRect(x + 10, y + 2, 1, 1);
          ctx.fillRect(x, y + 3, 3, 1); ctx.fillRect(x + 4, y + 3, 3, 1); ctx.fillRect(x + 8, y + 3, 3, 1);
          ctx.fillRect(x, y + 4, 11, 1);
          ctx.fillRect(x + 2, y + 5, 7, 1);
          ctx.fillRect(x + 1, y + 6, 1, 1); ctx.fillRect(x + 9, y + 6, 1, 1);
          ctx.fillRect(x, y + 7, 1, 1); ctx.fillRect(x + 10, y + 7, 1, 1);
        }
        break;
      }

      case 'invader_large': {
        ctx.fillStyle = '#33d17a';
        if (frameIndex % 2 === 0) {
          ctx.fillRect(x + 4, y, 4, 1);
          ctx.fillRect(x + 1, y + 1, 10, 1);
          ctx.fillRect(x, y + 2, 12, 1);
          ctx.fillRect(x, y + 3, 3, 1); ctx.fillRect(x + 5, y + 3, 2, 1); ctx.fillRect(x + 9, y + 3, 3, 1);
          ctx.fillRect(x, y + 4, 12, 1);
          ctx.fillRect(x + 3, y + 5, 6, 1);
          ctx.fillRect(x + 2, y + 6, 2, 1); ctx.fillRect(x + 8, y + 6, 2, 1);
          ctx.fillRect(x + 1, y + 7, 2, 1); ctx.fillRect(x + 9, y + 7, 2, 1);
        } else {
          ctx.fillRect(x + 4, y, 4, 1);
          ctx.fillRect(x + 1, y + 1, 10, 1);
          ctx.fillRect(x, y + 2, 12, 1);
          ctx.fillRect(x, y + 3, 3, 1); ctx.fillRect(x + 5, y + 3, 2, 1); ctx.fillRect(x + 9, y + 3, 3, 1);
          ctx.fillRect(x, y + 4, 12, 1);
          ctx.fillRect(x + 2, y + 5, 8, 1);
          ctx.fillRect(x + 3, y + 6, 1, 1); ctx.fillRect(x + 8, y + 6, 1, 1);
          ctx.fillRect(x + 2, y + 7, 1, 1); ctx.fillRect(x + 9, y + 7, 1, 1);
        }
        break;
      }

      case 'invader_death': {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y, 1, 2);
        ctx.fillRect(x + 6, y + 6, 1, 2);
        ctx.fillRect(x, y + 3, 2, 1);
        ctx.fillRect(x + 11, y + 3, 2, 1);
        ctx.fillRect(x + 2, y + 1, 2, 2);
        ctx.fillRect(x + 9, y + 1, 2, 2);
        ctx.fillRect(x + 2, y + 5, 2, 2);
        ctx.fillRect(x + 9, y + 5, 2, 2);
        ctx.fillRect(x + 5, y + 3, 3, 2);
        break;
      }

      case 'ufo': {
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(x + 5, y, 6, 1);
        ctx.fillRect(x + 3, y + 1, 10, 1);
        ctx.fillRect(x + 2, y + 2, 12, 1);
        ctx.fillRect(x + 1, y + 3, 14, 1);
        ctx.fillRect(x, y + 4, 16, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 3, y + 3, 2, 1);
        ctx.fillRect(x + 7, y + 3, 2, 1);
        ctx.fillRect(x + 11, y + 3, 2, 1);
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(x + 2, y + 6, 2, 1);
        ctx.fillRect(x + 6, y + 6, 4, 1);
        ctx.fillRect(x + 12, y + 6, 2, 1);
        break;
      }

      case 'ufo_death': {
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 5, y + 3, w - 10, h - 6);
        break;
      }

      case 'bunker': {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(x + 4, y, 14, 4);
        ctx.fillRect(x + 2, y + 4, 18, 4);
        ctx.fillRect(x, y + 8, 22, 4);
        ctx.fillRect(x, y + 12, 6, 4);
        ctx.fillRect(x + 16, y + 12, 6, 4);
        break;
      }

      case 'shot_player': {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w, h);
        break;
      }

      case 'shot_linear':
      case 'shot_fan':
      case 'shot_wall': {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y, 1, h);
        const off = (frameIndex % 4);
        ctx.fillRect(x, y + off * 2, 3, 1);
        break;
      }

      case 'shot_zigzag': {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < h; i++) {
          const sx = ((i + frameIndex) % 2 === 0) ? 0 : 2;
          ctx.fillRect(x + sx, y + i, 1, 1);
        }
        break;
      }

      case 'shot_spiral': {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y, 2, 4);
        ctx.fillRect(x, y + 1, 4, 2);
        break;
      }

      case 'item_pierce': {
        ctx.fillStyle = '#140a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ff8800';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 2, 2, 4);
        ctx.fillRect(x + 4, y + 2, 2, 2);
        break;
      }

      case 'item_rapid': {
        ctx.fillStyle = '#140a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2, y + 2, 2, 4);
        ctx.fillRect(x + 4, y + 2, 2, 2);
        ctx.fillRect(x + 4, y + 4, 2, 2);
        break;
      }

      case 'item_triple': {
        ctx.fillStyle = '#140a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#22e6ff';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2, y + 2, 4, 1);
        ctx.fillRect(x + 3, y + 3, 2, 3);
        break;
      }

      case 'special_laser': {
        ctx.fillStyle = '#140a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ff2fd0';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y + 2, 2, 4);
        ctx.fillRect(x + 4, y + 5, 2, 1);
        break;
      }

      case 'special_bomb': {
        ctx.fillStyle = '#140a2e';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2, y + 2, 2, 4);
        ctx.fillRect(x + 4, y + 2, 2, 2);
        ctx.fillRect(x + 4, y + 4, 2, 2);
        break;
      }

      case 'boss': {
        ctx.fillStyle = '#551177';
        ctx.fillRect(x + 12, y, 24, 4);
        ctx.fillRect(x + 6, y + 4, 36, 4);
        ctx.fillRect(x + 2, y + 8, 44, 6);
        ctx.fillRect(x, y + 14, 48, 6);
        ctx.fillRect(x + 4, y + 20, 10, 4);
        ctx.fillRect(x + 34, y + 20, 10, 4);

        ctx.fillStyle = '#ff2fd0';
        ctx.fillRect(x + 2, y + 18, 4, 6);
        ctx.fillRect(x + 42, y + 18, 4, 6);

        ctx.fillStyle = (frameIndex % 2 === 0) ? '#22e6ff' : '#ffd23f';
        ctx.fillRect(x + 20, y + 10, 8, 6);
        break;
      }

      case 'boss_shot': {
        ctx.fillStyle = (frameIndex % 2 === 0) ? '#ff3344' : '#ffd23f';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        break;
      }

      case 'background': {
        ctx.fillStyle = '#05030f';
        ctx.fillRect(x, y, w, h);
        break;
      }

      case 'laser': {
        ctx.fillStyle = '#22e6ff';
        ctx.fillRect(x, y, w, h);
        break;
      }

      default: {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(x, y, w, h);
        break;
      }
    }

    ctx.restore();
  }

  return {
    MANIFEST,
    init,
    isReady,
    getManifestDef,
    draw
  };
})();
