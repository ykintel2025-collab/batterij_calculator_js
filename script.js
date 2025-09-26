let currentStep = 1;
const totalSteps = 6;
const formAnswers = {};
let scenario1Chart, scenario2Chart, scenario3Chart;

// ===================================================================================
// DEEL 1: NAVIGATIE & SETUP (De logica van de vragenlijst)
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('startBtn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('start-scherm').style.display = 'none';
        document.getElementById('calculator-scherm').style.display = 'block';
        showStep(1);
    });
});

function showStep(step) {
    document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`step-${step}`) || document.getElementById('resultaat-stap');
    if (el) el.classList.add('active');
    updateButtons();
}

function updateButtons() {
    const t = document.getElementById('terugBtn'), v = document.getElementById('volgendeBtn');
    t.style.display = (currentStep > 1 && currentStep <= totalSteps + 1) ? 'block' : 'none';
    v.style.display = (currentStep <= totalSteps) ? 'block' : 'none';
    v.textContent = isLastStep() ? 'Bereken advies' : 'Volgende →';
}

function isLastStep() {
    let nextVisibleStep = currentStep + 1;
    while(nextVisibleStep <= totalSteps) {
        if (!isStepSkipped(nextVisibleStep)) return false;
        nextVisibleStep++;
    }
    return true;
}

function isStepSkipped(step) {
    if (step === 3 && formAnswers['step-2'] === 'ja') return true;
    if (step === 4 && formAnswers['step-2'] === 'nee') return true;
    return false;
}

function nextStep() {
    const cs = document.getElementById(`step-${currentStep}`);
    const so = cs.querySelector('.selected');
    if (currentStep === 4) {
        const pi = document.getElementById('panelenInput');
        if (!pi.value || parseInt(pi.value) < 0) { alert("Vul een geldig aantal zonnepanelen in."); return; }
        formAnswers[`step-${currentStep}`] = parseInt(pi.value);
    } else {
        if (!so) { alert("Selecteer een optie."); return; }
        formAnswers[`step-${currentStep}`] = so.dataset.value;
    }
    if (isLastStep()) {
        berekenAdvies();
        return;
    }
    do {
        currentStep++;
    } while (isStepSkipped(currentStep));
    showStep(currentStep);
}

function prevStep() {
    do {
        currentStep--;
    } while (isStepSkipped(currentStep) && currentStep > 0);
    if (currentStep >= 1) showStep(currentStep);
}

