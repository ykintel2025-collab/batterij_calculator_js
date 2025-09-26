let currentStep = 1;
const totalSteps = 6;
const formAnswers = {};
let scenario1Chart, scenario2Chart, scenario3Chart;
let batterijLadingProfiel = [], batterijActieProfiel = [];

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
    updateProgressBar();
}

function updateButtons() {
    const t = document.getElementById('terugBtn'), v = document.getElementById('volgendeBtn');
    t.style.display = (currentStep > 1 && currentStep <= totalSteps + 1) ? 'block' : 'none';
    v.style.display = (currentStep <= totalSteps) ? 'block' : 'none';
    v.textContent = isLastStep() ? 'Bereken advies' : 'Volgende →';
}

function updateProgressBar() {
    const totalVisibleSteps = totalSteps - (isStepSkipped(3) ? 1 : 0) - (isStepSkipped(4) ? 1 : 0);
    let answeredQuestions = 0;
    for (let i = 1; i < currentStep; i++) {
        if (!isStepSkipped(i)) answeredQuestions++;
    }
    const percentage = (answeredQuestions / totalVisibleSteps) * 100;
    document.getElementById('progressBar').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${Math.round(percentage)}% Voltooid`;
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
        if (!pi.value || parseInt(pi.value) < 0) {
            alert("Vul een geldig aantal zonnepanelen in.");
            return;
        }
        formAnswers['step-4'] = parseInt(pi.value);
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
    const calculations = calculateAdvice(state);
    updateDashboardUI(state, calculations);
}

function calculateAdvice(state) {
    const jaarlijksVerbruikKwh = state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh;
    const totaalDagelijksVerbruik = jaarlijksVerbruikKwh / 365;
    let totaalWp = 0;
    if (state.aantalPanelen > 0) {
        const paneelType = state.heeftZonnepanelenInitieel ? 400 : 430;
        totaalWp = state.aantalPanelen * paneelType;
    }
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
    const berekendeCapaciteit = nachtelijkVerbruik * 1.15;
    const batterijCapaciteit = Math.max(5, Math.ceil(berekendeCapaciteit / 5) * 5);
    return { batterijCapaciteit, geschaaldVerbruik, geschaaldeOpbrengst };
}

function updateDashboardUI(state, calcs) {
    document.getElementById('verbruikValue').textContent = `${state.basisVerbruikKwh} kWh`;
    document.getElementById('panelenValue').textContent = `${state.aantalPanelen}`;
    document.getElementById('capaciteitResultaat').textContent = `${calcs.batterijCapaciteit.toFixed(1)} kWh`;
    const totaalVerbruik = state.basisVerbruikKwh + state.evVerbruikKwh + state.wpVerbruikKwh;
    document.getElementById('totaalVerbruikUitleg').innerHTML = `Basisverbruik: <strong>${state.basisVerbruikKwh} kWh</strong><br>+ E-Auto: <strong>${state.evVerbruikKwh} kWh</strong><br>+ Warmtepomp: <strong>${state.wpVerbruikKwh} kWh</strong><br><hr>Totaal: <strong>${totaalVerbruik.toFixed(0)} kWh</strong>`;
    
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
        // Reset state
        const lastCharge = batterijLadingProfiel[batterijLadingProfiel.length - 1];
        const percentage = batterijCapaciteit > 0 ? (lastCharge / batterijCapaciteit) * 100 : 0;
        document.getElementById('batteryLevel').style.height = `${percentage}%`;
        document.getElementById('batteryPercentage').textContent = `${Math.round(percentage)}%`;
        document.getElementById('batteryTime').textContent = `Eindstand`;
        document.getElementById('batteryStatusText').textContent = 'Inactief';
        document.getElementById('batteryStatusText').className = 'battery-status-text';
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

function renderScenario1Chart(verbruikData) {
    const ctx = document.getElementById('scenario1ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    const totalImport = verbruikData.reduce((a, b) => a + b, 0);
    document.getElementById('summary1').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(totalImport * 365).toFixed(0)} kWh/j</strong>Import van Net</div>`;
    if (scenario1Chart) scenario1Chart.destroy();
    scenario1Chart = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [{ label: 'Import van Net', data: verbruikData, backgroundColor: 'rgba(231, 76, 60, 0.7)' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { stacked: true, beginAtZero: true, title: {display: true, text: 'Energie (kWh)'} } }, plugins: { legend: { display: false } } } });
}

