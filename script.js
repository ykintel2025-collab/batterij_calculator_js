let scenario1Chart, scenario2Chart, scenario3Chart;
let batterijLadingProfiel = [], batterijActieProfiel = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('start-scherm').style.display = 'none';
        document.getElementById('calculator-scherm').style.display = 'block';
        showStep('resultaat-stap');
    });
    setupInteractiveControls();
});

function showStep(step) {
    document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(step);
    if (el) el.classList.add('active');
}

function setupInteractiveControls() {
    const controls = ['verbruikSlider', 'panelenSlider'];
    controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', recalculateAndRedraw);
    });
    document.getElementById('verbruikSlider').value = 3000;
    document.getElementById('panelenSlider').value = 12;
    recalculateAndRedraw();
}

function recalculateAndRedraw() {
    const state = {
        jaarlijksVerbruikKwh: parseInt(document.getElementById('verbruikSlider')?.value) || 3000,
        aantalPanelen: parseInt(document.getElementById('panelenSlider')?.value) || 0,
    };
    const calculations = calculateAdvice(state);
    updateDashboardUI(state, calculations);
}

function calculateAdvice(state) {
    const totaalDagelijksVerbruik = state.jaarlijksVerbruikKwh / 365;
    const totaalWp = state.aantalPanelen * 430;
    const dagelijkseOpbrengst = totaalWp * 0.9 / 365;
    const verbruikProfielRaw = [0.02, 0.015, 0.015, 0.015, 0.015, 0.03, 0.08, 0.07, 0.05, 0.04, 0.04, 0.04, 0.05, 0.04, 0.04, 0.05, 0.07, 0.09, 0.1, 0.09, 0.08, 0.06, 0.04, 0.03];
    const sumProfiel = verbruikProfielRaw.reduce((a, b) => a + b, 0);
    const verbruikProfiel = verbruikProfielRaw.map(p => p / sumProfiel);
    const zonneProfiel = [0,0,0,0,0,0.01,0.03,0.06,0.09,0.11,0.13,0.14,0.13,0.12,0.09,0.05,0.03,0.01,0,0,0,0,0,0];
    const geschaaldVerbruik = verbruikProfiel.map(p => p * totaalDagelijksVerbruik);
    const geschaaldeOpbrengst = zonneProfiel.map(p => p * dagelijkseOpbrengst);
    
    let nachtelijkVerbruik = 0;
    for(let i=0; i<24; i++) {
        if(i < 7 || i > 18) { nachtelijkVerbruik += geschaaldVerbruik[i]; }
    }
    const berekendeCapaciteit = nachtelijkVerbruik * 1.15; // +15% buffer
    const batterijCapaciteit = Math.max(5, Math.ceil(berekendeCapaciteit / 2.5) * 2.5);
    
    return { batterijCapaciteit, geschaaldVerbruik, geschaaldeOpbrengst };
}

function updateDashboardUI(state, calcs) {
    document.getElementById('verbruikValue').textContent = `${state.jaarlijksVerbruikKwh} kWh`;
    document.getElementById('panelenValue').textContent = `${state.aantalPanelen}`;
    document.getElementById('capaciteitResultaat').textContent = `${calcs.batterijCapaciteit.toFixed(1)} kWh`;
    const displayPanels = state.aantalPanelen > 0;
    document.getElementById('scenario2Div').style.display = displayPanels ? 'block' : 'none';
    document.getElementById('scenario3Div').style.display = displayPanels ? 'block' : 'none';

    renderScenario1Chart(calcs.geschaaldVerbruik);
    if (displayPanels) {
        renderScenario2Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst);
        renderScenario3Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst, calcs.batterijCapaciteit);
    }
}

function updateBatteryIndicator(index, batterijCapaciteit) {
    if (index === null || index < 0 || index >= batterijLadingProfiel.length) {
        document.getElementById('batteryTime').textContent = '--:--';
        document.getElementById('batteryStatusText').textContent = 'Hover over de grafiek';
        return;
    }
    const lading = batterijLadingProfiel[index];
    const actie = batterijActieProfiel[index];
    const percentage = batterijCapaciteit > 0 ? (lading / batterijCapaciteit) * 100 : 0;
    
    document.getElementById('batteryLevel').style.height = `${percentage}%`;
    document.getElementById('batteryPercentage').textContent = `${Math.round(percentage)}%`;
    document.getElementById('batteryTime').textContent = `${index}:00`;
    const statusEl = document.getElementById('batteryStatusText');
    statusEl.textContent = actie;
    statusEl.className = `battery-status-text status-${actie.toLowerCase()}`;
}