function selectAnswer(step, element) {
    const c = document.getElementById(`step-${step}`);
    c.querySelectorAll('.answer-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// ===================================================================================
// DEEL 2: ORKESTRATIE VAN HET DASHBOARD (De 'dirigent')
// ===================================================================================

function berekenAdvies() {
    currentStep = totalSteps + 1;
    setupInteractiveControls();
    showStep('resultaat-stap');
}

function setupInteractiveControls() {
    const controls = ['verbruikSlider', 'panelenSlider', 'evSelect', 'wpSelect'];
    controls.forEach(id => {
        const el = document.getElementById(id);
        const eventType = (el.type === 'range' || el.tagName === 'SELECT') ? 'input' : 'change';
        el.addEventListener(eventType, recalculateAndRedraw);
    });
    document.getElementById('verbruikSlider').value = formAnswers['step-1'] || 3000;
    document.getElementById('panelenSlider').value = (formAnswers['step-2'] === 'ja' && formAnswers['step-4']) ? formAnswers['step-4'] : (formAnswers['step-3'] === 'ja' ? 12 : 0);
    document.getElementById('evSelect').value = formAnswers['step-5'] === 'ja' ? "3600" : "0";
    document.getElementById('wpSelect').value = formAnswers['step-6'] === 'ja' ? "2500" : "0";
    recalculateAndRedraw();
}

function recalculateAndRedraw() {
    const state = {
        basisVerbruikKwh: parseInt(document.getElementById('verbruikSlider').value),
        aantalPanelen: parseInt(document.getElementById('panelenSlider').value),
        evVerbruikKwh: parseInt(document.getElementById('evSelect').value),
        wpVerbruikKwh: parseInt(document.getElementById('wpSelect').value),
        heeftZonnepanelenInitieel: formAnswers['step-2'] === 'ja'
    };
    const calculations = calculateAllData(state);
    updateDashboardUI(state, calculations);
}

// ===================================================================================
// DEEL 3: DATA BEREKENING (De 'motor' van de calculator)
// ===================================================================================

function calculateAllData(state) {
    // Basisberekeningen
    const jaarlijksVerbruikKwh = state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh;
    const totaalDagelijksVerbruik = jaarlijksVerbruikKwh / 365;
    let totaalWp = 0;
    if (state.aantalPanelen > 0) {
        const paneelType = state.heeftZonnepanelenInitieel ? 400 : 430;
        totaalWp = state.aantalPanelen * paneelType;
    }
    const dagelijkseOpbrengst = totaalWp * 0.9 / 365;
    
    // Profielen
    const verbruikProfielRaw = [0.03,0.02,0.02,0.02,0.03,0.05,0.07,0.06,0.05,0.04,0.04,0.04,0.05,0.04,0.04,0.05,0.06,0.08,0.09,0.08,0.07,0.06,0.05,0.04];
    const sumProfiel = verbruikProfielRaw.reduce((a, b) => a + b, 0);
    const verbruikProfiel = verbruikProfielRaw.map(p => p / sumProfiel);
    const zonneProfiel = [0,0,0,0,0,0.01,0.03,0.06,0.09,0.11,0.13,0.14,0.13,0.12,0.09,0.05,0.03,0.01,0,0,0,0,0,0];
    const geschaaldVerbruik = verbruikProfiel.map(p => p * totaalDagelijksVerbruik);
    const geschaaldeOpbrengst = zonneProfiel.map(p => p * dagelijkseOpbrengst);
    
    // Adviesberekening
    const totaalOverschot = geschaaldeOpbrengst.reduce((sum, opbrengst, i) => {
        const overschot = opbrengst - geschaaldVerbruik[i];
        return sum + (overschot > 0 ? overschot : 0);
    }, 0);
    const batterijCapaciteit = Math.max(5, Math.ceil(totaalOverschot / 5) * 5);

    // Scenario 1 Data
    const s1_totalImport = geschaaldVerbruik.reduce((a, b) => a + b, 0);
    
    // Scenario 2 Data
    let s2_totalImport = 0, s2_totalExport = 0, s2_totalDirect = 0;
    for(let i=0; i<24; i++) {
        const direct = Math.min(geschaaldVerbruik[i], geschaaldeOpbrengst[i]);
        s2_totalImport += Math.max(0, geschaaldVerbruik[i] - geschaaldeOpbrengst[i]);
        s2_totalExport += Math.max(0, geschaaldeOpbrengst[i] - geschaaldVerbruik[i]);
        s2_totalDirect += direct;
    }

    // Scenario 3 Data
    let s3_totalImport = 0, s3_totalExport = 0, s3_lading = 0, s3_totalDirect = 0, s3_totalBatt = 0;
    const s3_battLaadData = [], s3_battVerbruikData = [];
    for (let i = 0; i < 24; i++) {
        const direct = Math.min(geschaaldVerbruik[i], geschaaldeOpbrengst[i]);
        const netto = geschaaldeOpbrengst[i] - geschaaldVerbruik[i];
        let ontlading = 0, lading = 0;
        if (netto > 0) { const kanLaden = batterijCapaciteit - s3_lading; lading = Math.min(netto, kanLaden); s3_lading += lading; s3_totalExport += (netto - lading); } 
        else if (netto < 0) { const tekort = -netto; const kanOntladen = s3_lading; ontlading = Math.min(tekort, kanOntladen); s3_lading -= ontlading; }
        s3_battLaadData.push(-lading); s3_battVerbruikData.push(ontlading);
        s3_totalDirect += direct; s3_totalBatt += ontlading;
    }
    s3_totalImport = s2_totalImport - s3_totalBatt;


    return {
        batterijCapaciteit,
        geschaaldVerbruik,
        geschaaldeOpbrengst,
        scenarioData: {
            s1: { totalImport: s1_totalImport },
            s2: { totalImport: s2_totalImport, totalExport: s2_totalExport, totalDirect: s2_totalDirect },
            s3: { totalImport: s3_totalImport, totalExport: s3_totalExport, totalDirect: s3_totalDirect, totalBatt: s3_totalBatt, data: { battLaad: s3_battLaadData, battVerbruik: s3_battVerbruikData } }
        }
    };
}

// ===================================================================================
// DEEL 4: VISUALISATIE (Het 'dashboard' vullen)
// ===================================================================================

function updateDashboardUI(state, calcs) {
    document.getElementById('verbruikValue').textContent = `${state.basisVerbruikKwh} kWh`;
    document.getElementById('panelenValue').textContent = `${state.aantalPanelen}`;
    document.getElementById('capaciteitResultaat').textContent = `${calcs.batterijCapaciteit.toFixed(1)} kWh`;
    const totaalVerbruik = state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh;
    document.getElementById('totaalVerbruikUitleg').innerHTML = `Basisverbruik: <strong>${state.basisVerbruikKwh} kWh</strong><br>+ E-Auto: <strong>${state.evVerbruikKwh} kWh</strong><br>+ Warmtepomp: <strong>${state.wpVerbruikKwh} kWh</strong><br><hr>Totaal: <strong>${totaalVerbruik.toFixed(0)} kWh</strong>`;
    
    const displayPanels = state.aantalPanelen > 0;
    document.getElementById('scenario2Div').style.display = displayPanels ? 'block' : 'none';
    document.getElementById('scenario3Div').style.display = displayPanels ? 'block' : 'none';

    renderScenario1Chart(calcs.geschaaldVerbruik, calcs.scenarioData.s1);
    if (displayPanels) {
        renderScenario2Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst, calcs.scenarioData.s2);
        renderScenario3Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst, calcs.scenarioData.s3);
    } else {
        // Zorg dat de placeholder HTML terugkomt als de panelen op 0 staan
        document.getElementById('scenario2Div').innerHTML = `<div class="placeholder-message">Voeg zonnepanelen toe om dit scenario te zien.</div>`;
        document.getElementById('scenario3Div').innerHTML = `<div class="placeholder-message">Voeg zonnepanelen toe om de impact van een thuisbatterij te zien.</div>`;
    }
}

