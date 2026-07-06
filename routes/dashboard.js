const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const kpis = db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN of.statut='en_cours' THEN of.id END) as ofs_en_cours,
    COUNT(DISTINCT CASE WHEN of.statut='planifie' THEN of.id END) as ofs_planifies,
    COUNT(DISTINCT CASE WHEN of.statut='termine' THEN of.id END) as ofs_termines,
    COUNT(DISTINCT CASE WHEN of.statut='en_cours' AND date(of.date_livraison_prevue)<date('now') THEN of.id END) as ofs_en_retard,
    COALESCE(SUM(CASE WHEN of.statut='en_cours' THEN enc.quantite_en_cours ELSE 0 END),0) as total_pieces_en_cours,
    COALESCE(SUM(CASE WHEN of.statut='en_cours' THEN enc.quantite_rebut ELSE 0 END),0) as total_rebuts,
    COALESCE(SUM(CASE WHEN of.statut='en_cours' THEN enc.quantite_entree ELSE 0 END),0) as total_entrees
    FROM ordres_fabrication of LEFT JOIN encours enc ON of.id=enc.of_id`).get();
  kpis.taux_rebut = kpis.total_entrees > 0 ? Math.round(1000 * kpis.total_rebuts / kpis.total_entrees) / 10 : 0;

  const chargeParEtape = db.prepare(`SELECT ep.id, ep.nom, ep.code, ep.couleur, ep.ordre,
    COUNT(enc.id) as nb_ofs,
    COALESCE(SUM(enc.quantite_en_cours),0) as quantite_en_cours,
    COALESCE(SUM(enc.quantite_entree),0) as total_entrees,
    COALESCE(SUM(enc.quantite_sortie),0) as total_sorties,
    COALESCE(SUM(enc.quantite_rebut),0) as total_rebuts
    FROM etapes_production ep
    LEFT JOIN encours enc ON ep.id=enc.etape_id AND enc.statut IN ('en_cours','en_attente')
    LEFT JOIN ordres_fabrication of ON enc.of_id=of.id AND of.statut='en_cours'
    GROUP BY ep.id ORDER BY ep.ordre`).all();

  const ofsUrgents = db.prepare(`SELECT of.id, of.numero_of, of.date_livraison_prevue, of.priorite, of.statut,
    a.designation as article_designation,
    CASE WHEN date(of.date_livraison_prevue)<date('now') THEN 1 ELSE 0 END as en_retard,
    julianday(of.date_livraison_prevue)-julianday('now') as jours_restants,
    e_cur.nom as etape_actuelle
    FROM ordres_fabrication of JOIN articles a ON of.article_id=a.id
    LEFT JOIN (SELECT enc2.of_id, ep.nom FROM encours enc2 JOIN etapes_production ep ON enc2.etape_id=ep.id WHERE enc2.statut='en_cours' GROUP BY enc2.of_id) e_cur ON of.id=e_cur.of_id
    WHERE of.statut='en_cours' AND (of.priorite IN ('urgente','haute') OR date(of.date_livraison_prevue)<=date('now','+7 days'))
    ORDER BY jours_restants, of.priorite LIMIT 10`).all();

  const mouvementsRecents = db.prepare(`SELECT m.*, of.numero_of, a.designation as article_designation,
    ep1.nom as etape_depart_nom, ep2.nom as etape_arrivee_nom
    FROM mouvements m JOIN ordres_fabrication of ON m.of_id=of.id JOIN articles a ON of.article_id=a.id
    LEFT JOIN etapes_production ep1 ON m.etape_depart_id=ep1.id
    LEFT JOIN etapes_production ep2 ON m.etape_arrivee_id=ep2.id
    ORDER BY m.created_at DESC LIMIT 15`).all();

  const alertes = db.prepare(`SELECT al.*, of.numero_of, ep.nom as etape_nom
    FROM alertes al LEFT JOIN ordres_fabrication of ON al.of_id=of.id
    LEFT JOIN etapes_production ep ON al.etape_id=ep.id
    WHERE al.acquittee=0
    ORDER BY CASE al.niveau WHEN 'danger' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, al.created_at DESC LIMIT 10`).all();

  res.json({ kpis, chargeParEtape, ofsUrgents, mouvementsRecents, alertes });
});

router.patch('/alertes/:id/acquitter', (req, res) => {
  db.prepare('UPDATE alertes SET acquittee=1 WHERE id=?').run(req.params.id);
  res.json({ message: 'ok' });
});

router.get('/etapes', (req, res) => {
  res.json(db.prepare('SELECT * FROM etapes_production ORDER BY ordre').all());
});

module.exports = router;