function renderScenario2Chart(verbruikData, opbrengstData) {
    const ctx = document.getElementById('scenario2ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    let totalImport = 0, totalExport = 0, totalDirectVerbruik = 0;
    for(let i=0; i<24; i++) {
        const direct = Math.min(verbruikData[i], opbrengstData[i]);
        totalImport += Math.max(0, verbruikData[i] - opbrengstData[i]);
        totalExport += Math.max(0, opbrengstData[i] - verbruikData[i]);
        totalDirectVerbruik += direct;
    }
    document.getElementById('summary2').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${(totalDirectVerbruik*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div> <div class="summary-item" style="color:#9b59b6;"><strong>${(totalExport*365).toFixed(0)} kWh/j</strong>Export</div>`;
    if (scenario2Chart) scenario2Chart.destroy();
    scenario2Chart = new Chart(ctx, { type: 'bar', data: { labels: Array.from({length: 24}, (_, i) => `${i}:00`), datasets: [ { label: 'Eigen Verbruik Zon', data: verbruikData.map((v,i) => Math.min(v, opbrengstData[i])), backgroundColor: 'rgba(46, 204, 113, 0.7)', order: 2 }, { label: 'Import van Net', data: verbruikData.map((v,i) => Math.max(0, v-opbrengstData[i])), backgroundColor: 'rgba(231, 76, 60, 0.7)', order: 2 }, { label: 'Export naar Net', data: opbrengstData.map((o, i) => -Math.max(0, o - verbruikData[i])), backgroundColor: 'rgba(155, 89, 182, 0.7)', order: 2 }, { type: 'line', label: 'Zon-opbrengst', data: opbrengstData, borderColor: 'rgba(241, 196, 15, 1)', fill: false, tension: 0.4, pointRadius: 0, order: 1 } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: false, title: {display: true, text: 'Energie (kWh)'} } }, plugins: { legend: { display: false } } } });
}

function renderScenario3Chart(verbruikData, opbrengstData, batterijCapaciteit) {
    const ctx = document.getElementById('scenario3ChartCanvas')?.getContext('2d');
    if (!ctx) return;
    batterijLadingProfiel = []; batterijActieProfiel = []; // Leeg de globale profielen
    let batterijLading = 0, totalImport = 0, totalExportNaBatt = 0, totalDirectVerbruik = 0, totalBattVerbruik = 0;
    const importData = [], directVerbruikData = [], battVerbruikData = [], battLaadData = [];

    for (let i = 0; i < 24; i++) {
        const verbruik = verbruikData[i], opbrengst = opbrengstData[i];
        const direct = Math.min(verbruik, opbrengst);
        const netto = opbrengst - verbruik;
        let ontlading = 0, imp = 0, lading = 0, actie = "Inactief";
        if (netto > 0) { const kanLaden = batterijCapaciteit - batterijLading; lading = Math.min(netto, kanLaden); if(lading > 0.01) { batterijLading += lading; actie = "Laden"; } totalExportNaBatt += (netto - lading); } 
        else if (netto < 0) { const tekort = -netto; const kanOntladen = batterijLading; ontlading = Math.min(tekort, kanOntladen); if (ontlading > 0.01) { batterijLading -= ontlading; actie = "Ontladen"; } imp = tekort - ontlading; }
        directVerbruikData.push(direct); battVerbruikData.push(ontlading); importData.push(imp); battLaadData.push(-lading);
        totalDirectVerbruik += direct; totalBattVerbruik += ontlading; totalImport += imp;
        batterijLadingProfiel.push(batterijLading); batterijActieProfiel.push(actie);
    }
    
    document.getElementById('summary3').innerHTML = `<div class="summary-item" style="color:#e74c3c;"><strong>${(totalImport*365).toFixed(0)} kWh/j</strong>Import</div> <div class="summary-item" style="color:#2ecc71;"><strong>${((totalDirectVerbruik + totalBattVerbruik)*365).toFixed(0)} kWh/j</strong>Eigen Verbruik</div> <div class="summary-item" style="color:#9b59b6;"><strong>${(totalExportNaBatt*365).toFixed(0)} kWh/j</strong>Export</div>`;
    
    if (scenario3Chart) scenario3Chart.destroy();
    scenario3Chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [
                { label: 'Eigen Verbruik Zon', data: directVerbruikData, backgroundColor: 'rgba(46, 204, 113, 0.7)', order: 2 },
                { label: 'Verbruik uit Batterij', data: battVerbruikData, backgroundColor: 'rgba(52, 152, 219, 0.7)', order: 2 },
                { label: 'Import van Net', data: importData, backgroundColor: 'rgba(231, 76, 60, 0.7)', order: 2 },
                { label: 'Laden Batterij', data: battLaadData, backgroundColor: 'rgba(41, 128, 185, 0.7)', order: 2 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: false, title: {display: true, text: 'Energie (kWh)'} } },
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
