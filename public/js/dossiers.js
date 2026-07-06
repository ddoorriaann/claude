// ===== STATE DOSSIER =====
const dt = {
  id: null,
  data: null,
  tailles: []
};

// ===== LISTE DOSSIERS =====

async function loadDossiers() {
  const dossiers = await api('GET', '/dossiers');
  state._dossiers = dossiers;
  renderDossiers(dossiers);
}

function renderDossiers(dossiers) {
  document.getElementById('dossiersTbody').innerHTML = dossiers.length === 0
    ? `<tr><td colspan="9" class="table-empty">Aucun dossier technique. Créez-en un pour commencer.</td></tr>`
    : dossiers.map(d => `
      <tr>
        <td>
          <div style="font-weight:600">${d.article_designation}</div>
          <div style="font-size:0.75rem;color:var(--muted)">${d.article_ref} · ${d.categorie}</div>
        </td>
        <td><span class="badge badge-secondary">${d.categorie}</span></td>
        <td><span style="font-weight:600">v${d.version}</span></td>
        <td><span class="badge dt-statut-${d.statut}">${dtStatutLabel(d.statut)}</span></td>
        <td>${d.redacteur || '-'}</td>
        <td><span class="badge badge-secondary">${d.nb_matieres} matière(s)</span></td>
        <td><span class="badge badge-secondary">${d.nb_operations} op.</span></td>
        <td style="font-size:0.75rem;color:var(--muted)">${formatDate(d.updated_at)}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openDossier(${d.id})">Ouvrir</button>
        </td>
      </tr>`).join('');
}

function filterDossiers() {
  const search = document.getElementById('searchDossier').value.toLowerCase();
  const statut = document.getElementById('filterDossierStatut').value;
  const filtered = (state._dossiers || []).filter(d => {
    const matchSearch = !search || d.article_designation.toLowerCase().includes(search)
      || d.article_ref.toLowerCase().includes(search);
    const matchStatut = !statut || d.statut === statut;
    return matchSearch && matchStatut;
  });
  renderDossiers(filtered);
}

function dtStatutLabel(s) {
  return { brouillon: '✏️ Brouillon', en_revision: '🔄 En révision', valide: '✅ Validé', archive: '📦 Archivé' }[s] || s;
}

// ===== CRÉER DOSSIER =====

async function openNewDossier() {
  const arts = await api('GET', '/dossiers/articles-sans-dossier');
  const sel = document.getElementById('nd_article_id');
  sel.innerHTML = '<option value="">Sélectionner un article...</option>';
  arts.forEach(a => { sel.innerHTML += `<option value="${a.id}">[${a.reference}] ${a.designation}</option>`; });
  document.getElementById('modalNewDossier').classList.remove('hidden');
}

