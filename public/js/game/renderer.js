/**
 * renderer.js — Rendu Canvas avec caméra verticale.
 * Toutes les coordonnées monde sont converties en coordonnées écran :
 *   screenX = worldX - scrollX
 *   screenY = worldY - cameraY
 */

class Renderer {
	constructor(canvas) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.W = canvas.width;
		this.H = canvas.height;
		this._bgGrad = null;
		this._buildBgGrad();
	}

	_buildBgGrad() {
		const g = this.ctx.createLinearGradient(0, 0, 0, this.H);
		g.addColorStop(0, '#070718');
		g.addColorStop(0.55, '#0d0d2e');
		g.addColorStop(1, '#1a0a2e');
		this._bgGrad = g;
	}

	// ─── Frame principale ─────────────────────────────────────────────────────────

	render(player, level, camera, gameInfo, aiController = null) {
		const { scrollX, cameraY } = camera;

		this._drawBg(scrollX);
		this._drawCeiling(cameraY);

		const obs = level.getObstaclesInView(scrollX, cameraY, this.W, this.H);
		this._drawObstacles(obs, scrollX, cameraY);

		if (aiController?.lastGrid) this._drawAIOverlay(aiController, player, cameraY);
		if (!player.isDead) this._drawPlayer(player, cameraY);
		this._drawHUD(gameInfo, player.distanceBlocks);
	}

	// ─── Fond ─────────────────────────────────────────────────────────────────────

	_drawBg(scrollX) {
		const ctx = this.ctx;
		ctx.fillStyle = this._bgGrad;
		ctx.fillRect(0, 0, this.W, this.H);

		// Grille de points
		const spacing = 80;
		const ox = (-(scrollX * 0.2)) % spacing;
		ctx.fillStyle = 'rgba(100, 120, 255, 0.12)';
		for (let x = ox; x < this.W; x += spacing)
			for (let y = 0; y < this.H; y += spacing) {
				ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
			}
		// Scanlines
		ctx.strokeStyle = 'rgba(80, 80, 180, 0.06)'; ctx.lineWidth = 1;
		const oy = (-(scrollX * 0.05)) % 160;
		for (let y = oy; y < this.H; y += 40) {
			ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
		}
	}

	// ─── Plafond (monde Y = 0) ────────────────────────────────────────────────────

	_drawCeiling(cameraY) {
		const sy = 0 - cameraY;
		if (sy < -20 || sy > this.H) return;
		const ctx = this.ctx;
		ctx.strokeStyle = 'rgba(68, 100, 255, 0.3)'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(this.W, sy); ctx.stroke();
		// Remplissage "vide" au-dessus du plafond
		if (sy > 0) {
			ctx.fillStyle = 'rgba(4, 4, 20, 0.95)';
			ctx.fillRect(0, 0, this.W, sy);
		}
	}

	// ─── Obstacles ────────────────────────────────────────────────────────────────

	_drawObstacles(obstacles, scrollX, cameraY) {
		for (const obs of obstacles) {
			const sx = obs.x - scrollX;
			const sy = obs.y - cameraY;
			if (obs.type === 'block') this._drawBlock(sx, sy);
			else if (obs.type === 'spike') this._drawSpike(sx, sy, false);
			else if (obs.type === 'spike_inv') this._drawSpike(sx, sy, true);
		}
	}

	_drawBlock(sx, sy) {
		const ctx = this.ctx;
		const w = BLOCK_SIZE, h = BLOCK_SIZE;
		ctx.fillStyle = '#3355cc';
		ctx.fillRect(sx, sy, w, h);
		ctx.fillStyle = 'rgba(120, 160, 255, 0.6)';
		ctx.fillRect(sx, sy, w, 3); ctx.fillRect(sx, sy, 3, h);
		ctx.fillStyle = 'rgba(0,0,0,0.4)';
		ctx.fillRect(sx, sy + h - 3, w, 3); ctx.fillRect(sx + w - 3, sy, 3, h);
		ctx.strokeStyle = 'rgba(80,120,220,0.5)'; ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(sx + 2, sy + 2); ctx.lineTo(sx + w - 2, sy + h - 2);
		ctx.moveTo(sx + w - 2, sy + 2); ctx.lineTo(sx + 2, sy + h - 2);
		ctx.stroke();
	}

	_drawSpike(sx, sy, inverted) {
		const ctx = this.ctx;
		const w = BLOCK_SIZE, h = BLOCK_SIZE;
		ctx.save();
		ctx.shadowColor = '#ff4466'; ctx.shadowBlur = 8;
		const g = ctx.createLinearGradient(sx + w / 2, sy, sx + w / 2, sy + h);
		g.addColorStop(0, '#ff2244'); g.addColorStop(1, '#cc1133');
		ctx.fillStyle = g;
		ctx.beginPath();
		if (!inverted) {
			// Pointe vers le haut
			ctx.moveTo(sx + w / 2, sy);      // sommet
			ctx.lineTo(sx + w, sy + h);  // bas-droite
			ctx.lineTo(sx, sy + h);  // bas-gauche
		} else {
			// Pointe vers le bas
			ctx.moveTo(sx, sy);      // haut-gauche
			ctx.lineTo(sx + w, sy);      // haut-droite
			ctx.lineTo(sx + w / 2, sy + h);  // pointe en bas
		}
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,150,160,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
		ctx.restore();
	}

	// ─── Joueur ───────────────────────────────────────────────────────────────────

	_drawPlayer(player, cameraY) {
		const ctx = this.ctx;
		const sx = player.x;
		const sy = player.y - cameraY;
		const s = player.size;
		const cx = sx + s / 2, cy = sy + s / 2;

		ctx.save();
		ctx.translate(cx, cy); ctx.rotate(player.rotation);
		ctx.shadowColor = '#44ccff'; ctx.shadowBlur = 18;
		const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
		g.addColorStop(0, '#55eeff'); g.addColorStop(1, '#2266cc');
		ctx.fillStyle = g;
		ctx.fillRect(-s / 2, -s / 2, s, s);
		ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2;
		ctx.strokeRect(-s / 2, -s / 2, s, s);
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
		ctx.restore();
	}

	// ─── Overlay IA ───────────────────────────────────────────────────────────────

	_drawAIOverlay(aiCtrl, player, cameraY) {
		if (!aiCtrl.lastGrid) return;
		const ctx = this.ctx;
		const grid = aiCtrl.lastGrid;
		const bs = BLOCK_SIZE;

		// Ancrage sur le joueur (suit le saut)
		const px = player.x;
		const py = player.y - cameraY; // coin supérieur gauche du joueur à l'écran

		const rowsBelow = VISION.ROWS_BELOW ?? 4;
		const rowsAbove = VISION.ROWS;
		const totalRows = rowsBelow + 1 + rowsAbove;

		// ── Cellules ─────────────────────────────────────────────────────────────
		// i=0 → row=-4 (4 cases sous joueur) … i=4 → row=0 (pieds) … i=8 → row=+4 (le plus haut)
		for (let i = 0; i < totalRows; i++) {
			const row = i - rowsBelow; // row réel : -4 à +4
			for (let col = 0; col < VISION.COLS; col++) {
				const sx = px + col * bs;
				const sy = py - row * bs; // row 0 = coin sup du joueur, row+ = vers le haut
				const c = grid[i]?.[col] ?? CELL.AIR;

				ctx.fillStyle = c === CELL.BLOCK ? 'rgba(68,100,255,0.22)' : c === CELL.SPIKE ? 'rgba(255,60,60,0.22)' : 'rgba(255,255,255,0.03)';
				ctx.fillRect(sx + 1, sy + 1, bs - 2, bs - 2);

				ctx.strokeStyle = 'rgba(100,150,255,0.22)';
				ctx.lineWidth = 0.5;
				ctx.strokeRect(sx + 1, sy + 1, bs - 2, bs - 2);
			}
		}

		// ── Contour global du carré 9×9 ──────────────────────────────────────────
		ctx.save();
		ctx.strokeStyle = 'rgba(100,200,255,0.4)';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([4, 4]);
		// Coin haut-gauche : col=0, row=+rowsAbove → sy = py - rowsAbove*bs
		ctx.strokeRect(px, py - rowsAbove * bs, VISION.COLS * bs, totalRows * bs);
		ctx.setLineDash([]);
		ctx.restore();

		// ── Triggers (coordonnées flottantes) ────────────────────────────────────
		// Vert  = trigger "présence" (BLOCK_PRESENT=0, SPIKE_PRESENT=2, AIR_PRESENT=4)
		// Rouge = trigger "absence"  (BLOCK_ABSENT=1,  SPIKE_ABSENT=3,  AIR_ABSENT=5)
		// Icône : carré=block, triangle=spike, rond=air
		// Opacité : faible si inactif, pleine si actif
		// Les triggers du même réseau sont reliés par un trait

		for (const net of aiCtrl.genome.networks) {
			const isActive = net.isActive;

			// Calculer les centres de tous les triggers du réseau
			const centers = net.triggers.map(t => {
				const rowReal = t.y - rowsBelow;
				return {
					x: px + t.x * bs + bs / 2,
					y: py - rowReal * bs + bs / 2,
				};
			});

			// ── Lignes de connexion ─────────────────────────────────────────────────
			if (centers.length > 1) {
				ctx.save();
				ctx.globalAlpha = isActive ? 0.6 : 0.15;
				ctx.strokeStyle = isActive ? '#ffffff' : '#aaaaaa';
				ctx.lineWidth = isActive ? 1.5 : 0.8;
				ctx.setLineDash(isActive ? [] : [3, 3]);
				ctx.shadowColor = isActive ? '#ffffff' : 'transparent';
				ctx.shadowBlur = isActive ? 4 : 0;
				ctx.beginPath();
				ctx.moveTo(centers[0].x, centers[0].y);
				for (let i = 1; i < centers.length; i++) {
					ctx.lineTo(centers[i].x, centers[i].y);
				}
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.restore();
			}

			// ── Dessiner chaque trigger ─────────────────────────────────────────────
			for (const t of net.triggers) {
				const rowReal = t.y - rowsBelow;
				const sx = px + t.x * bs;
				const sy = py - rowReal * bs;
				const cx2 = sx + bs / 2;
				const cy2 = sy + bs / 2;

				const isPresence = (t.type % 2 === 0);
				const color = isPresence ? '#00dd55' : '#ff3333';
				const alpha = isActive ? 1.0 : 0.25;

				// Carré de fond
				ctx.save();
				ctx.globalAlpha = isActive ? 0.18 : 0.06;
				ctx.fillStyle = color;
				ctx.fillRect(sx + 1, sy + 1, bs - 2, bs - 2);
				ctx.restore();

				// Bordure
				ctx.save();
				ctx.globalAlpha = alpha;
				ctx.strokeStyle = color;
				ctx.lineWidth = isActive ? 2 : 1;
				ctx.shadowColor = color;
				ctx.shadowBlur = isActive ? 10 : 0;
				ctx.strokeRect(sx + 2, sy + 2, bs - 4, bs - 4);
				ctx.restore();

				// Icône selon le type d'élément détecté (indépendant de présence/absence)
				// type 0,1 = block → carré ; type 2,3 = spike → triangle ; type 4,5 = air → rond
				ctx.save();
				ctx.globalAlpha = alpha;
				ctx.fillStyle = color;
				ctx.shadowColor = color;
				ctx.shadowBlur = isActive ? 8 : 0;
				const iconSize = bs * 0.28;

				if (t.type <= 1) {
					// Block → petit carré centré
					ctx.fillRect(cx2 - iconSize, cy2 - iconSize, iconSize * 2, iconSize * 2);
				}
				else if (t.type <= 3) {
					// Spike → triangle pointant vers le haut
					ctx.beginPath();
					ctx.moveTo(cx2, cy2 - iconSize);
					ctx.lineTo(cx2 + iconSize, cy2 + iconSize);
					ctx.lineTo(cx2 - iconSize, cy2 + iconSize);
					ctx.closePath();
					ctx.fill();
				}
				else {
					// Air → rond
					ctx.beginPath();
					ctx.arc(cx2, cy2, iconSize, 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		}

		// ── Label JUMP ───────────────────────────────────────────────────────────
		if (aiCtrl.lastDecision) {
			ctx.save();
			ctx.fillStyle = '#00ff88'; ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 15;
			ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
			ctx.fillText('⬆ JUMP', px, py - rowsAbove * bs - 8);
			ctx.restore();
		}
	}

	// ─── HUD ──────────────────────────────────────────────────────────────────────

	_drawHUD(info, dist) {
		const ctx = this.ctx;
		const { attempts = 0, mode = 'MANUEL', levelName = null, seed = null } = info;

		ctx.save();
		ctx.fillStyle = 'rgba(0,0,20,0.65)';
		this._rr(ctx, 10, 10, 230, 85, 8); ctx.fill();
		ctx.strokeStyle = 'rgba(68,170,255,0.3)'; ctx.lineWidth = 1;
		this._rr(ctx, 10, 10, 230, 85, 8); ctx.stroke();

		const lines = [
			{ l: 'MODE', v: mode, c: mode === 'IA' ? '#44ffaa' : '#ffdd44' },
			{ l: 'ESSAIS', v: String(attempts), c: '#44aaff' },
			{ l: 'DISTANCE', v: `${dist.toFixed(1)} blocs`, c: '#fff' },
			{ l: 'NIVEAU', v: levelName || `seed #${seed || '?'}`, c: '#aa88ff' },
		];
		ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'left';
		lines.forEach((ln, i) => {
			const y = 30 + i * 16;
			ctx.fillStyle = 'rgba(100,130,180,0.8)'; ctx.fillText(ln.l + ':', 22, y);
			ctx.fillStyle = ln.c; ctx.fillText(ln.v, 135, y);
		});
		ctx.restore();
	}

	drawDeathScreen(dist) {
		const ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, this.W, this.H);
		ctx.textAlign = 'center';
		ctx.fillStyle = '#ff4455'; ctx.font = 'bold 40px "Courier New",monospace';
		ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 20;
		ctx.fillText('MORT', this.W / 2, this.H / 2 - 30);
		ctx.shadowBlur = 0;
		ctx.fillStyle = '#aaccff'; ctx.font = '20px "Courier New",monospace';
		ctx.fillText(`Distance : ${dist.toFixed(1)} blocs`, this.W / 2, this.H / 2 + 10);
		ctx.fillStyle = 'rgba(150,180,255,0.7)'; ctx.font = '14px "Courier New",monospace';
		ctx.fillText('ESPACE ou CLIC pour recommencer', this.W / 2, this.H / 2 + 45);
		ctx.restore();
	}

	_rr(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
		ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
		ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
		ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
	}
}