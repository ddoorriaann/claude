const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { statut, priorite } = req.query;
  let q = `SELECT of.*, a.reference as article_ref, a.designation as article_designation, a.categorie,
    e_cur.nom as etape_actuelle,
    ROUND(100.0 * COALESCE(SUM(enc.quantite_sortie),0) / NULLIF(of.quantite_lancee,0),1) as avancement_pct,
    COALESCE(SUM(enc.quantite_rebut),0) as total_rebut,
    CASE WHEN date(of.date_livraison_prevue) < date('now') AND of.statut='en_cours' THEN 1 ELSE 0 END as en_retard
    FROM ordres_fabrication of JOIN articles a ON of.article_id=a.id
    LEFT JOIN encours enc ON of.id=enc.of_id
    LEFT JOIN (SELECT enc2.of_id, ep.nom FROM encours enc2 JOIN etapes_production ep ON enc2.etape_id=ep.id
      WHERE enc2.statut='en_cours' GROUP BY enc2.of_id ORDER BY ep.ordre) e_cur ON of.id=e_cur.of_id
    WHERE 1=1`;
  const p = [];
  if (statut) { q += ' AND of.statut=?'; p.push(statut); }
  if (priorite) { q += ' AND of.priorite=?'; p.push(priorite); }
  q += " GROUP BY of.id ORDER BY CASE of.priorite WHEN 'urgente' THEN 1 WHEN 'haute' THEN 2 WHEN 'normale' THEN 3 ELSE 4 END, of.date_livraison_prevue";
  res.json(db.prepare(q).all(...p));
});

router.get('/:id', (req, res) => {
  const of = db.prepare(`SELECT of.*, a.reference as article_ref, a.designation as article_designation, a.categorie
    FROM ordres_fabrication of JOIN articles a ON of.article_id=a.id WHERE of.id=?`).get(req.params.id);
  if (!of) return res.status(404).json({ error: 'OF non trouvé' });
  const encours = db.prepare(`SELECT enc.*, ep.nom as etape_nom, ep.code as etape_code, ep.ordre as etape_ordre, ep.couleur
    FROM encours enc JOIN etapes_production ep ON enc.etape_id=ep.id WHERE enc.of_id=? ORDER BY ep.ordre`).all(req.params.id);
  const mouvements = db.prepare(`SELECT m.*, ep1.nom as etape_depart_nom, ep2.nom as etape_arrivee_nom
    FROM mouvements m LEFT JOIN etapes_production ep1 ON m.etape_depart_id=ep1.id
    LEFT JOIN etapes_production ep2 ON m.etape_arrivee_id=ep2.id
    WHERE m.of_id=? ORDER BY m.created_at DESC LIMIT 20`).all(req.params.id);
  res.json({ ...of, encours, mouvements });
});

router.post('/', (req, res) => {
  const { numero_of, article_id, quantite_commandee, client, date_lancement, date_livraison_prevue, priorite = 'normale', observations } = req.body;
  if (!numero_of || !article_id || !quantite_commandee || !date_lancement || !date_livraison_prevue)
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  try {
    const r = db.prepare('INSERT INTO ordres_fabrication (numero_of,article_id,quantite_commandee,quantite_lancee,client,date_lancement,date_livraison_prevue,priorite,statut,observations) VALUES (?,?,?,?,?,?,?,?,"planifie",?)')
      .run(numero_of, article_id, quantite_commandee, quantite_commandee, client, date_lancement, date_livraison_prevue, priorite, observations);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Numéro OF déjà existant' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const { client, date_livraison_prevue, priorite, statut, observations, quantite_lancee } = req.body;
  db.prepare('UPDATE ordres_fabrication SET client=?,date_livraison_prevue=?,priorite=?,statut=?,observations=?,quantite_lancee=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(client, date_livraison_prevue, priorite, statut, observations, quantite_lancee, req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