async function createDossier() {
  const article_id = document.getElementById('nd_article_id').value;
  const version = document.getElementById('nd_version').value || '1.0';
  const redacteur = document.getElementById('nd_redacteur').value;
  if (!article_id) return toast('Sélectionnez un article', 'error');
  try {
    const r = await api('POST', '/dossiers', { article_id: +article_id, version, redacteur });
    closeModal('modalNewDossier');
    toast('Dossier créé');
    openDossier(r.id);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== OUVRIR / CHARGER DOSSIER =====

async function openDossier(id) {
  dt.id = id;
  dt.data = await api('GET', `/dossiers/${id}`);
  const d = dt.data;

  // Affiche la page détail
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-dossier-detail').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="dossiers"]').classList.add('active');
  document.getElementById('pageTitle').textContent = `Dossier · ${d.article_ref}`;

  // Header
  document.getElementById('dtHeaderInfo').innerHTML = `
    <div class="dt-article-card">
      <div class="dt-article-icon">👗</div>
      <div>
        <div class="dt-article-ref">${d.article_ref} · ${d.categorie}</div>
        <div class="dt-article-name">${d.article_designation}</div>
      </div>
    </div>`;
  document.getElementById('dt_version').value = d.version || '';
  document.getElementById('dt_statut').value = d.statut || 'brouillon';
  document.getElementById('dt_redacteur').value = d.redacteur || '';
  document.getElementById('dt_valideur').value = d.valideur || '';
  document.getElementById('dt_date_validation').value = d.date_validation || '';
  document.getElementById('dt_observations').value = d.observations || '';

  // Charger l'onglet actif
  const activeTab = document.querySelector('#dtTabs .tab.active')?.dataset.tab || 'nomenclature';
  switchDtTab(activeTab);
}

function switchDtTab(tab) {
  document.querySelectorAll('#dtTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.dt-tab').forEach(t => t.classList.toggle('active', t.id === `dt-tab-${tab}`));
  if (!dt.data) return;
  const renders = {
    nomenclature: renderNomenclature,
    variantes: renderVariantes,
    gamme: renderGamme,
    placement: renderPlacement,
    mesures: renderMesures,
    qualite: renderQualite,
    prix: renderPrix,
    suivi: renderSuivi,
  };
  renders[tab]?.();
}

// ===== ENTÊTE =====

async function saveDossierHeader() {
  await api('PUT', `/dossiers/${dt.id}`, {
    version: document.getElementById('dt_version').value,
    statut: document.getElementById('dt_statut').value,
    redacteur: document.getElementById('dt_redacteur').value,
    valideur: document.getElementById('dt_valideur').value,
    date_validation: document.getElementById('dt_date_validation').value || null,
    observations: document.getElementById('dt_observations').value,
  });
  toast('Dossier sauvegardé');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
}

// ===== NOMENCLATURE =====

function renderNomenclature() {
  const rows = dt.data.nomenclature;
  const typeLabels = { tissu: '🧵 Tissu', doublure: '🪡 Doublure', entoilage: '🔲 Entoilage', fil: '🧶 Fil',
    bouton: '🔘 Bouton', fermeture: '🤐 Fermeture', etiquette: '🏷️ Étiquette', emballage: '📦 Emballage', autre: 'Autre' };
  let totalCout = 0;
  const tbody = rows.map((n, i) => {
    const qteAvecPerte = n.quantite_par_piece * (1 + (n.perte_percent || 0) / 100);
    const cout = qteAvecPerte * (n.prix_unitaire || 0);
    totalCout += cout;
    return `<tr>
      <td style="color:var(--muted)">${i + 1}</td>
      <td><code style="font-size:0.8rem">${n.reference_matiere || '-'}</code></td>
      <td><strong>${n.designation}</strong>${n.fournisseur ? `<div style="font-size:0.75rem;color:var(--muted)">${n.fournisseur}${n.reference_fournisseur ? ' · ' + n.reference_fournisseur : ''}</div>` : ''}</td>
      <td><span class="badge badge-secondary">${typeLabels[n.type_matiere] || n.type_matiere}</span></td>
      <td>${n.unite}</td>
      <td><strong>${n.quantite_par_piece}</strong></td>
      <td>${n.laize ? n.laize + ' cm' : '-'}</td>
      <td>${n.perte_percent || 0}%</td>
      <td>${n.fournisseur || '-'}</td>
      <td>${n.prix_unitaire ? n.prix_unitaire.toFixed(3) + ' ' + (n.devise || '€') : '-'}</td>
      <td style="font-weight:700;color:var(--accent)">${cout.toFixed(3)} €</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="editNom(${n.id})">✏️</button>
          <button class="btn btn-outline btn-sm text-danger" onclick="deleteNom(${n.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('dtNomTbody').innerHTML = tbody || `<tr><td colspan="12" class="table-empty">Aucune matière</td></tr>`;
  document.getElementById('dtNomFoot').innerHTML = `<tr style="background:var(--light)">
    <td colspan="10" style="padding:10px 14px;font-weight:600;text-align:right">Total coût matières / pièce</td>
    <td style="padding:10px 14px;font-weight:800;color:var(--accent);font-size:1rem">${totalCout.toFixed(3)} €</td>
    <td></td>
  </tr>`;
}

function openNomModal(id = null) {
  const n = id ? dt.data.nomenclature.find(x => x.id === id) : null;
  document.getElementById('nom_id').value = id || '';
  document.getElementById('modalNomTitle').textContent = id ? 'Modifier la matière' : 'Ajouter une matière';
  document.getElementById('nom_reference').value = n?.reference_matiere || '';
  document.getElementById('nom_type').value = n?.type_matiere || 'tissu';
  document.getElementById('nom_designation').value = n?.designation || '';
  document.getElementById('nom_unite').value = n?.unite || 'm';
  document.getElementById('nom_quantite').value = n?.quantite_par_piece || '';
  document.getElementById('nom_laize').value = n?.laize || '';
  document.getElementById('nom_perte').value = n?.perte_percent ?? 10;
  document.getElementById('nom_prix').value = n?.prix_unitaire || '';
  document.getElementById('nom_devise').value = n?.devise || 'EUR';
  document.getElementById('nom_fournisseur').value = n?.fournisseur || '';
  document.getElementById('nom_ref_fourn').value = n?.reference_fournisseur || '';
  document.getElementById('nom_notes').value = n?.notes || '';
  document.getElementById('modalNom').classList.remove('hidden');
}

function editNom(id) { openNomModal(id); }

async function saveNom() {
  const id = document.getElementById('nom_id').value;
  const body = {
    reference_matiere: document.getElementById('nom_reference').value,
    type_matiere: document.getElementById('nom_type').value,
    designation: document.getElementById('nom_designation').value,
    unite: document.getElementById('nom_unite').value,
    quantite_par_piece: +document.getElementById('nom_quantite').value || 0,
    laize: +document.getElementById('nom_laize').value || null,
    perte_percent: +document.getElementById('nom_perte').value || 0,
    prix_unitaire: +document.getElementById('nom_prix').value || 0,
    devise: document.getElementById('nom_devise').value,
    fournisseur: document.getElementById('nom_fournisseur').value,
    reference_fournisseur: document.getElementById('nom_ref_fourn').value,
    notes: document.getElementById('nom_notes').value,
    ordre: dt.data.nomenclature.length,
  };
  if (!body.designation) return toast('Désignation requise', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/nomenclature/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/nomenclature`, body);
    closeModal('modalNom');
    toast(id ? 'Matière mise à jour' : 'Matière ajoutée');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderNomenclature();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteNom(id) {
  if (!confirm('Supprimer cette matière ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/nomenclature/${id}`);
  toast('Matière supprimée');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderNomenclature();
}

// ===== VARIANTES =====

function renderVariantes() {
  const container = document.getElementById('dtVariantesContainer');
  if (!dt.data.variantes.length) {
    container.innerHTML = '<div class="table-empty card" style="padding:40px;text-align:center">Aucune variante. Ajoutez-en une pour définir les pièces du produit.</div>';
    return;
  }
  container.innerHTML = dt.data.variantes.map(v => {
    const tailles = Array.isArray(v.tailles) ? v.tailles : JSON.parse(v.tailles || '[]');
    const taillesHtml = tailles.map(t => `<span class="taille-chip">${t}</span>`).join('');
    const piecesHtml = v.pieces.length === 0
      ? '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.875rem">Aucune pièce définie</div>'
      : `<table style="width:100%;border-collapse:collapse;font-size:0.875rem">
          <thead><tr>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">#</th>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">Référence</th>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">Désignation</th>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">Qté</th>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">Matière</th>
            <th style="padding:8px 12px;text-align:left;color:var(--muted);font-size:0.7rem;text-transform:uppercase;border-bottom:1px solid var(--light)">Sens</th>
            <th style="padding:8px 12px;border-bottom:1px solid var(--light)"></th>
          </tr></thead>
          <tbody>${v.pieces.map((p, i) => `
            <tr>
              <td style="padding:8px 12px;color:var(--muted)">${i + 1}</td>
              <td style="padding:8px 12px"><code style="font-size:0.8rem">${p.reference || '-'}</code></td>
              <td style="padding:8px 12px;font-weight:500">${p.designation}</td>
              <td style="padding:8px 12px">${p.quantite}</td>
              <td style="padding:8px 12px;font-size:0.8rem;color:var(--muted)">${p.matiere_ref || '-'}</td>
              <td style="padding:8px 12px;font-size:0.75rem">${[p.sens_droit && 'Droit fil', p.sens_travers && 'Travers', p.sens_biais && 'Biais'].filter(Boolean).join(', ') || '-'}</td>
              <td style="padding:8px 12px">
                <div style="display:flex;gap:4px">
                  <button class="btn btn-outline btn-sm" onclick="editPiece(${v.id},${p.id})">✏️</button>
                  <button class="btn btn-outline btn-sm text-danger" onclick="deletePiece(${v.id},${p.id})">🗑️</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    return `<div class="variante-block">
      <div class="variante-header">
        <div class="variante-color-dot" style="background:${v.couleur || '#3498db'}"></div>
        <span class="variante-name">${v.code} — ${v.designation}</span>
        ${v.description ? `<span style="font-size:0.8rem;color:var(--muted)">${v.description}</span>` : ''}
        <div class="variante-tailles ms-auto">${taillesHtml}</div>
        <button class="btn btn-outline btn-sm" onclick="openPieceModal(${v.id})">+ Pièce</button>
        <button class="btn btn-outline btn-sm" onclick="editVariante(${v.id})">✏️</button>
        <button class="btn btn-outline btn-sm text-danger" onclick="deleteVariante(${v.id})">🗑️</button>
      </div>
      <div class="variante-body">${piecesHtml}</div>
    </div>`;
  }).join('');
}

function openVarianteModal(id = null) {
  const v = id ? dt.data.variantes.find(x => x.id === id) : null;
  const tailles = v ? (Array.isArray(v.tailles) ? v.tailles : JSON.parse(v.tailles || '[]')) : [];
  document.getElementById('var_id').value = id || '';
  document.getElementById('modalVarianteTitle').textContent = id ? 'Modifier la variante' : 'Ajouter une variante';
  document.getElementById('var_code').value = v?.code || '';
  document.getElementById('var_designation').value = v?.designation || '';
  document.getElementById('var_couleur').value = v?.couleur || '#3498db';
  document.getElementById('var_tailles').value = tailles.join(',');
  document.getElementById('var_description').value = v?.description || '';
  document.getElementById('modalVariante').classList.remove('hidden');
}

function editVariante(id) { openVarianteModal(id); }

async function saveVariante() {
  const id = document.getElementById('var_id').value;
  const taillesRaw = document.getElementById('var_tailles').value;
  const tailles = taillesRaw.split(',').map(t => t.trim()).filter(Boolean);
  const body = {
    code: document.getElementById('var_code').value,
    designation: document.getElementById('var_designation').value,
    description: document.getElementById('var_description').value,
    couleur: document.getElementById('var_couleur').value,
    tailles,
  };
  if (!body.code || !body.designation) return toast('Code et désignation requis', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/variantes/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/variantes`, body);
    closeModal('modalVariante');
    toast(id ? 'Variante mise à jour' : 'Variante ajoutée');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderVariantes();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteVariante(id) {
  if (!confirm('Supprimer cette variante et toutes ses pièces ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/variantes/${id}`);
  toast('Variante supprimée');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderVariantes();
}

function openPieceModal(varianteId, pieceId = null) {
  const variante = dt.data.variantes.find(v => v.id === varianteId);
  const p = pieceId ? variante?.pieces.find(x => x.id === pieceId) : null;
  document.getElementById('pce_id').value = pieceId || '';
  document.getElementById('pce_variante_id').value = varianteId;
  document.getElementById('modalPieceTitle').textContent = (pieceId ? 'Modifier' : 'Ajouter') + ` une pièce — ${variante?.designation}`;
  document.getElementById('pce_reference').value = p?.reference || '';
  document.getElementById('pce_designation').value = p?.designation || '';
  document.getElementById('pce_quantite').value = p?.quantite || 1;
  document.getElementById('pce_matiere').value = p?.matiere_ref || '';
  document.getElementById('pce_droit').checked = p ? !!p.sens_droit : true;
  document.getElementById('pce_travers').checked = p ? !!p.sens_travers : false;
  document.getElementById('pce_biais').checked = p ? !!p.sens_biais : false;
  document.getElementById('pce_notes').value = p?.notes || '';
  document.getElementById('modalPiece').classList.remove('hidden');
}

function editPiece(varianteId, pieceId) { openPieceModal(varianteId, pieceId); }

async function savePiece() {
  const id = document.getElementById('pce_id').value;
  const varianteId = document.getElementById('pce_variante_id').value;
  const body = {
    reference: document.getElementById('pce_reference').value,
    designation: document.getElementById('pce_designation').value,
    quantite: +document.getElementById('pce_quantite').value || 1,
    matiere_ref: document.getElementById('pce_matiere').value,
    sens_droit: document.getElementById('pce_droit').checked,
    sens_travers: document.getElementById('pce_travers').checked,
    sens_biais: document.getElementById('pce_biais').checked,
    notes: document.getElementById('pce_notes').value,
  };
  if (!body.designation) return toast('Désignation requise', 'error');
  try {
    const url = `/dossiers/${dt.id}/variantes/${varianteId}/pieces`;
    if (id) await api('PUT', `${url}/${id}`, body);
    else await api('POST', url, body);
    closeModal('modalPiece');
    toast(id ? 'Pièce mise à jour' : 'Pièce ajoutée');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderVariantes();
  } catch (e) { toast(e.message, 'error'); }
}

async function deletePiece(varianteId, pieceId) {
  if (!confirm('Supprimer cette pièce ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/variantes/${varianteId}/pieces/${pieceId}`);
  toast('Pièce supprimée');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderVariantes();
}

// ===== GAMME DE MONTAGE =====

function renderGamme() {
  const ops = dt.data.gamme;
  let totalTemps = 0, totalCout = 0;
  const tbody = ops.map((g, i) => {
    const cout = (g.temps_standard / 60) * (g.taux_horaire || 0);
    totalTemps += g.temps_standard || 0;
    totalCout += cout;
    return `<tr>
      <td style="color:var(--muted)">${g.ordre || i + 1}</td>
      <td><code style="font-size:0.8rem">${g.code_operation || '-'}</code></td>
      <td>
        <strong>${g.designation}</strong>
        ${g.points_cles ? `<div style="font-size:0.75rem;color:var(--warning);margin-top:2px">⚠️ ${g.points_cles}</div>` : ''}
      </td>
      <td>${g.poste ? `<span class="poste-badge">${g.poste}</span>` : '-'}</td>
      <td style="font-size:0.8rem;color:var(--muted)">${g.type_machine || '-'}</td>
      <td><strong>${g.temps_standard || 0}</strong> min</td>
      <td>${g.taux_horaire ? g.taux_horaire.toFixed(2) + ' €/h' : '-'}</td>
      <td style="font-weight:700;color:var(--accent)">${cout.toFixed(3)} €</td>
      <td style="font-size:0.8rem;color:var(--muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.description || '-'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="editGamme(${g.id})">✏️</button>
          <button class="btn btn-outline btn-sm text-danger" onclick="deleteGamme(${g.id})">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  document.getElementById('dtGammeTbody').innerHTML = tbody || `<tr><td colspan="10" class="table-empty">Aucune opération</td></tr>`;
  document.getElementById('dtGammeFoot').innerHTML = `<tr style="background:var(--light)">
    <td colspan="5" style="padding:10px 14px;font-weight:600;text-align:right">Totaux</td>
    <td style="padding:10px 14px;font-weight:800">${totalTemps.toFixed(1)} min</td>
    <td></td>
    <td style="padding:10px 14px;font-weight:800;color:var(--accent)">${totalCout.toFixed(3)} €</td>
    <td colspan="2"></td>
  </tr>`;
  document.getElementById('dtGammeStats').textContent =
    ops.length ? `${ops.length} opérations · ${totalTemps.toFixed(1)} min / pièce` : '';
}

function openGammeModal(id = null) {
  const g = id ? dt.data.gamme.find(x => x.id === id) : null;
  document.getElementById('gam_id').value = id || '';
  document.getElementById('modalGammeTitle').textContent = id ? 'Modifier l\'opération' : 'Ajouter une opération';
  document.getElementById('gam_code').value = g?.code_operation || '';
  document.getElementById('gam_designation').value = g?.designation || '';
  document.getElementById('gam_poste').value = g?.poste || '';
  document.getElementById('gam_machine').value = g?.type_machine || '';
  document.getElementById('gam_ordre').value = g?.ordre ?? (dt.data.gamme.length * 10 + 10);
  document.getElementById('gam_temps').value = g?.temps_standard || '';
  document.getElementById('gam_taux').value = g?.taux_horaire || '';
  document.getElementById('gam_description').value = g?.description || '';
  document.getElementById('gam_points_cles').value = g?.points_cles || '';
  document.getElementById('modalGamme').classList.remove('hidden');
}

function editGamme(id) { openGammeModal(id); }

async function saveGamme() {
  const id = document.getElementById('gam_id').value;
  const body = {
    code_operation: document.getElementById('gam_code').value,
    designation: document.getElementById('gam_designation').value,
    poste: document.getElementById('gam_poste').value,
    type_machine: document.getElementById('gam_machine').value,
    ordre: +document.getElementById('gam_ordre').value || 0,
    temps_standard: +document.getElementById('gam_temps').value || 0,
    taux_horaire: +document.getElementById('gam_taux').value || 0,
    description: document.getElementById('gam_description').value,
    points_cles: document.getElementById('gam_points_cles').value,
  };
  if (!body.designation) return toast('Désignation requise', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/gamme/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/gamme`, body);
    closeModal('modalGamme');
    toast(id ? 'Opération mise à jour' : 'Opération ajoutée');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderGamme();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteGamme(id) {
  if (!confirm('Supprimer cette opération ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/gamme/${id}`);
  toast('Opération supprimée');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderGamme();
}

// ===== PLACEMENT =====

function renderPlacement() {
  const rows = dt.data.placement;
  const sensLabels = { unidirectionnel: 'Unidirectionnel', bidirectionnel: 'Bidirectionnel', en_retourne: 'En retourné' };
  document.getElementById('dtPlacementTbody').innerHTML = rows.length === 0
    ? `<tr><td colspan="10" class="table-empty">Aucun placement défini</td></tr>`
    : rows.map(p => `<tr>
        <td><code style="font-size:0.8rem">${p.reference || '-'}</code></td>
        <td><strong>${p.designation}</strong></td>
        <td>${p.laize ? p.laize + ' cm' : '-'}</td>
        <td>${p.longueur_matelas ? p.longueur_matelas + ' cm' : '-'}</td>
        <td>${p.nb_epaisseurs}</td>
        <td>${p.nb_poses}</td>
        <td>${p.rendement ? `<strong>${p.rendement}%</strong>` : '-'}</td>
        <td><span class="badge badge-secondary">${sensLabels[p.sens] || p.sens}</span></td>
        <td style="font-size:0.8rem;color:var(--muted)">${p.notes || '-'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-outline btn-sm" onclick="editPlacement(${p.id})">✏️</button>
            <button class="btn btn-outline btn-sm text-danger" onclick="deletePlacement(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
}

function openPlacementModal(id = null) {
  const p = id ? dt.data.placement.find(x => x.id === id) : null;
  document.getElementById('pl_id').value = id || '';
  document.getElementById('modalPlacementTitle').textContent = id ? 'Modifier le placement' : 'Ajouter un placement';
  document.getElementById('pl_reference').value = p?.reference || '';
  document.getElementById('pl_designation').value = p?.designation || '';
  document.getElementById('pl_laize').value = p?.laize || '';
  document.getElementById('pl_longueur').value = p?.longueur_matelas || '';
  document.getElementById('pl_epaisseurs').value = p?.nb_epaisseurs || 1;
  document.getElementById('pl_poses').value = p?.nb_poses || 1;
  document.getElementById('pl_rendement').value = p?.rendement || '';
  document.getElementById('pl_sens').value = p?.sens || 'unidirectionnel';
  document.getElementById('pl_notes').value = p?.notes || '';
  document.getElementById('modalPlacement').classList.remove('hidden');
}

function editPlacement(id) { openPlacementModal(id); }

async function savePlacement() {
  const id = document.getElementById('pl_id').value;
  const body = {
    reference: document.getElementById('pl_reference').value,
    designation: document.getElementById('pl_designation').value,
    laize: +document.getElementById('pl_laize').value || null,
    longueur_matelas: +document.getElementById('pl_longueur').value || null,
    nb_epaisseurs: +document.getElementById('pl_epaisseurs').value || 1,
    nb_poses: +document.getElementById('pl_poses').value || 1,
    rendement: +document.getElementById('pl_rendement').value || null,
    sens: document.getElementById('pl_sens').value,
    notes: document.getElementById('pl_notes').value,
  };
  if (!body.designation) return toast('Désignation requise', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/placement/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/placement`, body);
    closeModal('modalPlacement');
    toast(id ? 'Placement mis à jour' : 'Placement ajouté');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderPlacement();
  } catch (e) { toast(e.message, 'error'); }
}

async function deletePlacement(id) {
  if (!confirm('Supprimer ce placement ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/placement/${id}`);
  toast('Placement supprimé');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderPlacement();
}

// ===== MESURES =====

function renderMesures() {
  const cfg = dt.data.mesures_config;
  const tailles = cfg ? cfg.echelle.split(',').map(t => t.trim()) : ['S', 'M', 'L', 'XL'];
  const base = cfg?.taille_base || 'M';
  dt.tailles = tailles;
  document.getElementById('dt_mesures_echelle').value = cfg?.echelle || 'S,M,L,XL';
  document.getElementById('dt_mesures_base').value = base;

  const thTailles = tailles.map(t =>
    `<th class="taille-col ${t === base ? 'taille-header-base' : ''}">${t}${t === base ? ' ★' : ''}</th>`
  ).join('');
  document.getElementById('dtMesuresHead').innerHTML = `<tr>
    <th>Point de mesure</th>${thTailles}
    <th style="text-align:center">Tol. +</th>
    <th style="text-align:center">Tol. -</th>
    <th>Méthode</th><th></th>
  </tr>`;

  const rows = dt.data.mesures_lignes;
  document.getElementById('dtMesuresTbody').innerHTML = rows.length === 0
    ? `<tr><td colspan="${tailles.length + 5}" class="table-empty">Aucun point de mesure</td></tr>`
    : rows.map(m => {
        let vals = {};
        try { vals = typeof m.valeurs === 'string' ? JSON.parse(m.valeurs) : m.valeurs; } catch (_) {}
        const tdTailles = tailles.map(t => `<td class="taille-val">${vals[t] ?? '-'}</td>`).join('');
        return `<tr>
          <td><strong>${m.point_mesure}</strong>${m.methode ? `<div style="font-size:0.72rem;color:var(--muted)">${m.methode}</div>` : ''}</td>
          ${tdTailles}
          <td class="tol-col">+${m.tolerance_plus}</td>
          <td class="tol-col">-${m.tolerance_moins}</td>
          <td style="font-size:0.8rem;color:var(--muted)">${m.methode || '-'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="editMesure(${m.id})">✏️</button>
              <button class="btn btn-outline btn-sm text-danger" onclick="deleteMesure(${m.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
}

async function saveMesuresConfig() {
  const echelle = document.getElementById('dt_mesures_echelle').value;
  const taille_base = document.getElementById('dt_mesures_base').value;
  await api('PUT', `/dossiers/${dt.id}/mesures/config`, { echelle, taille_base });
  toast('Échelle mise à jour');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderMesures();
}

function openMesureModal(id = null) {
  const m = id ? dt.data.mesures_lignes.find(x => x.id === id) : null;
  let vals = {};
  if (m) { try { vals = typeof m.valeurs === 'string' ? JSON.parse(m.valeurs) : m.valeurs; } catch (_) {} }
  document.getElementById('mes_id').value = id || '';
  document.getElementById('modalMesureTitle').textContent = id ? 'Modifier le point de mesure' : 'Ajouter un point de mesure';
  document.getElementById('mes_point').value = m?.point_mesure || '';
  document.getElementById('mes_tol_plus').value = m?.tolerance_plus ?? 1;
  document.getElementById('mes_tol_moins').value = m?.tolerance_moins ?? 1;
  document.getElementById('mes_methode').value = m?.methode || '';

  const wrap = document.getElementById('mes_valeurs_wrap');
  const tailles = dt.tailles.length ? dt.tailles : ['S', 'M', 'L', 'XL'];
  wrap.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
    ${tailles.map(t => `
      <div class="form-group" style="margin:0">
        <label class="form-label" style="font-size:0.75rem">${t} (cm)</label>
        <input type="number" class="form-control" id="mes_val_${t}" step="0.5" value="${vals[t] || ''}" placeholder="—">
      </div>`).join('')}
  </div>`;
  document.getElementById('modalMesure').classList.remove('hidden');
}

function editMesure(id) { openMesureModal(id); }

async function saveMesure() {
  const id = document.getElementById('mes_id').value;
  const tailles = dt.tailles.length ? dt.tailles : ['S', 'M', 'L', 'XL'];
  const valeurs = {};
  tailles.forEach(t => {
    const v = document.getElementById(`mes_val_${t}`)?.value;
    if (v !== '' && v !== undefined) valeurs[t] = +v;
  });
  const body = {
    point_mesure: document.getElementById('mes_point').value,
    valeurs,
    tolerance_plus: +document.getElementById('mes_tol_plus').value || 1,
    tolerance_moins: +document.getElementById('mes_tol_moins').value || 1,
    methode: document.getElementById('mes_methode').value,
    ordre: dt.data.mesures_lignes.length,
  };
  if (!body.point_mesure) return toast('Point de mesure requis', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/mesures/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/mesures`, body);
    closeModal('modalMesure');
    toast(id ? 'Mesure mise à jour' : 'Mesure ajoutée');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderMesures();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMesure(id) {
  if (!confirm('Supprimer ce point de mesure ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/mesures/${id}`);
  toast('Mesure supprimée');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderMesures();
}

// ===== QUALITE =====

function renderQualite() {
  const rows = dt.data.qualite;
  document.getElementById('dtQualiteTbody').innerHTML = rows.length === 0
    ? `<tr><td colspan="10" class="table-empty">Aucun critère qualité défini</td></tr>`
    : rows.map((q, i) => {
        const graviteIco = { critique: '🔴', majeur: '🟠', mineur: '🟡' }[q.gravite] || '';
        return `<tr>
          <td style="color:var(--muted)">${i + 1}</td>
          <td><strong>${q.critere}</strong></td>
          <td style="font-size:0.8rem">${q.specification || '-'}</td>
          <td style="font-weight:600">${q.valeur_attendue || '-'}</td>
          <td style="font-size:0.8rem">${q.tolerance || '-'}</td>
          <td style="font-size:0.8rem">${q.methode_controle || '-'}</td>
          <td><span class="badge badge-secondary">${q.frequence || '-'}</span></td>
          <td style="font-size:0.8rem">${q.niveau_acceptation || '-'}</td>
          <td class="gravite-${q.gravite}">${graviteIco} ${q.gravite}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-outline btn-sm" onclick="editQualite(${q.id})">✏️</button>
              <button class="btn btn-outline btn-sm text-danger" onclick="deleteQualite(${q.id})">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
}

function openQualiteModal(id = null) {
  const q = id ? dt.data.qualite.find(x => x.id === id) : null;
  document.getElementById('qua_id').value = id || '';
  document.getElementById('modalQualiteTitle').textContent = id ? 'Modifier le critère' : 'Ajouter un critère qualité';
  document.getElementById('qua_critere').value = q?.critere || '';
  document.getElementById('qua_specification').value = q?.specification || '';
  document.getElementById('qua_valeur').value = q?.valeur_attendue || '';
  document.getElementById('qua_tolerance').value = q?.tolerance || '';
  document.getElementById('qua_methode').value = q?.methode_controle || '';
  document.getElementById('qua_frequence').value = q?.frequence || '100%';
  document.getElementById('qua_aql').value = q?.niveau_acceptation || 'AQL 2.5';
  document.getElementById('qua_gravite').value = q?.gravite || 'majeur';
  document.getElementById('modalQualite').classList.remove('hidden');
}

function editQualite(id) { openQualiteModal(id); }

async function saveQualite() {
  const id = document.getElementById('qua_id').value;
  const body = {
    critere: document.getElementById('qua_critere').value,
    specification: document.getElementById('qua_specification').value,
    valeur_attendue: document.getElementById('qua_valeur').value,
    tolerance: document.getElementById('qua_tolerance').value,
    methode_controle: document.getElementById('qua_methode').value,
    frequence: document.getElementById('qua_frequence').value,
    niveau_acceptation: document.getElementById('qua_aql').value,
    gravite: document.getElementById('qua_gravite').value,
    ordre: dt.data.qualite.length,
  };
  if (!body.critere) return toast('Critère requis', 'error');
  try {
    if (id) await api('PUT', `/dossiers/${dt.id}/qualite/${id}`, body);
    else await api('POST', `/dossiers/${dt.id}/qualite`, body);
    closeModal('modalQualite');
    toast(id ? 'Critère mis à jour' : 'Critère ajouté');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderQualite();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteQualite(id) {
  if (!confirm('Supprimer ce critère ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/qualite/${id}`);
  toast('Critère supprimé');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderQualite();
}

// ===== PRIX DE REVIENT =====

function renderPrix() {
  const pr = dt.data.prix_revient;
  if (pr) {
    document.getElementById('pr_taux_mo').value = pr.taux_horaire_mo || 12;
    document.getElementById('pr_taux_charges').value = pr.taux_charges || 45;
    document.getElementById('pr_frais_fixes').value = pr.frais_fixes || 0;
    document.getElementById('pr_frais_transport').value = pr.frais_transport || 0;
    document.getElementById('pr_frais_divers').value = pr.frais_divers || 0;
    document.getElementById('pr_marge').value = pr.marge_percent || 30;
    document.getElementById('pr_notes').value = pr.notes || '';
  }
  calcPrix();
}

async function calcPrix() {
  try {
    const result = await api('GET', `/dossiers/${dt.id}/prix-revient/calcul`);
    const fmt = (v, devise = result.devise) => `${v.toFixed(2)} ${devise}`;
    const pctCout = (v) => result.cout_total_revient > 0 ? (100 * v / result.cout_total_revient).toFixed(1) : 0;

    // Décomposition barre
    const totalBarre = result.cout_matieres + result.cout_mo_avec_charges + result.frais_annexes;
    const pMat = totalBarre > 0 ? (100 * result.cout_matieres / totalBarre).toFixed(0) : 0;
    const pMO = totalBarre > 0 ? (100 * result.cout_mo_avec_charges / totalBarre).toFixed(0) : 0;
    const pFrais = totalBarre > 0 ? (100 * result.frais_annexes / totalBarre).toFixed(0) : 0;

    document.getElementById('prResultats').innerHTML = `
      <div class="pr-prix-grid">
        <div class="pr-prix-card">
          <div class="pr-prix-label">Coût matières</div>
          <div class="pr-prix-val">${fmt(result.cout_matieres)}</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${pMat}% du coût total</div>
        </div>
        <div class="pr-prix-card">
          <div class="pr-prix-label">Main d'œuvre (chargée)</div>
          <div class="pr-prix-val">${fmt(result.cout_mo_avec_charges)}</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${result.temps_total_min} min · ${pMO}% du coût</div>
        </div>
        <div class="pr-prix-card">
          <div class="pr-prix-label">Frais annexes</div>
          <div class="pr-prix-val">${fmt(result.frais_annexes)}</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">${pFrais}% du coût</div>
        </div>
      </div>

      <div class="pr-total-box" style="margin-bottom:16px">
        <div>
          <div class="pr-total-label">Prix de revient / pièce</div>
          <div class="pr-total-val">${fmt(result.cout_total_revient)}</div>
        </div>
        <div style="text-align:right">
          <div class="pr-total-label">Prix de vente HT (marge ${document.getElementById('pr_marge').value}%)</div>
          <div class="pr-total-val">${fmt(result.prix_vente_ht)}</div>
        </div>
      </div>

      <div class="pr-section">
        <div class="pr-section-header">
          <span>📊 Décomposition du coût</span>
          <span style="font-size:0.8rem;font-weight:400;color:var(--muted)">${result.matieres_detail.length} matière(s) · ${dt.data.gamme.length} opération(s)</span>
        </div>
        <div class="pr-section-body">
          ${result.matieres_detail.map(m => {
            const qte = m.quantite_par_piece * (1 + (m.perte_percent || 0) / 100);
            const c = qte * (m.prix_unitaire || 0);
            return `<div class="pr-ligne">
              <span class="pr-ligne-label">${m.designation}</span>
              <span class="pr-ligne-val">${c.toFixed(3)} ${result.devise}</span>
            </div>`;
          }).join('')}
          <div class="pr-ligne" style="background:rgba(52,152,219,0.04)">
            <span style="font-weight:600">Total matières</span>
            <span style="font-weight:700;color:var(--accent)">${fmt(result.cout_matieres)}</span>
          </div>
          <div class="pr-ligne">
            <span class="pr-ligne-label">MO directe (${result.temps_total_min} min × ${document.getElementById('pr_taux_mo').value}€/h)</span>
            <span class="pr-ligne-val">${fmt(result.cout_mo_base)}</span>
          </div>
          <div class="pr-ligne">
            <span class="pr-ligne-label">Charges sociales (${document.getElementById('pr_taux_charges').value}%)</span>
            <span class="pr-ligne-val">${fmt(result.cout_mo_avec_charges - result.cout_mo_base)}</span>
          </div>
          <div class="pr-ligne" style="background:rgba(52,152,219,0.04)">
            <span style="font-weight:600">Total main d'œuvre chargée</span>
            <span style="font-weight:700;color:var(--accent)">${fmt(result.cout_mo_avec_charges)}</span>
          </div>
          <div class="pr-ligne">
            <span class="pr-ligne-label">Frais fixes + transport + divers</span>
            <span class="pr-ligne-val">${fmt(result.frais_annexes)}</span>
          </div>
          <div class="pr-ligne" style="background:rgba(39,174,96,0.05)">
            <span style="font-weight:700">= PRIX DE REVIENT</span>
            <span style="font-weight:800;font-size:1rem;color:var(--success)">${fmt(result.cout_total_revient)}</span>
          </div>
          <div class="pr-ligne">
            <span class="pr-ligne-label">Marge brute (${document.getElementById('pr_marge').value}%)</span>
            <span class="pr-ligne-val text-success">${fmt(result.marge_brute)}</span>
          </div>
          <div class="pr-ligne" style="background:rgba(52,152,219,0.08)">
            <span style="font-weight:700">= PRIX DE VENTE HT</span>
            <span style="font-weight:800;font-size:1rem;color:var(--accent)">${fmt(result.prix_vente_ht)}</span>
          </div>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('prResultats').innerHTML = `<div class="table-empty">Impossible de calculer (${e.message})</div>`;
  }
}

async function savePrixRevient() {
  const body = {
    taux_horaire_mo: +document.getElementById('pr_taux_mo').value,
    taux_charges: +document.getElementById('pr_taux_charges').value,
    frais_fixes: +document.getElementById('pr_frais_fixes').value,
    frais_transport: +document.getElementById('pr_frais_transport').value,
    frais_divers: +document.getElementById('pr_frais_divers').value,
    marge_percent: +document.getElementById('pr_marge').value,
    notes: document.getElementById('pr_notes').value,
  };
  try {
    await api('PUT', `/dossiers/${dt.id}/prix-revient`, body);
    toast('Paramètres sauvegardés');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    calcPrix();
  } catch (e) { toast(e.message, 'error'); }
}

// ===== SUIVI =====

function renderSuivi() {
  const items = dt.data.suivi;
  const icons = { commentaire: '💬', modification: '✏️', validation: '✅', alerte: '⚠️' };
  document.getElementById('dtSuiviList').innerHTML = items.length === 0
    ? '<div class="table-empty card" style="padding:32px;text-align:center">Aucun commentaire pour l\'instant.</div>'
    : items.map((s, i) => `
      <div class="suivi-item">
        <div class="suivi-dot-wrap">
          <div class="suivi-dot ${s.type}">${icons[s.type] || '💬'}</div>
          ${i < items.length - 1 ? '<div class="suivi-line"></div>' : ''}
        </div>
        <div class="suivi-content">
          <div class="suivi-meta">
            <span class="suivi-auteur">${s.auteur}</span>
            <span class="badge badge-secondary" style="font-size:0.65rem">${s.type}</span>
            <span class="suivi-date ms-auto">${new Date(s.created_at).toLocaleString('fr-FR')}</span>
            <button class="btn btn-icon btn-outline" style="padding:2px 6px;font-size:0.75rem" onclick="deleteSuivi(${s.id})">✕</button>
          </div>
          <div class="suivi-texte">${s.contenu}</div>
        </div>
      </div>`).join('');
}

async function addSuivi() {
  const body = {
    type: document.getElementById('suivi_type').value,
    auteur: document.getElementById('suivi_auteur').value,
    contenu: document.getElementById('suivi_contenu').value,
  };
  if (!body.auteur || !body.contenu) return toast('Auteur et commentaire requis', 'error');
  try {
    await api('POST', `/dossiers/${dt.id}/suivi`, body);
    document.getElementById('suivi_contenu').value = '';
    toast('Commentaire ajouté');
    dt.data = await api('GET', `/dossiers/${dt.id}`);
    renderSuivi();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSuivi(id) {
  if (!confirm('Supprimer ce commentaire ?')) return;
  await api('DELETE', `/dossiers/${dt.id}/suivi/${id}`);
  toast('Commentaire supprimé');
  dt.data = await api('GET', `/dossiers/${dt.id}`);
  renderSuivi();
}

// ===== PRINT =====

function printDossier() {
  // Affiche tous les onglets avant impression
  document.querySelectorAll('.dt-tab').forEach(t => t.style.display = 'block');
  window.print();
  document.querySelectorAll('.dt-tab').forEach(t => t.style.display = '');
  const activeTab = document.querySelector('#dtTabs .tab.active')?.dataset.tab || 'nomenclature';
  document.querySelectorAll('.dt-tab').forEach(t =>
    t.classList.toggle('active', t.id === `dt-tab-${activeTab}`));
}

// Patch navigate pour charger les dossiers
const _origNavigate = navigate;
window.navigate = function(page) {
  _origNavigate(page);
  if (page === 'dossiers') loadDossiers();
};
