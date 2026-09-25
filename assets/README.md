# Manifesto de Texturas e Sprites - Invasores Arcade v2

Este diretório contém os arquivos de imagem (PNG) do jogo.
O jogo foi projetado para ser **100% jogável sem nenhuma textura presente**, gerando automaticamente placeholders vetoriais/procedurais fiéis em tempo real através do `<canvas>` 2D.

---

## 1. Diretrizes para Substituição de Texturas pelo Cliente

1. **Formato**: Imagens PNG com canal alfa (transparência).
2. **Resolução / Escala**: O jogo utiliza internamente uma grade lógica de **224 × 256 pixels**. Os tamanhos especificados abaixo referem-se a essas coordenadas lógicas.
3. **Hitboxes Desacoplados**: Os hitboxes físicos de colisão são definidos estritamente em `js/config.js` (ex.: hitbox circular do canhão de 3 px de raio, anel de parry de 10.5 px). O tamanho visual da arte não afeta a precisão da jogabilidade.
4. **Animações (Spritesheets)**: Imagens com mais de 1 quadro (`frames > 1`) devem ser fornecidas como uma tira horizontal uniforme de largura total = `w × frames` e altura = `h`.
5. **Segurança contra Canvas Tainted**: O código **nunca** lê pixels (`getImageData` ou `toDataURL`), garantindo execução 100% fluida direto pelo protocolo `file://`.

---

## 2. Tabela de Assets Declarados

| Chave | Arquivo | Largura Lógica (w) | Altura Lógica (h) | Quadros (frames) | FPS de Animação | Descrição |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `player` | `player.png` | 13 | 8 | 1 | 0 | Canhão do jogador |
| `player_death` | `player_death.png` | 15 | 8 | 2 | 5 | Animação de explosão do canhão |
| `invader_small` | `invader_small.png` | 8 | 8 | 2 | 2 | Invasor superior (30 pontos) |
| `invader_medium` | `invader_medium.png` | 11 | 8 | 2 | 2 | Invasor médio (20 pontos) |
| `invader_large` | `invader_large.png` | 12 | 8 | 2 | 2 | Invasor grande (10 pontos) |
| `invader_death` | `invader_death.png` | 13 | 8 | 1 | 0 | Explosão de invasor comum |
| `ufo` | `ufo.png` | 16 | 8 | 1 | 0 | Nave Mistério (topo da tela) |
| `ufo_death` | `ufo_death.png` | 21 | 8 | 1 | 0 | Explosão da Nave Mistério |
| `bunker` | `bunker.png` | 22 | 16 | 1 | 0 | Abrigo verde (corroído dinamicamente) |
| `shot_player` | `shot_player.png` | 1 | 4 | 1 | 0 | Disparo reto do jogador |
| `shot_linear` | `shot_linear.png` | 3 | 7 | 4 | 8 | Projétil inimigo linear mirado |
| `shot_zigzag` | `shot_zigzag.png` | 3 | 7 | 4 | 8 | Projétil inimigo zigue-zague |
| `shot_fan` | `shot_fan.png` | 3 | 7 | 4 | 8 | Projétil inimigo em leque |
| `shot_wall` | `shot_wall.png` | 3 | 7 | 4 | 8 | Projétil inimigo de cortina/parede |
| `shot_spiral` | `shot_spiral.png` | 4 | 4 | 4 | 8 | Projétil inimigo espiral |
| `item_pierce` | `item_pierce.png` | 8 | 8 | 1 | 0 | Cápsula do Item Tiro Perfurante |
| `item_rapid` | `item_rapid.png` | 8 | 8 | 1 | 0 | Cápsula do Item Cadência Acelerada |
| `item_triple` | `item_triple.png` | 8 | 8 | 1 | 0 | Cápsula do Item Tiro Triplo |
| `special_laser` | `special_laser.png` | 8 | 8 | 1 | 0 | Cápsula do Especial Laser Convergente |
| `special_bomb` | `special_bomb.png` | 8 | 8 | 1 | 0 | Cápsula do Especial Bomba Estelar |
| `boss` | `boss.png` | 48 | 24 | 2 | 3 | Chefe final (nave-mãe biomecânica) |
| `boss_shot` | `boss_shot.png` | 4 | 6 | 2 | 8 | Projétil de plasma disparado pelo chefe |
| `background` | `background.png` | 224 | 256 | 1 | 0 | (Opcional) Fundo personalizado |
| `laser` | `laser.png` | 39 | 256 | 1 | 0 | (Opcional) Textura vertical do feixe |
| `hud_panel_frame` | `hud_panel_frame.png` | 224 | 24 | 1 | 0 | (Opcional) Moldura chanfrada do HUD |
