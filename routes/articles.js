const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT a.*, COUNT(of.id) as nb_ofs_actifs FROM articles a
    LEFT JOIN ordres_fabrication of ON a.id = of.article_id AND of.statut NOT IN ('termine','annule')
    GROUP BY a.id ORDER BY a.designation`).all());
});

router.get('/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Article non trouvé' });
  res.json(a);
});

router.post('/', (req, res) => {
  const { reference, designation, categorie, unite = 'pcs', description } = req.body;
  if (!reference || !designation || !categorie) return res.status(400).json({ error: 'Champs obligatoires manquants' });
  try {
    const r = db.prepare('INSERT INTO articles (reference,designation,categorie,unite,description) VALUES (?,?,?,?,?)').run(reference, designation, categorie, unite, description);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Référence déjà existante' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { designation, categorie, unite, description } = req.body;
  const r = db.prepare('UPDATE articles SET designation=?,categorie=?,unite=?,description=? WHERE id=?').run(designation, categorie, unite, description, req.params.id);
  if (r.changes === 0) return res.status(404).json({ error: 'Article non trouvé' });
  res.json({ message: 'ok' });
});

router.delete('/:id', (req, res) => {
  if (db.prepare('SELECT id FROM ordres_fabrication WHERE article_id=? LIMIT 1').get(req.params.id))
    return res.status(409).json({ error: 'Article utilisé dans des OFs' });
  db.prepare('DELETE FROM articles WHERE id=?').run(req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