function renderScenario1Chart(verbruikData, summaryData) {
    const ctx = document.getElementById('scenario1ChartCanvas').getContext('2d');
    if (!ctx) return;
    document.getElementById('summary1').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(summaryData.totalImport * 365).toFixed(0)} kWh/j</strong>Import van Net</div>`;
    if (scenario1Chart) scenario1Chart.destroy();
    scenario1Chart = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [{ label: 'Import van Net', data: verbruikData, backgroundColor: 'rgba(231, 76, 60, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { stacked: true, beginAtZero: true, title: {display: true, text: 'Energie (kWh)'} } }, plugins: { legend: { display: false } } } });
}

function renderScenario2Chart(verbruikData, opbrengstData, summaryData) {
    const ctx = document.getElementById('scenario2ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    document.getElementById('summary2').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(summaryData.totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${(summaryData.totalDirect*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div> <div class="summary-item" style="color:#9b59b6;"><strong>${(summaryData.totalExport*365).toFixed(0)} kWh/j</strong>Export</div>`;
    if (scenario2Chart) scenario2Chart.destroy();
    scenario2Chart = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [ { label: 'Eigen Verbruik Zon', data: verbruikData.map((v,i) => Math.min(v, opbrengstData[i])), backgroundColor: 'rgba(46, 204, 113, 0.7)', order: 2 }, { label: 'Import van Net', data: verbruikData.map((v,i) => Math.max(0, v-opbrengstData[i])), backgroundColor: 'rgba(231, 76, 60, 0.7)', order: 2 }, { label: 'Export naar Net', data: opbrengstData.map((o, i) => -Math.max(0, o - verbruikData[i])), backgroundColor: 'rgba(155, 89, 182, 0.7)', order: 2 }, { type: 'line', label: 'Zon-opbrengst', data: opbrengstData, borderColor: 'rgba(241, 196, 15, 1)', fill: false, tension: 0.4, pointRadius: 0, order: 1 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: false, title: {display: true, text: 'Energie (kWh)'} } }, plugins: { legend: { display: false } } } });
}

function renderScenario3Chart(verbruikData, opbrengstData, summaryData) {
    const ctx = document.getElementById('scenario3ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    document.getElementById('summary3').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(summaryData.totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${((summaryData.totalDirect + summaryData.totalBatt)*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div> <div class="summary-item" style="color:#9b59b6;"><strong>${(summaryData.totalExport*365).toFixed(0)} kWh/j</strong>Export</div>`;
    if (scenario3Chart) scenario3Chart.destroy();
    scenario3Chart = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [ { label: 'Eigen Verbruik Zon', data: summaryData.data.direct, backgroundColor: 'rgba(46, 204, 113, 0.7)', order: 2 }, { label: 'Verbruik uit Batterij', data: summaryData.data.batt, backgroundColor: 'rgba(52, 152, 219, 0.7)', order: 2 }, { label: 'Import van Net', data: summaryData.data.import, backgroundColor: 'rgba(231, 76, 60, 0.7)', order: 2 }, { label: 'Laden Batterij', data: summaryData.data.laad, backgroundColor: 'rgba(41, 128, 185, 0.7)', order: 2 }, { type: 'line', label: 'Zon-opbrengst', data: opbrengstData, borderColor: 'rgba(241, 196, 15, 1)', fill: false, tension: 0.4, pointRadius: 0, order: 1 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: false, title: {display: true, text: 'Energie (kWh)'} } }, plugins: { legend: { display: false } } } });
}
