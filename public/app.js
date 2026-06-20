const API = '';
let map, markers = { etabs: [], profs: [], signals: [], search: [] };
let userLat = 46.603354, userLng = 1.888334;
let selectedType = null;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initNav();
    initForm();
    initSearch();
    initLayers();
    loadData();
    getUserLocation();
    pollImportStatus();
});

async function pollImportStatus() {
    try {
        const res = await fetch('/api/import-status');
        const status = await res.json();
        if (status.status === 'pending' || status.status === 'running' || status.status === 'starting') {
            showImportBanner(status.message || 'Chargement des données...');
            setTimeout(pollImportStatus, 10000);
        } else if (status.status === 'done') {
            hideImportBanner();
            loadData();
        } else if (status.status === 'error') {
            showImportBanner(status.message || 'Erreur');
            document.getElementById('import-banner').style.background = '#e74c3c';
            document.getElementById('import-banner').style.color = 'white';
        } else {
            hideImportBanner();
        }
    } catch (e) {
        hideImportBanner();
    }
}

function showImportBanner(msg) {
    let banner = document.getElementById('import-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'import-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#000;text-align:center;padding:10px;z-index:10000;font-weight:bold;font-size:14px;';
        document.body.prepend(banner);
    }
    banner.textContent = msg;
    banner.style.display = 'block';
}

function hideImportBanner() {
    const banner = document.getElementById('import-banner');
    if (banner) banner.style.display = 'none';
}

function initMap() {
    map = L.map('map').setView([userLat, userLng], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    map.on('click', (e) => {
        if (document.getElementById('view-signaler').classList.contains('active')) {
            document.getElementById('signal-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('signal-lng').value = e.latlng.lng.toFixed(6);
        }
    });
}

function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${view}`).classList.add('active');

            if (view === 'stats') loadStats();
        });
    });
}

function initForm() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedType = btn.dataset.type;

            const dureeGroup = document.getElementById('duree-group');
            dureeGroup.style.display = selectedType === 'attente' ? 'block' : 'none';
        });
    });

    document.getElementById('get-location-btn').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                document.getElementById('signal-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('signal-lng').value = pos.coords.longitude.toFixed(6);
            });
        }
    });

    document.getElementById('signal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedType) return alert('Selectionnez un type de signal');

        const data = {
            type: selectedType,
            description: document.getElementById('description').value,
            duree_attente_min: document.getElementById('duree').value ? parseInt(document.getElementById('duree').value) : null,
            latitude: parseFloat(document.getElementById('signal-lat').value),
            longitude: parseFloat(document.getElementById('signal-lng').value),
            auteur_pseudo: document.getElementById('pseudo').value || null
        };

        if (!data.latitude || !data.longitude) return alert('Geolocalisez ou cliquez sur la carte');

        try {
            await fetch(`${API}/api/signalements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            alert('Signalement envoye ! Merci.');
            document.getElementById('signal-form').reset();
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            selectedType = null;
            loadData();
        } catch (err) {
            alert("Erreur d'envoi");
        }
    });
}

function initSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');
    const resultsDiv = document.getElementById('search-results') || createSearchResults();

    const doSearch = async () => {
        const q = input.value.trim();
        if (!q || q.length < 2) return;

        resultsDiv.innerHTML = '<div style="padding:10px;color:#999;">Recherche...</div>';
        resultsDiv.style.display = 'block';

        try {
            const res = await fetch(`${API}/api/data/recherche?q=${encodeURIComponent(q)}&lat=${userLat}&lng=${userLng}&rayon=200`);
            const results = await res.json();

            clearSearchMarkers();

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="padding:10px;color:#999;">Aucun resultat</div>';
                return;
            }

            let html = `<div style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #eee;">${results.length} resultat(s) pour "${q}"</div>`;

            results.forEach(r => {
                const icon = r.source === 'etablissement' ? '🏥' : '👨‍⚕️';
                html += `<div class="search-item" onclick="zoomToResult(${r.latitude},${r.longitude})">
                    <span>${icon}</span>
                    <div><strong>${r.name || ''}</strong><br><small>${r.categorie || ''} · ${r.commune || ''} ${r.code_postal || ''}</small></div>
                </div>`;

                if (r.latitude && r.longitude) {
                    const color = r.source === 'etablissement' ? '#3498db' : '#27ae60';
                    const icon2 = L.divIcon({
                        className: 'custom-marker marker-search',
                        iconSize: [20, 20],
                        html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;">${r.source === 'etablissement' ? 'H' : 'D'}</div>`
                    });
                    const m = L.marker([r.latitude, r.longitude], { icon: icon2 })
                        .bindPopup(`<strong>${r.name || ''}</strong><br>${r.categorie || ''}<br>${r.adresse || ''}<br>${r.commune || ''}`);
                    m.addTo(map);
                    markers.search.push(m);
                }
            });

            resultsDiv.innerHTML = html;

            if (results[0].latitude && results[0].longitude) {
                map.setView([results[0].latitude, results[0].longitude], 13);
            }
        } catch (err) {
            console.error('Search error:', err);
            resultsDiv.innerHTML = '<div style="padding:10px;color:#e74c3c;">Erreur de recherche</div>';
        }
    };

    btn.addEventListener('click', doSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
}

