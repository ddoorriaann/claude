const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { etape_id, statut } = req.query;
  let q = `SELECT enc.*, of.numero_of, of.date_livraison_prevue, of.priorite, of.quantite_lancee,
    a.designation as article_designation, a.reference as article_ref,
    ep.nom as etape_nom, ep.code as etape_code, ep.ordre as etape_ordre, ep.couleur,
    CASE WHEN date(of.date_livraison_prevue)<date('now') AND of.statut='en_cours' THEN 1 ELSE 0 END as en_retard
    FROM encours enc JOIN ordres_fabrication of ON enc.of_id=of.id
    JOIN articles a ON of.article_id=a.id JOIN etapes_production ep ON enc.etape_id=ep.id
    WHERE of.statut NOT IN ('annule')`;
  const p = [];
  if (etape_id) { q += ' AND enc.etape_id=?'; p.push(etape_id); }
  if (statut) { q += ' AND enc.statut=?'; p.push(statut); }
  q += ' ORDER BY ep.ordre, of.date_livraison_prevue';
  res.json(db.prepare(q).all(...p));
});

router.get('/kanban', (req, res) => {
  const etapes = db.prepare(`SELECT ep.*,
    COUNT(enc.id) as nb_ofs,
    COALESCE(SUM(enc.quantite_en_cours),0) as total_en_cours
    FROM etapes_production ep
    LEFT JOIN encours enc ON ep.id=enc.etape_id AND enc.statut IN ('en_cours','en_attente')
    LEFT JOIN ordres_fabrication of ON enc.of_id=of.id AND of.statut='en_cours'
    GROUP BY ep.id ORDER BY ep.ordre`).all();
  res.json(etapes.map(e => ({
    ...e,
    ofs: db.prepare(`SELECT enc.*, of.numero_of, of.date_livraison_prevue, of.priorite, of.quantite_lancee,
      a.designation as article_designation, a.reference as article_ref,
      CASE WHEN date(of.date_livraison_prevue)<date('now') THEN 1 ELSE 0 END as en_retard
      FROM encours enc JOIN ordres_fabrication of ON enc.of_id=of.id
      JOIN articles a ON of.article_id=a.id
      WHERE enc.etape_id=? AND enc.statut IN ('en_cours','en_attente') AND of.statut='en_cours'
      ORDER BY of.date_livraison_prevue`).all(e.id)
  })));
});

router.post('/', (req, res) => {
  const { of_id, etape_id, quantite_entree, date_fin_prevue, operateur, machine, statut = 'en_attente', observations } = req.body;
  if (!of_id || !etape_id) return res.status(400).json({ error: 'of_id et etape_id requis' });
  const ex = db.prepare('SELECT id FROM encours WHERE of_id=? AND etape_id=?').get(of_id, etape_id);
  if (ex) {
    db.prepare('UPDATE encours SET quantite_en_cours=quantite_en_cours+?,date_debut=COALESCE(date_debut,CURRENT_TIMESTAMP),date_fin_prevue=?,operateur=?,machine=?,statut=?,observations=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(quantite_entree||0, date_fin_prevue, operateur, machine, statut, observations, ex.id);
    return res.json({ id: ex.id });
  }
  const r = db.prepare('INSERT INTO encours (of_id,etape_id,quantite_entree,quantite_en_cours,date_debut,date_fin_prevue,operateur,machine,statut,observations) VALUES (?,?,?,?,CURRENT_TIMESTAMP,?,?,?,?,?)')
    .run(of_id, etape_id, quantite_entree||0, quantite_entree||0, date_fin_prevue, operateur, machine, statut, observations);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.post('/mouvement', (req, res) => {
  const { of_id, etape_depart_id, etape_arrivee_id, quantite, type_mouvement, operateur, notes, quantite_rebut = 0 } = req.body;
  if (!of_id || !quantite || !type_mouvement) return res.status(400).json({ error: 'Champs obligatoires manquants' });
  try {
    db.transaction(() => {
      if (etape_depart_id) {
        const enc = db.prepare('SELECT * FROM encours WHERE of_id=? AND etape_id=?').get(of_id, etape_depart_id);
        if (!enc) throw new Error('Encours de départ non trouvé');
        if (enc.quantite_en_cours < quantite + quantite_rebut) throw new Error(`Quantité insuffisante: ${enc.quantite_en_cours} disponible`);
        db.prepare('UPDATE encours SET quantite_en_cours=quantite_en_cours-?-?,quantite_sortie=quantite_sortie+?,quantite_rebut=quantite_rebut+?,statut=CASE WHEN quantite_en_cours-?-?=0 THEN "termine" ELSE statut END,updated_at=CURRENT_TIMESTAMP WHERE of_id=? AND etape_id=?')
          .run(quantite, quantite_rebut, quantite, quantite_rebut, quantite, quantite_rebut, of_id, etape_depart_id);
      }
      if (etape_arrivee_id) {
        const enc = db.prepare('SELECT * FROM encours WHERE of_id=? AND etape_id=?').get(of_id, etape_arrivee_id);
        if (enc) {
          db.prepare('UPDATE encours SET quantite_entree=quantite_entree+?,quantite_en_cours=quantite_en_cours+?,date_debut=COALESCE(date_debut,CURRENT_TIMESTAMP),statut=CASE WHEN statut="en_attente" THEN "en_cours" ELSE statut END,updated_at=CURRENT_TIMESTAMP WHERE of_id=? AND etape_id=?')
            .run(quantite, quantite, of_id, etape_arrivee_id);
        } else {
          db.prepare('INSERT INTO encours (of_id,etape_id,quantite_entree,quantite_en_cours,date_debut,statut) VALUES (?,?,?,?,CURRENT_TIMESTAMP,"en_cours")')
            .run(of_id, etape_arrivee_id, quantite, quantite);
        }
      }
      db.prepare('INSERT INTO mouvements (of_id,etape_depart_id,etape_arrivee_id,quantite,type_mouvement,operateur,notes) VALUES (?,?,?,?,?,?,?)')
        .run(of_id, etape_depart_id, etape_arrivee_id, quantite, type_mouvement, operateur, notes);
    })();
    res.json({ message: 'Mouvement enregistré' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/:id', (req, res) => {
  const { quantite_en_cours, quantite_sortie, quantite_rebut, operateur, machine, statut, observations, date_fin_prevue } = req.body;
  db.prepare('UPDATE encours SET quantite_en_cours=?,quantite_sortie=?,quantite_rebut=?,operateur=?,machine=?,statut=?,observations=?,date_fin_prevue=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(quantite_en_cours, quantite_sortie, quantite_rebut, operateur, machine, statut, observations, date_fin_prevue, req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
