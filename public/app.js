const API = '';
let map, markers = { etabs: [], profs: [], signals: [], zones: [] };
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
});

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
            if (view === 'dashboard') loadDashboard();
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
        if (!selectedType) return alert('Sélectionnez un type de signal');

        const data = {
            type: selectedType,
            description: document.getElementById('description').value,
            duree_attente_min: document.getElementById('duree').value ? parseInt(document.getElementById('duree').value) : null,
            latitude: parseFloat(document.getElementById('signal-lat').value),
            longitude: parseFloat(document.getElementById('signal-lng').value),
            auteur_pseudo: document.getElementById('pseudo').value || null
        };

        if (!data.latitude || !data.longitude) return alert('Géolocalisez ou cliquez sur la carte');

        try {
            const res = await fetch(`${API}/api/signalements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            alert('Signalement envoyé ! Merci.');
            document.getElementById('signal-form').reset();
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
            selectedType = null;
            loadData();
        } catch (err) {
            alert('Erreur d\'envoi');
        }
    });
}

function initSearch() {
    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    const doSearch = async () => {
        const q = input.value.trim();
        if (!q) return;

        try {
            const res = await fetch(`${API}/api/data/recherche?q=${encodeURIComponent(q)}&lat=${userLat}&lng=${userLng}`);
            const results = await res.json();
            if (results.length > 0) {
                const first = results[0];
                if (first.latitude && first.longitude) {
                    map.setView([first.latitude, first.longitude], 13);
                }
            }
        } catch (err) {
            console.error('Search error:', err);
        }
    };

    btn.addEventListener('click', doSearch);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') doSearch();
    });
}

function initLayers() {
    ['etabs', 'profs', 'signals', 'zones'].forEach(layer => {
        document.getElementById(`layer-${layer}`).addEventListener('change', (e) => {
            const visible = e.target.checked;
            markers[layer].forEach(m => {
                if (visible) m.addTo(map);
                else map.removeLayer(m);
            });
        });
    });
}

function getUserLocation() {
    document.getElementById('locate-btn').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                map.setView([userLat, userLng], 12);
                loadData();
            });
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            map.setView([userLat, userLng], 10);
            loadData();
        });
    }
}

async function loadData() {
    try {
        const [etabsRes, profsRes, signalsRes] = await Promise.all([
            fetch(`${API}/api/data/etablissements?lat=${userLat}&lng=${userLng}&rayon=100&limit=300`),
            fetch(`${API}/api/data/professionnels?lat=${userLat}&lng=${userLng}&rayon=100&limit=300`),
            fetch(`${API}/api/signalements?lat=${userLat}&lng=${userLng}&rayon=200`)
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
    Object.values(markers).forEach(arr => {
        arr.forEach(m => map.removeLayer(m));
        arr.length = 0;
    });
}

function renderEtablissements(etabs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-etab',
        iconSize: [16, 16]
    });

    etabs.forEach(e => {
        if (!e.latitude || !e.longitude) return;
        const marker = L.marker([e.latitude, e.longitude], { icon })
            .bindPopup(`
                <strong>${e.nom}</strong><br>
                <small>${e.type || ''}</small><br>
                ${e.adresse || ''}<br>
                ${e.code_postal || ''} ${e.commune || ''}<br>
                ${e.telephone ? '📞 ' + e.telephone : ''}
            `);
        markers.etabs.push(marker);
        if (document.getElementById('layer-etabs').checked) {
            marker.addTo(map);
        }
    });
}

function renderProfessionnels(profs) {
    const icon = L.divIcon({
        className: 'custom-marker marker-prof',
        iconSize: [14, 14]
    });

    profs.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const marker = L.marker([p.latitude, p.longitude], { icon })
            .bindPopup(`
                <strong>Dr. ${p.nom} ${p.prenom || ''}</strong><br>
                <small>${p.profession || ''}</small><br>
                ${p.specialite ? p.specialite + '<br>' : ''}
                ${p.secteur || ''}<br>
                ${p.adresse || ''}<br>
                ${p.code_postal || ''} ${p.commune || ''}
            `);
        markers.profs.push(marker);
        if (document.getElementById('layer-profs').checked) {
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
                ${s.description || ''}<br>
                ${s.duree_attente_min ? '⏱️ ' + s.duree_attente_min + ' min' : ''}<br>
                <small>${formatDate(s.date_signalement)} · ${s.commune || ''}</small><br>
                <small>Par ${s.auteur_pseudo || 'Anonyme'}</small><br>
                <button onclick="voteSignal(${s.id}, 'up')" style="margin-top:5px;padding:3px 8px;border:1px solid #27ae60;border-radius:4px;background:white;cursor:pointer;">👍 ${s.votes_up || 0}</button>
                <button onclick="voteSignal(${s.id}, 'down')" style="padding:3px 8px;border:1px solid #e74c3c;border-radius:4px;background:white;cursor:pointer;">👎 ${s.votes_down || 0}</button>
            `);
        markers.signals.push(marker);
        if (document.getElementById('layer-signals').checked) {
            marker.addTo(map);
        }
    });
}

