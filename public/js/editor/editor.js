/**
 * editor.js — Éditeur de niveaux 2D avec navigation H+V.
 *
 * Monde : COLS_TOTAL × ROWS_TOTAL (250 × 20 blocs)
 * Viewport : COLS_VIS × ROWS_VIS blocs visibles à l'écran
 *
 * Coordonnées internes :
 *   col = 0..COLS_TOTAL-1 (gauche → droite)
 *   row = 0..ROWS_TOTAL-1 (0 = sol, 19 = sommet)
 */

const ED = {
	CELL: 40,
	COLS_TOTAL: 350,
	ROWS_TOTAL: 20,
	COLS_VIS: 20,
	ROWS_VIS: 11,   // blocs visibles verticalement
	SCROLL_H: 5,   // colonnes par clic
	SCROLL_V: 3,   // rangées par clic
	TOP_PAD: 20,   // pixels de marge en haut pour les labels
	LEFT_PAD: 32,   // pixels de marge à gauche pour les numéros de rangée
};

// Taille du canvas : LEFT_PAD + COLS_VIS*CELL × TOP_PAD + ROWS_VIS*CELL + 30
// = 32 + 20*40 × 20 + 11*40 + 30 = 832 × 490

class LevelEditor {
	constructor(canvas, statusEl) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.statusEl = statusEl;
		this.W = canvas.width;
		this.H = canvas.height;

		this.tiles = new Map();  // `${col},${row}` → 'block'|'spike'|'spike_inv'
		this.tool = 'block';
		this.viewCol = 0;          // colonne du coin gauche du viewport
		this.viewRow = 0;          // rangée du bas du viewport (0 = voir le sol)
		this.levelName = 'mon-niveau';
		this.isDragging = false;
		this.lastDragKey = null;
		this.hoverCell = null;