function renderScenario1Chart(verbruikData) { /* ... ongewijzigd ... */ }
function renderScenario2Chart(verbruikData, opbrengstData) { /* ... ongewijzigd ... */ }

function renderScenario3Chart(verbruikData, opbrengstData, batterijCapaciteit) {
    const ctx = document.getElementById('scenario3ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    
    batterijLadingProfiel = []; batterijActieProfiel = [];
    let batterijLading = 0;
    const importData = [], directVerbruikData = [], battVerbruikData = [], battLaadDataZon = [], battLaadDataNet = [];
    
    const mockDayAheadPrices = [0.05,0.04,0.03,0.03,0.04,0.07,0.12,0.14,0.13,0.11,0.08,0.06,0.02,0.01,0.02,0.05,0.10,0.15,0.16,0.13,0.11,0.09,0.08,0.06];
    const laadDrempel = 0.05;

    for (let i = 0; i < 24; i++) {
        const verbruik = verbruikData[i], opbrengst = opbrengstData[i];
        const direct = Math.min(verbruik, opbrengst);
        let netto = opbrengst - verbruik;
        let ontlading = 0, imp = 0, ladingZon = 0, ladingNet = 0, actie = "Inactief";

        if (netto > 0) { // Overschot -> laden met zon
            const kanLaden = batterijCapaciteit - batterijLading;
            ladingZon = Math.min(netto, kanLaden);
            if (ladingZon > 0.01) { batterijLading += ladingZon; actie = "Laden"; }
        } else { // Tekort of balans
            const tekort = -netto;
            if (mockDayAheadPrices[i] < laadDrempel && batterijLading < batterijCapaciteit) {
                // Slim laden van net
                const kanLaden = batterijCapaciteit - batterijLading;
                ladingNet = Math.min(2.5, kanLaden); // Laad met max 2.5kW
                batterijLading += ladingNet;
                actie = "Laden";
            }
            const kanOntladen = batterijLading;
            ontlading = Math.min(tekort, kanOntladen);
            if (ontlading > 0.01) { batterijLading -= ontlading; actie = "Ontladen"; }
            imp = tekort - ontlading + ladingNet;
        }
        
        directVerbruikData.push(direct); battVerbruikData.push(ontlading); importData.push(imp);
        battLaadData.push(-(ladingZon + ladingNet)); // Gecombineerd laden
        batterijLadingProfiel.push(batterijLading); batterijActieProfiel.push(actie);
    }
    
    // Summary update
    const totalImport = importData.reduce((a,b)=>a+b, 0);
    const totalDirect = directVerbruikData.reduce((a,b)=>a+b, 0);
    const totalBatt = battVerbruikData.reduce((a,b)=>a+b, 0);
    document.getElementById('summary3').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${((totalDirect + totalBatt)*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div>`;
    
    if (scenario3Chart) scenario3Chart.destroy();
    scenario3Chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                { label: 'Eigen Verbruik Zon', data: directVerbruikData, backgroundColor: 'rgba(46, 204, 113, 0.7)' },
                { label: 'Verbruik uit Batterij', data: battVerbruikData, backgroundColor: 'rgba(52, 152, 219, 0.7)' },
                { label: 'Import van Net', data: importData, backgroundColor: 'rgba(231, 76, 60, 0.7)' },
                { label: 'Laden Batterij', data: battLaadData, backgroundColor: 'rgba(41, 128, 185, 0.7)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: {display: true, text: 'Energie (kWh)'} } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true, mode: 'index', intersect: false,
                    callbacks: { footer: (tooltipItems) => { const i = tooltipItems[0]?.dataIndex; if (i !== undefined) { updateBatteryIndicator(i, batterijCapaciteit); } return ''; } }
                }
            },
            onHover: (event, chartElement) => { if (!chartElement.length) { updateBatteryIndicator(null, batterijCapaciteit); } }
        }
    });
    updateBatteryIndicator(null, batterijCapaciteit);
}
