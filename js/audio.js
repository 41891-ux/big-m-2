/**
 * js/audio.js - Sintetizador sonoro em tempo real via Web Audio API.
 * 100% sintetizado via código, zero arquivos de áudio externos.
 * Inclui sons dedicados para marcha dos invasores, tiros, explosões, sirene do UFO,
 * sucesso de Parry (timbre metálico límpido), Bomba Estelar e Super Laser.
 * Namespace global: window.SI.Audio
 */

window.SI = window.SI || {};

window.SI.Audio = (function() {
  let _ctx = null;
  let _masterGain = null;
  let _isMuted = false;
  let _initialized = false;

  // 4 notas clássicas da marcha dos invasores
  const MARCH_FREQS = [175, 156, 139, 123];
  let _marchNoteIndex = 0;

  // Som contínuo da Nave Mistério (UFO)
  let _ufoOsc = null;
  let _ufoGain = null;
  let _ufoInterval = null;

  function init() {
    if (_initialized) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('[SI Audio] Web Audio API não suportada.');
        return;
      }
      _ctx = new AudioContextClass();
      _masterGain = _ctx.createGain();
      _masterGain.gain.setValueAtTime(0.3, _ctx.currentTime);
      _masterGain.connect(_ctx.destination);
      _initialized = true;
    } catch (e) {
      console.warn('[SI Audio] Falha ao inicializar AudioContext:', e);
    }
  }

  function resume() {
    if (!_ctx) init();
    if (_ctx && _ctx.state === 'suspended') {
      _ctx.resume().catch(e => console.warn('[SI Audio] Resume falhou:', e));
    }
  }

  function toggleMute() {
    _isMuted = !_isMuted;
    if (_masterGain && _ctx) {
      _masterGain.gain.setValueAtTime(_isMuted ? 0 : 0.3, _ctx.currentTime);
    }
    return _isMuted;
  }

  function isMuted() {
    return _isMuted;
  }

  // --- 1. Marcha dos Invasores (4 notas em loop) ---
  function playMarchStep() {
    if (!_ctx || _isMuted) return;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();
      const freq = MARCH_FREQS[_marchNoteIndex % MARCH_FREQS.length];
      _marchNoteIndex = (_marchNoteIndex + 1) % MARCH_FREQS.length;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, _ctx.currentTime);

      gain.gain.setValueAtTime(0.2, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      osc.stop(_ctx.currentTime + 0.08);
    } catch (e) {}
  }

  function resetMarch() {
    _marchNoteIndex = 0;
  }

  // --- 2. Tiro do Canhão ---
  function playPlayerShot() {
    if (!_ctx || _isMuted) return;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(950, _ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, _ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      osc.stop(_ctx.currentTime + 0.12);
    } catch (e) {}
  }

  // --- 3. Explosão do Invasor ---
  function playInvaderExplosion() {
    if (!_ctx || _isMuted) return;
    try {
      const bufferSize = _ctx.sampleRate * 0.12;
      const buffer = _ctx.createBuffer(1, bufferSize, _ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = _ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = _ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, _ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, _ctx.currentTime + 0.12);

      const gain = _ctx.createGain();
      gain.gain.setValueAtTime(0.35, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.12);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(_masterGain);

      whiteNoise.start();
    } catch (e) {}
  }

  // --- 4. Explosão do Jogador ---
  function playPlayerExplosion() {
    if (!_ctx || _isMuted) return;
    try {
      const bufferSize = _ctx.sampleRate * 0.75;
      const buffer = _ctx.createBuffer(1, bufferSize, _ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = _ctx.createBufferSource();
      noise.buffer = buffer;

      const osc = _ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, _ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, _ctx.currentTime + 0.75);

      const gain = _ctx.createGain();
      gain.gain.setValueAtTime(0.45, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.75);

      noise.connect(gain);
      osc.connect(gain);
      gain.connect(_masterGain);

      noise.start();
      osc.start();
      osc.stop(_ctx.currentTime + 0.75);
    } catch (e) {}
  }

  // --- 5. Sucesso no Parry (Timbre metálico límpido + ressonância aguda) ---
  function playParrySuccess() {
    if (!_ctx || _isMuted) return;
    try {
      // Tom alto estilo sino metálico / Cuphead parry
      const freqs = [1046.5, 1567.98, 2093.0]; // C6, G6, C7
      freqs.forEach((f, idx) => {
        const osc = _ctx.createOscillator();
        const gain = _ctx.createGain();

        osc.type = (idx === 0) ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f, _ctx.currentTime);

        const startTime = _ctx.currentTime + idx * 0.01;
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

        osc.connect(gain);
        gain.connect(_masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch (e) {}
  }

  // Tentativa de parry no ar (whoosh suave)
  function playParryAttempt() {
    if (!_ctx || _isMuted) return;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, _ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(200, _ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      osc.stop(_ctx.currentTime + 0.08);
    } catch (e) {}
  }

  // --- 6. Coleta de Item / Especial (Acorde ascendente brilhante) ---
  function playItemCollect() {
    if (!_ctx || _isMuted) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = _ctx.createOscillator();
        const gain = _ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, _ctx.currentTime + idx * 0.04);

        const startTime = _ctx.currentTime + idx * 0.04;
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

        osc.connect(gain);
        gain.connect(_masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
    } catch (e) {}
  }

  // --- 7. Especial: Bomba Estelar ---
  function playBombBlast() {
    if (!_ctx || _isMuted) return;
    try {
      // Sub-bass sweep + ruído estrondoso
      const osc = _ctx.createOscillator();
      const oscGain = _ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, _ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, _ctx.currentTime + 0.6);

      oscGain.gain.setValueAtTime(0.5, _ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.6);

      osc.connect(oscGain);
      oscGain.connect(_masterGain);
      osc.start();
      osc.stop(_ctx.currentTime + 0.6);

      // Camada de ruído
      const bufferSize = _ctx.sampleRate * 0.6;
      const buffer = _ctx.createBuffer(1, bufferSize, _ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = _ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = _ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, _ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(60, _ctx.currentTime + 0.6);

      const noiseGain = _ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, _ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.6);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(_masterGain);

      noise.start();
    } catch (e) {}
  }

  // --- 8. Especial: Super Laser (Convergência e Loop do Feixe) ---
  function playLaserCharge() {
    if (!_ctx || _isMuted) return;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, _ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, _ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.2, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, _ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      osc.stop(_ctx.currentTime + 0.35);
    } catch (e) {}
  }

  function playLaserBeamLoop() {
    if (!_ctx || _isMuted) return null;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, _ctx.currentTime);

      gain.gain.setValueAtTime(0.35, _ctx.currentTime);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      return { osc, gain };
    } catch (e) {
      return null;
    }
  }

  // --- 9. Sirene da Nave Mistério (UFO) ---
  function startUfoSound() {
    if (!_ctx || _isMuted || _ufoOsc) return;
    try {
      _ufoOsc = _ctx.createOscillator();
      _ufoGain = _ctx.createGain();

      _ufoOsc.type = 'triangle';
      _ufoOsc.frequency.setValueAtTime(450, _ctx.currentTime);

      _ufoGain.gain.setValueAtTime(0.18, _ctx.currentTime);

      _ufoOsc.connect(_ufoGain);
      _ufoGain.connect(_masterGain);

      _ufoOsc.start();

      let toggle = false;
      _ufoInterval = setInterval(() => {
        if (_ufoOsc && _ctx) {
          toggle = !toggle;
          _ufoOsc.frequency.setValueAtTime(toggle ? 520 : 420, _ctx.currentTime);
        }
      }, 120);
    } catch (e) {}
  }

  function stopUfoSound() {
    if (_ufoInterval) {
      clearInterval(_ufoInterval);
      _ufoInterval = null;
    }
    if (_ufoOsc) {
      try {
        _ufoOsc.stop();
        _ufoOsc.disconnect();
      } catch (e) {}
      _ufoOsc = null;
    }
  }

  // --- 10. Alerta e Efeitos do Chefe ---
  function playBossWarning() {
    if (!_ctx || _isMuted) return;
    try {
      for (let i = 0; i < 4; i++) {
        const osc = _ctx.createOscillator();
        const gain = _ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, _ctx.currentTime + i * 0.5);
        osc.frequency.linearRampToValueAtTime(300, _ctx.currentTime + i * 0.5 + 0.4);

        gain.gain.setValueAtTime(0.3, _ctx.currentTime + i * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + i * 0.5 + 0.45);

        osc.connect(gain);
        gain.connect(_masterGain);

        osc.start(_ctx.currentTime + i * 0.5);
        osc.stop(_ctx.currentTime + i * 0.5 + 0.45);
      }
    } catch (e) {}
  }

  function playBossHit() {
    if (!_ctx || _isMuted) return;
    try {
      const osc = _ctx.createOscillator();
      const gain = _ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, _ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, _ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, _ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, _ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(_masterGain);

      osc.start();
      osc.stop(_ctx.currentTime + 0.08);
    } catch (e) {}
  }

  function playBossDefeatExplosion() {
    if (!_ctx || _isMuted) return;
    try {
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          playPlayerExplosion();
        }, i * 350);
      }
    } catch (e) {}
  }

  return {
    init,
    resume,
    toggleMute,
    isMuted,
    playMarchStep,
    resetMarch,
    playPlayerShot,
    playInvaderExplosion,
    playPlayerExplosion,
    playParrySuccess,
    playParryAttempt,
    playItemCollect,
    playBombBlast,
    playLaserCharge,
    playLaserBeamLoop,
    startUfoSound,
    stopUfoSound,
    playBossWarning,
    playBossHit,
    playBossDefeatExplosion
  };
})();