		this._bindEvents();
		this._render();
	}

	// ─── Événements ──────────────────────────────────────────────────────────────

	_bindEvents() {
		this.canvas.addEventListener('mousedown', e => this._onDown(e));
		this.canvas.addEventListener('mousemove', e => this._onMove(e));
		this.canvas.addEventListener('mouseup', () => { this.isDragging = false; this.lastDragKey = null; });
		this.canvas.addEventListener('mouseleave', () => { this.isDragging = false; this.hoverCell = null; this._render(); });
		this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._onRight(e); });
		this.canvas.addEventListener('wheel', e => { e.preventDefault(); this._onWheel(e); }, { passive: false });
	}

	_getCell(e) {
		const rect = this.canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left - ED.LEFT_PAD;
		const my = e.clientY - rect.top - ED.TOP_PAD;
		if (mx < 0 || my < 0) return null;
		const localCol = Math.floor(mx / ED.CELL);
		const localRow = Math.floor(my / ED.CELL); // 0 = haut écran
		if (localCol >= ED.COLS_VIS || localRow >= ED.ROWS_VIS) return null;
		// Convertir : rangée écran 0 = viewRow + ROWS_VIS - 1 (haut)
		//             rangée écran ROWS_VIS-1 = viewRow (bas)
		const worldCol = localCol + this.viewCol;
		const worldRow = (ED.ROWS_VIS - 1 - localRow) + this.viewRow;
		if (worldCol < 0 || worldCol >= ED.COLS_TOTAL) return null;
		if (worldRow < 0 || worldRow >= ED.ROWS_TOTAL) return null;
		return { col: worldCol, row: worldRow };
	}

	_onDown(e) {
		if (e.button === 2) return;
		this.isDragging = true;
		const cell = this._getCell(e);
		if (cell) { this._apply(cell); this.lastDragKey = `${cell.col},${cell.row}`; }
	}

	_onMove(e) {
		const cell = this._getCell(e);
		this.hoverCell = cell;
		this._render();
		if (!this.isDragging || !cell) return;
		const key = `${cell.col},${cell.row}`;
		if (key !== this.lastDragKey) { this._apply(cell); this.lastDragKey = key; }
	}

	_onRight(e) {
		const cell = this._getCell(e);
		if (!cell) return;
		this.tiles.delete(`${cell.col},${cell.row}`);
		this._render(); this._status();
	}

	_onWheel(e) {
		if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			// Scroll horizontal
			const dir = e.deltaX > 0 || e.deltaY > 0 ? 1 : -1;
			this.scrollTo(this.viewCol + dir * ED.SCROLL_H, this.viewRow);
		} else {
			// Scroll vertical
			const dir = e.deltaY > 0 ? -1 : 1; // molette bas = vue descend (rows diminuent)
			this.scrollTo(this.viewCol, this.viewRow + dir * ED.SCROLL_V);
		}
	}

	_apply(cell) {
		const key = `${cell.col},${cell.row}`;
		if (this.tool === 'erase') this.tiles.delete(key);
		else this.tiles.set(key, this.tool);
		this._render(); this._status();
	}

	// ─── Navigation ──────────────────────────────────────────────────────────────

	scrollTo(col, row) {
		this.viewCol = Math.max(0, Math.min(col, ED.COLS_TOTAL - ED.COLS_VIS));
		this.viewRow = Math.max(0, Math.min(row, ED.ROWS_TOTAL - ED.ROWS_VIS));
		this._render();
	}

	scrollLeft() { this.scrollTo(this.viewCol - ED.SCROLL_H, this.viewRow); }
	scrollRight() { this.scrollTo(this.viewCol + ED.SCROLL_H, this.viewRow); }
	scrollUp() { this.scrollTo(this.viewCol, this.viewRow + ED.SCROLL_V); }
	scrollDown() { this.scrollTo(this.viewCol, this.viewRow - ED.SCROLL_V); }

	// ─── Rendu ───────────────────────────────────────────────────────────────────

	_render() {
		const ctx = this.ctx;
		const cs = ED.CELL;
		const lp = ED.LEFT_PAD;
		const tp = ED.TOP_PAD;

		ctx.fillStyle = '#06060f';
		ctx.fillRect(0, 0, this.W, this.H);

		// ── Fond gauche (labels de rangée) ────────────────────────────────────────
		ctx.fillStyle = 'rgba(4,4,20,0.8)';
		ctx.fillRect(0, 0, lp, this.H);

		// ── Grille ────────────────────────────────────────────────────────────────
		ctx.strokeStyle = 'rgba(50, 70, 160, 0.2)'; ctx.lineWidth = 0.5;
		for (let c = 0; c <= ED.COLS_VIS; c++) {
			const sx = lp + c * cs;
			ctx.beginPath(); ctx.moveTo(sx, tp); ctx.lineTo(sx, tp + ED.ROWS_VIS * cs); ctx.stroke();
		}
		for (let r = 0; r <= ED.ROWS_VIS; r++) {
			const sy = tp + r * cs;
			ctx.beginPath(); ctx.moveTo(lp, sy); ctx.lineTo(lp + ED.COLS_VIS * cs, sy); ctx.stroke();
		}

		// ── Mise en surbrillance du sol (row 0) ───────────────────────────────────
		const solScreenRow = (ED.ROWS_VIS - 1) - (0 - this.viewRow); // row 0 en espace écran
		if (solScreenRow >= 0 && solScreenRow < ED.ROWS_VIS) {
			const sy = tp + solScreenRow * cs;
			ctx.fillStyle = 'rgba(68,170,255,0.06)';
			ctx.fillRect(lp, sy, ED.COLS_VIS * cs, cs);
			// Ligne de sol
			ctx.strokeStyle = 'rgba(68,170,255,0.5)'; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.moveTo(lp, sy + cs); ctx.lineTo(lp + ED.COLS_VIS * cs, sy + cs); ctx.stroke();
		}

		// ── Tiles ─────────────────────────────────────────────────────────────────
		for (const [key, type] of this.tiles) {
			const [col, row] = key.split(',').map(Number);
			const lc = col - this.viewCol;
			const lr = row - this.viewRow;   // rangée locale (0 = bas viewport)
			if (lc < 0 || lc >= ED.COLS_VIS) continue;
			if (lr < 0 || lr >= ED.ROWS_VIS) continue;
			const sx = lp + lc * cs;
			const sy = tp + (ED.ROWS_VIS - 1 - lr) * cs;  // flip Y
			this._drawTile(ctx, sx, sy, type);
		}

		// ── Hover ─────────────────────────────────────────────────────────────────
		if (this.hoverCell) {
			const { col, row } = this.hoverCell;
			const lc = col - this.viewCol;
			const lr = row - this.viewRow;
			const sx = lp + lc * cs;
			const sy = tp + (ED.ROWS_VIS - 1 - lr) * cs;
			ctx.save(); ctx.globalAlpha = 0.45;
			if (this.tool === 'erase') { ctx.fillStyle = '#ff4444'; ctx.fillRect(sx + 2, sy + 2, cs - 4, cs - 4); }
			else this._drawTile(ctx, sx, sy, this.tool);
			ctx.restore();
		}

		// ── Labels colonnes ───────────────────────────────────────────────────────
		ctx.fillStyle = 'rgba(100,130,200,0.45)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
		for (let c = 0; c <= ED.COLS_VIS; c++) {
			const wc = c + this.viewCol;
			if (wc % 5 === 0) ctx.fillText(wc, lp + c * cs + cs / 2, tp - 5);
		}

		// ── Labels rangées ────────────────────────────────────────────────────────
		ctx.fillStyle = 'rgba(100,130,200,0.45)'; ctx.textAlign = 'right';
		for (let r = 0; r < ED.ROWS_VIS; r++) {
			const wr = (ED.ROWS_VIS - 1 - r) + this.viewRow;
			const sy = tp + r * cs + cs / 2 + 3;
			ctx.fillStyle = wr === 0 ? 'rgba(68,170,255,0.6)' : 'rgba(100,130,200,0.4)';
			ctx.fillText(wr, lp - 4, sy);
		}

		// ── Indicateur joueur (col 0) ─────────────────────────────────────────────
		const playerLc = 0 - this.viewCol;
		if (playerLc >= 0 && playerLc < ED.COLS_VIS) {
			ctx.fillStyle = 'rgba(68,255,170,0.06)';
			ctx.fillRect(lp + playerLc * cs, tp, cs, ED.ROWS_VIS * cs);
			ctx.strokeStyle = 'rgba(68,255,170,0.35)'; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(lp + playerLc * cs, tp); ctx.lineTo(lp + playerLc * cs, tp + ED.ROWS_VIS * cs); ctx.stroke();
			ctx.fillStyle = 'rgba(68,255,170,0.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
			ctx.fillText('START', lp + playerLc * cs + cs / 2, tp - 7);
		}

		// ── Scrollbars ────────────────────────────────────────────────────────────
		this._drawScrollbars();
	}

	_drawTile(ctx, sx, sy, type) {
		const cs = ED.CELL;
		if (type === 'block') {
			ctx.fillStyle = '#2244bb';
			ctx.fillRect(sx + 1, sy + 1, cs - 2, cs - 2);
			ctx.fillStyle = 'rgba(100,150,255,0.5)';
			ctx.fillRect(sx + 1, sy + 1, cs - 2, 3); ctx.fillRect(sx + 1, sy + 1, 3, cs - 2);
			ctx.strokeStyle = 'rgba(80,120,220,0.5)'; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(sx + 3, sy + 3); ctx.lineTo(sx + cs - 3, sy + cs - 3);
			ctx.moveTo(sx + cs - 3, sy + 3); ctx.lineTo(sx + 3, sy + cs - 3); ctx.stroke();
		} else if (type === 'spike') {
			ctx.save();
			ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 6;
			const g = ctx.createLinearGradient(sx + cs / 2, sy, sx + cs / 2, sy + cs);
			g.addColorStop(0, '#ff2244'); g.addColorStop(1, '#aa1122');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(sx + cs / 2, sy + 2); ctx.lineTo(sx + cs - 2, sy + cs - 2); ctx.lineTo(sx + 2, sy + cs - 2);
			ctx.closePath(); ctx.fill(); ctx.restore();
		} else if (type === 'spike_inv') {
			// Pointe vers le bas
			ctx.save();
			ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 6;
			const g = ctx.createLinearGradient(sx + cs / 2, sy, sx + cs / 2, sy + cs);
			g.addColorStop(0, '#ff8800'); g.addColorStop(1, '#cc4400');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(sx + 2, sy + 2); ctx.lineTo(sx + cs - 2, sy + 2); ctx.lineTo(sx + cs / 2, sy + cs - 2);
			ctx.closePath(); ctx.fill(); ctx.restore();
		}
	}

	_drawScrollbars() {
		const ctx = this.ctx;
		const lp = ED.LEFT_PAD;
		const tp = ED.TOP_PAD;
		const bw = ED.COLS_VIS * ED.CELL;
		const bh = ED.ROWS_VIS * ED.CELL;

		// Scrollbar horizontale (bas)
		const hFrac = this.viewCol / (ED.COLS_TOTAL - ED.COLS_VIS);
		const barY = tp + bh + 8;
		ctx.fillStyle = 'rgba(30,40,100,0.5)';
		ctx.fillRect(lp, barY, bw, 5);
		ctx.fillStyle = 'rgba(68,150,255,0.6)';
		ctx.fillRect(lp + hFrac * (bw - 40), barY, 40, 5);

		// Scrollbar verticale (droite)
		const vFrac = this.viewRow / (ED.ROWS_TOTAL - ED.ROWS_VIS);
		const barX = lp + bw + 8;
		ctx.fillStyle = 'rgba(30,40,100,0.5)';
		ctx.fillRect(barX, tp, 5, bh);
		ctx.fillStyle = 'rgba(68,150,255,0.6)';
		// Plus viewRow est grand = on est haut = la barre est en haut
		const bpos = (1 - vFrac) * (bh - 40);
		ctx.fillRect(barX, tp + bpos, 5, 40);
	}

	_status() {
		if (!this.statusEl) return;
		this.statusEl.textContent =
			`${this.tiles.size} tiles | Col ${this.viewCol}→${this.viewCol + ED.COLS_VIS - 1} | Row ${this.viewRow}→${this.viewRow + ED.ROWS_VIS - 1}`;
	}

	// ─── API publique ─────────────────────────────────────────────────────────────

	getTilesArray() {
		return Array.from(this.tiles.entries()).map(([key, type]) => {
			const [col, row] = key.split(',').map(Number);
			return { col, row, type };
		});
	}

	loadTiles(tiles) {
		this.tiles.clear();
		for (const { col, row, type } of tiles) this.tiles.set(`${col},${row}`, type);
		this.viewCol = 0; this.viewRow = 0;
		this._render(); this._status();
	}

	clear() { this.tiles.clear(); this._render(); this._status(); }

	downloadJSON() {
		const data = { name: this.levelName, tiles: this.getTilesArray() };
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a'); a.href = url; a.download = `${this.levelName}.json`; a.click();
		URL.revokeObjectURL(url);
	}

	async saveToServer() {
		const data = { name: this.levelName, tiles: this.getTilesArray() };
		const res = await fetch('/api/levels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
		return res.ok;
	}
}
