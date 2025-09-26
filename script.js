let scenario3Chart;

document.addEventListener('DOMContentLoaded', () => {
    setupInteractiveControls();
});

function setupInteractiveControls() {
    const controls = ['verbruikSelect', 'panelenSlider', 'evSelect', 'wpSelect'];
    controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const eventType = (el.tagName === 'SELECT') ? 'change' : 'input';
            el.addEventListener(eventType, recalculateAndRedraw);
        }
    });
    // Stel initiële waarden in
    document.getElementById('verbruikSelect').value = 3500;
    document.getElementById('panelenSlider').value = 12;
    recalculateAndRedraw();
}

function recalculateAndRedraw() {
    const state = { 
        basisVerbruikKwh: parseInt(document.getElementById('verbruikSelect').value),
        aantalPanelen: parseInt(document.getElementById('panelenSlider').value),
        evVerbruikKwh: parseInt(document.getElementById('evSelect').value),
        wpVerbruikKwh: parseInt(document.getElementById('wpSelect').value),
    };
    const calculations = calculateAdvice(state);
    updateDashboardUI(state, calculations);
}

function calculateAdvice(state) {
    const jaarlijksVerbruikKwh = state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh;
    const totaalDagelijksVerbruik = jaarlijksVerbruikKwh / 365;
    const totaalWp = state.aantalPanelen * 430;
    const dagelijkseOpbrengst = totaalWp * 0.9 / 365;
    
    const verbruikProfielRaw = [0.02, 0.015, 0.015, 0.015, 0.015, 0.03, 0.08, 0.07, 0.05, 0.04, 0.04, 0.04, 0.05, 0.04, 0.04, 0.05, 0.07, 0.09, 0.1, 0.09, 0.08, 0.06, 0.04, 0.03];
    const sumProfiel = verbruikProfielRaw.reduce((a, b) => a + b, 0);
    const verbruikProfiel = verbruikProfielRaw.map(p => p / sumProfiel);
    const zonneProfiel = [0,0,0,0,0,0.01,0.03,0.06,0.09,0.11,0.13,0.14,0.13,0.12,0.09,0.05,0.03,0.01,0,0,0,0,0,0];
    const geschaaldVerbruik = verbruikProfiel.map(p => p * totaalDagelijksVerbruik);
    const geschaaldeOpbrengst = zonneProfiel.map(p => p * dagelijkseOpbrengst);
    
    const totaalOverschot = geschaaldeOpbrengst.reduce((sum, opbrengst, i) => {
        const overschot = opbrengst - geschaaldVerbruik[i];
        return sum + (overschot > 0 ? overschot : 0);
    }, 0);
    const batterijCapaciteit = Math.max(5, Math.ceil(totaalOverschot / 2.5) * 2.5);
    
    return { batterijCapaciteit, geschaaldVerbruik, geschaaldeOpbrengst, totaalOverschot };
}

function updateDashboardUI(state, calcs) {
    document.getElementById('panelenValue').textContent = `${state.aantalPanelen}`;
    document.getElementById('capaciteitResultaat').textContent = `${calcs.batterijCapaciteit.toFixed(1)} kWh`;

    let samenvatting = `Op basis van een jaarlijks verbruik van <strong>${(state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh).toFixed(0)} kWh</strong> `;
    if (state.aantalPanelen > 0) {
        samenvatting += `en <strong>${state.aantalPanelen} zonnepanelen</strong>, heeft u een geschat zonne-overschot van <strong>${calcs.totaalOverschot.toFixed(1)} kWh</strong> per dag. Om dit overschot optimaal te benutten, adviseren wij een batterij van <strong>${calcs.batterijCapaciteit.toFixed(1)} kWh</strong>.`;
    } else {
        samenvatting += `is een thuisbatterij voornamelijk interessant i.c.m. een dynamisch energiecontract. Een basiscapaciteit van <strong>5.0 kWh</strong> is hiervoor een goed startpunt.`;
    }
    document.getElementById('adviesSamenvatting').innerHTML = samenvatting;

    renderScenario3Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst, calcs.batterijCapaciteit);
}

function renderScenario3Chart(verbruikData, opbrengstData, batterijCapaciteit) {
    const ctx = document.getElementById('scenario3ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    
    let totalImport = 0, totalExportNaBatt = 0, batterijLading = 0, totalDirectVerbruik = 0, totalBattVerbruik = 0;
    const importData = [], directVerbruikData = [], battVerbruikData = [], battLaadData = [];

    for (let i = 0; i < 24; i++) {
        const verbruik = verbruikData[i], opbrengst = opbrengstData[i];
        const direct = Math.min(verbruik, opbrengst);
        const netto = opbrengst - verbruik;
        let ontlading = 0, imp = 0, lading = 0;
        if (netto > 0) { const kanLaden = batterijCapaciteit - batterijLading; lading = Math.min(netto, kanLaden); batterijLading += lading; totalExportNaBatt += (netto - lading); } 
        else if (netto < 0) { const tekort = -netto; const kanOntladen = batterijLading; ontlading = Math.min(tekort, kanOntladen); batterijLading -= ontlading; imp = tekort - ontlading; }
        directVerbruikData.push(direct); battVerbruikData.push(ontlading); importData.push(imp); battLaadData.push(-lading);
        totalDirectVerbruik += direct; totalBattVerbruik += ontlading; totalImport += imp;
    }
    
    document.getElementById('summary3').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${((totalDirectVerbruik + totalBattVerbruik)*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div> <div class="summary-item" style="color:#9b59b6;"><strong>${(totalExportNaBatt*365).toFixed(0)} kWh/j</strong>Export</div>`;
    
    if (scenario3Chart) scenario3Chart.destroy();
    scenario3Chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                { label: 'Eigen Verbruik Zon', data: directVerbruikData, backgroundColor: 'rgba(46, 204, 113, 0.7)' },
                { label: 'Verbruik uit Batterij', data: battVerbruikData, backgroundColor: 'rgba(52, 152, 219, 0.7)' },
                { label: 'Import van Net', data: importData, backgroundColor: 'rgba(231, 76, 60, 0.7)' },
                { label: 'Laden Batterij', data: battLaadData, backgroundColor: 'rgba(41, 128, 185, 0.7)' },
                { type: 'line', label: 'Zon-opbrengst', data: opbrengstData, borderColor: 'rgba(241, 196, 15, 1)', fill: false, tension: 0.4, pointRadius: 0, order: -1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: false, title: {display: true, text: 'Energie (kWh)'} } },
            plugins: { legend: { display: false }, tooltip: { mode: 'index' } }
        }
    });
}