function createSearchResults() {
    const div = document.createElement('div');
    div.id = 'search-results';
    div.style.cssText = 'position:absolute;top:60px;right:10px;width:300px;max-height:400px;overflow-y:auto;background:white;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.15);z-index:1000;display:none;';
    document.getElementById('map').parentElement.style.position = 'relative';
    document.getElementById('map').parentElement.appendChild(div);
    return div;
}

window.zoomToResult = (lat, lng) => {
    if (lat && lng) map.setView([lat, lng], 15);
};

function clearSearchMarkers() {
    markers.search.forEach(m => map.removeLayer(m));
    markers.search = [];
}

function initLayers() {
    ['etabs', 'profs', 'signals'].forEach(layer => {
        const el = document.getElementById(`layer-${layer}`);
        if (el) {
            el.addEventListener('change', (e) => {
                const visible = e.target.checked;
                markers[layer].forEach(m => {
                    if (visible) m.addTo(map);
                    else map.removeLayer(m);
                });
            });
        }
    });
}

function getUserLocation() {
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                    map.setView([userLat, userLng], 12);
                    loadData();
                });
            }
        });
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            map.setView([userLat, userLng], 6);
            loadData();
        }, () => {
            loadData();
        });
    } else {
        loadData();
    }
}

async function loadData() {
    try {
        const [etabsRes, profsRes, signalsRes] = await Promise.all([
            fetch(`${API}/api/data/etablissements?lat=${userLat}&lng=${userLng}&rayon=200&limit=500`),
            fetch(`${API}/api/data/professionnels?lat=${userLat}&lng=${userLng}&rayon=200&limit=500`),
            fetch(`${API}/api/signalements?lat=${userLat}&lng=${userLng}&rayon=500`)
        ]);

        const etabs = await etabsRes.json();
        const profs = await profsRes.json();
        const signals = await signalsRes.json();

        clearMarkers();
        renderEtablissements(etabs);
        renderProfessionnels(profs);
        renderSignalements(signals);

        document.getElementById('count-etabs').textContent = etabs.length;
        document.getElementById('count-profs').textContent = profs.length;
        document.getElementById('count-signals').textContent = signals.length;

    } catch (err) {
        console.error('Load error:', err);
    }
}

function clearMarkers() {
    ['etabs', 'profs', 'signals'].forEach(layer => {
        markers[layer].forEach(m => map.removeLayer(m));
        markers[layer] = [];
    });
}

function renderEtablissements(etabs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-etab',
        iconSize: [10, 10]
    });

    etabs.forEach(e => {
        if (!e.latitude || !e.longitude) return;
        const marker = L.marker([e.latitude, e.longitude], { icon })
            .bindPopup(`
                <strong>${escapeHtml(e.nom)}</strong><br>
                <small>${escapeHtml(e.type || '')}</small><br>
                ${escapeHtml(e.adresse || '')}<br>
                ${escapeHtml(e.code_postal || '')} ${escapeHtml(e.commune || '')}<br>
                ${e.telephone ? 'Tel: ' + escapeHtml(e.telephone) : ''}
            `);
        markers.etabs.push(marker);
        if (document.getElementById('layer-etabs') && document.getElementById('layer-etabs').checked) {
            marker.addTo(map);
        }
    });
}

function renderProfessionnels(profs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-prof',
        iconSize: [10, 10]
    });

    profs.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const marker = L.marker([p.latitude, p.longitude], { icon })
            .bindPopup(`
                <strong>${escapeHtml(p.nom)} ${escapeHtml(p.prenom || '')}</strong><br>
                <small>${escapeHtml(p.profession || '')}</small><br>
                ${p.specialite ? escapeHtml(p.specialite) + '<br>' : ''}
                ${p.secteur ? 'Secteur ' + escapeHtml(p.secteur) + '<br>' : ''}
                ${escapeHtml(p.adresse || '')}<br>
                ${escapeHtml(p.code_postal || '')} ${escapeHtml(p.commune || '')}
            `);
        markers.profs.push(marker);
        if (document.getElementById('layer-profs') && document.getElementById('layer-profs').checked) {
            marker.addTo(map);
        }
    });
}

