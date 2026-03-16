const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(p) {
	if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

const DATA_DIR = path.join(__dirname, 'data');
const LEVELS_DIR = path.join(DATA_DIR, 'levels');
const GEN_FILE = path.join(DATA_DIR, 'generations.json');

ensureDir(LEVELS_DIR);
if (!fs.existsSync(GEN_FILE)) fs.writeFileSync(GEN_FILE, JSON.stringify({ generations: [] }, null, 2));

// ─── Générations (IA) ─────────────────────────────────────────────────────────

app.get('/api/generations', (req, res) => {
	res.json(JSON.parse(fs.readFileSync(GEN_FILE, 'utf8')));
});

app.post('/api/generations', (req, res) => {
	const data = JSON.parse(fs.readFileSync(GEN_FILE, 'utf8'));
	const entry = {
		id: Date.now(),
		generationNumber: req.body.generationNumber,
		bestFitness: req.body.bestFitness,
		avgFitness: req.body.avgFitness,
		bestGenome: req.body.bestGenome,
		timestamp: new Date().toISOString(),
	};
	data.generations.push(entry);
	fs.writeFileSync(GEN_FILE, JSON.stringify(data, null, 2));
	res.json({ ok: true, id: entry.id });
});

app.delete('/api/generations', (req, res) => {
	fs.writeFileSync(GEN_FILE, JSON.stringify({ generations: [] }, null, 2));
	res.json({ ok: true });
});

// ─── Niveaux custom (éditeur) ─────────────────────────────────────────────────

// GET /api/levels — liste tous les niveaux
app.get('/api/levels', (req, res) => {
	const files = fs.readdirSync(LEVELS_DIR).filter(f => f.endsWith('.json'));
	const levels = files.map(f => {
		const data = JSON.parse(fs.readFileSync(path.join(LEVELS_DIR, f), 'utf8'));
		return { name: data.name, tileCount: data.tiles?.length ?? 0 };
	});
	res.json({ levels });
});

// GET /api/levels/:name — récupère un niveau
app.get('/api/levels/:name', (req, res) => {
	const file = path.join(LEVELS_DIR, `${req.params.name}.json`);
	if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
	res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
});

// POST /api/levels — sauvegarde un niveau
app.post('/api/levels', (req, res) => {
	const { name, tiles } = req.body;
	if (!name || !Array.isArray(tiles)) return res.status(400).json({ error: 'Invalid data' });

	// Sanitise le nom de fichier
	const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 64);
	const file = path.join(LEVELS_DIR, `${safeName}.json`);
	fs.writeFileSync(file, JSON.stringify({ name: safeName, tiles }, null, 2));
	res.json({ ok: true, name: safeName, tileCount: tiles.length });
});

// DELETE /api/levels/:name
app.delete('/api/levels/:name', (req, res) => {
	const file = path.join(LEVELS_DIR, `${req.params.name}.json`);
	if (fs.existsSync(file)) fs.unlinkSync(file);
	res.json({ ok: true });
});

// ─── Pages ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));
app.get('/editor', (req, res) => res.sendFile(path.join(__dirname, '../public/editor.html')));

app.listen(PORT, () => {
	console.log(`\nGeometry Dash AI  →  http://localhost:${PORT}`);
	console.log(`Éditeur de niveau   →  http://localhost:${PORT}/editor`);
	console.log(`Dashboard IA        →  http://localhost:${PORT}/dashboard\n`);
});