function getTypeLabel(type) {
    const labels = {
        attente: '⏱️ Temps d\'attente',
        fermeture: '🚫 Fermeture',
        satisfaction: '⭐ Satisfaction',
        manque: '❌ Manque de soins'
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
        recentList.innerHTML = data.signalements_recents.map(s => `
            <div class="signal-item">
                <div class="signal-type-icon ${s.type}">${getTypeIcon(s.type)}</div>
                <div class="signal-details">
                    <div class="signal-desc">${s.description || getTypeLabel(s.type)}</div>
                    <div class="signal-meta">${s.commune || ''} · ${formatDate(s.date_signalement)}</div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Stats error:', err);
    }
}

function getTypeIcon(type) {
    const icons = { attente: '⏱️', fermeture: '🚫', satisfaction: '⭐', manque: '❌' };
    return icons[type] || '📋';
}

function renderBarChart(containerId, data, labelKey, valueKey, colors) {
    const container = document.getElementById(containerId);
    if (!data.length) {
        container.innerHTML = '<p class="loading">Aucune donnée</p>';
        return;
    }

    const max = Math.max(...data.map(d => d[valueKey]));
    container.innerHTML = `<div class="bar-chart">${data.slice(0, 10).map((d, i) => `
        <div class="bar-row">
            <div class="bar-label">${d[labelKey] || 'N/A'}</div>
            <div class="bar-fill" style="width:${(d[valueKey] / max * 100)}%;background:${colors[i % colors.length]}">${d[valueKey]}</div>
        </div>
    `).join('')}</div>`;
}

async function loadDashboard() {
    try {
        const res = await fetch(`${API}/api/stats/dashboard`);
        const data = await res.json();

        document.getElementById('dashboard-content').innerHTML = `
            <div class="dash-card">
                <h3>Total établissements</h3>
                <div class="value">${data.resume.etablissements.toLocaleString()}</div>
            </div>
            <div class="dash-card">
                <h3>Total professionnels</h3>
                <div class="value">${data.resume.professionnels.toLocaleString()}</div>
            </div>
            <div class="dash-card">
                <h3>Total signalements</h3>
                <div class="value">${data.resume.signalements.toLocaleString()}</div>
            </div>
            <div class="dash-card">
                <h3>Types d'établissements</h3>
                <div>${data.types_etablissements.map(e => `<div>${e.type}: <strong>${e.total}</strong></div>`).join('')}</div>
            </div>
            <div class="dash-card">
                <h3>Professions représentées</h3>
                <div>${data.professions_top.map(p => `<div>${p.profession}: <strong>${p.total}</strong></div>`).join('')}</div>
            </div>
            <div class="dash-card">
                <h3>Export CSV</h3>
                <p style="font-size:0.85rem;color:#95a5a6;">Téléchargez les données agrégées pour vos analyses</p>
                <button onclick="alert('Export en cours de développement')" class="btn-secondary" style="margin-top:0.5rem;">📥 Télécharger</button>
            </div>
        `;
    } catch (err) {
        document.getElementById('dashboard-content').innerHTML = '<p class="loading">Erreur de chargement</p>';
    }
}