function renderSignalements(signals) {
    signals.forEach(s => {
        const color = s.type === 'attente' ? '#f39c12' :
                      s.type === 'fermeture' ? '#e74c3c' :
                      s.type === 'satisfaction' ? '#27ae60' : '#9b59b6';

        const icon = L.divIcon({
            className: 'custom-marker marker-signal',
            iconSize: [20, 20],
            html: `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`
        });

        const marker = L.marker([s.latitude, s.longitude], { icon })
            .bindPopup(`
                <strong>${getTypeLabel(s.type)}</strong><br>
                ${escapeHtml(s.description || '')}<br>
                ${s.duree_attente_min ? s.duree_attente_min + ' min' : ''}<br>
                <small>${formatDate(s.date_signalement)} · ${escapeHtml(s.commune || '')}</small><br>
                <small>Par ${escapeHtml(s.auteur_pseudo || 'Anonyme')}</small><br>
                <div style="margin-top:5px;">
                    <button onclick="voteSignal(${s.id}, 'up')" style="padding:3px 8px;border:1px solid #27ae60;border-radius:4px;background:white;cursor:pointer;">+1 ${s.votes_up || 0}</button>
                    <button onclick="voteSignal(${s.id}, 'down')" style="padding:3px 8px;border:1px solid #e74c3c;border-radius:4px;background:white;cursor:pointer;">-1 ${s.votes_down || 0}</button>
                    <button onclick="editSignal(${s.id}, '${escapeHtml((s.description || '').replace(/'/g, "\\'"))}')" style="padding:3px 8px;border:1px solid #3498db;border-radius:4px;background:white;cursor:pointer;">Modifier</button>
                    <button onclick="deleteSignal(${s.id})" style="padding:3px 8px;border:1px solid #e74c3c;border-radius:4px;background:white;color:#e74c3c;cursor:pointer;">Supprimer</button>
                </div>
            `);
        markers.signals.push(marker);
        if (document.getElementById('layer-signals') && document.getElementById('layer-signals').checked) {
            marker.addTo(map);
        }
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getTypeLabel(type) {
    const labels = {
        attente: 'Temps d\'attente',
        fermeture: 'Fermeture',
        satisfaction: 'Satisfaction',
        manque: 'Manque de soins',
        manque_soins: 'Manque de soins'
    };
    return labels[type] || type;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

window.voteSignal = async (id, vote) => {
    try {
        await fetch(`${API}/api/signalements/${id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vote })
        });
        loadData();
    } catch (err) {
        console.error('Vote error:', err);
    }
};

window.editSignal = async (id, currentDesc) => {
    const newDesc = prompt('Modifier la description:', currentDesc);
    if (newDesc === null) return;
    try {
        await fetch(`${API}/api/signalements/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: newDesc })
        });
        loadData();
    } catch (err) {
        alert('Erreur de modification');
    }
};

window.deleteSignal = async (id) => {
    if (!confirm('Supprimer ce signalement ?')) return;
    try {
        await fetch(`${API}/api/signalements/${id}`, { method: 'DELETE' });
        loadData();
    } catch (err) {
        alert('Erreur de suppression');
    }
};

async function loadStats() {
    try {
        const res = await fetch(`${API}/api/stats/dashboard`);
        const data = await res.json();

        document.getElementById('stat-etabs').textContent = data.resume.etablissements.toLocaleString();
        document.getElementById('stat-profs').textContent = data.resume.professionnels.toLocaleString();
        document.getElementById('stat-signals').textContent = data.resume.signalements.toLocaleString();

        const avgWait = data.signalements_par_type.find(s => s.type === 'attente');
        document.getElementById('stat-wait').textContent = avgWait ? Math.round(avgWait.duree_moyenne) : '-';

        renderBarChart('chart-types', data.signalements_par_type, 'type', 'total', ['#f39c12', '#e74c3c', '#27ae60', '#9b59b6']);
        renderBarChart('chart-depts', data.top_departements_signalements, 'departement', 'total', ['#3498db']);

        const recentList = document.getElementById('recent-list');
        if (recentList) {
            recentList.innerHTML = data.signalements_recents.map(s => `
                <div class="signal-item">
                    <div class="signal-type-icon ${s.type}">${getTypeIcon(s.type)}</div>
                    <div class="signal-details">
                        <div class="signal-desc">${escapeHtml(s.description || getTypeLabel(s.type))}</div>
                        <div class="signal-meta">${escapeHtml(s.commune || '')} · ${formatDate(s.date_signalement)}</div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Stats error:', err);
    }
}

function getTypeIcon(type) {
    const icons = { attente: 'Attente', fermeture: 'Ferme', satisfaction: 'Satisfait', manque: 'Manque', manque_soins: 'Manque' };
    return icons[type] || '?';
}

function renderBarChart(containerId, data, labelKey, valueKey, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!data.length) {
        container.innerHTML = '<p class="loading">Aucune donnee</p>';
        return;
    }

    const max = Math.max(...data.map(d => d[valueKey]));
    container.innerHTML = `<div class="bar-chart">${data.slice(0, 10).map((d, i) => `
        <div class="bar-row">
            <div class="bar-label">${escapeHtml(d[labelKey] || 'N/A')}</div>
            <div class="bar-fill" style="width:${(d[valueKey] / max * 100)}%;background:${colors[i % colors.length]}">${d[valueKey]}</div>
        </div>
    `).join('')}</div>`;
}
