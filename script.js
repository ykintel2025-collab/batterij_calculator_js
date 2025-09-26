let currentStep = 1;
const totalSteps = 6;
const formAnswers = {};
let scenario3Chart;
let batterijLadingProfiel = [], batterijActieProfiel = [];

document.addEventListener('DOMContentLoaded', () => { document.getElementById('startBtn').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('start-scherm').style.display = 'none'; document.getElementById('calculator-scherm').style.display = 'block'; showStep(1); }); });
function showStep(step) { document.querySelectorAll('.step-container').forEach(el => el.classList.remove('active')); const el = document.getElementById(`step-${step}`) || document.getElementById('resultaat-stap'); if (el) el.classList.add('active'); updateButtons(); }
function updateButtons() { const t = document.getElementById('terugBtn'), v = document.getElementById('volgendeBtn'); t.style.display = (currentStep > 1 && currentStep <= totalSteps + 1) ? 'block' : 'none'; v.style.display = (currentStep <= totalSteps) ? 'block' : 'none'; v.textContent = isLastStep() ? 'Bereken advies' : 'Volgende →'; }
function isLastStep() { if (currentStep < totalSteps) return false; let nextVisibleStep = currentStep + 1; while(nextVisibleStep <= totalSteps) { if (!isStepSkipped(nextVisibleStep)) { return false; } nextVisibleStep++; } return true; }
function isStepSkipped(step) { if (step === 3 && formAnswers['step-2'] === 'ja') return true; if (step === 4 && formAnswers['step-2'] === 'nee') return true; return false; }
function nextStep() { const cs = document.getElementById(`step-${currentStep}`); const so = cs.querySelector('.selected'); if (currentStep === 4) { const pi = document.getElementById('panelenInput'); if (!pi.value || parseInt(pi.value) < 0) { alert("Vul een geldig aantal zonnepanelen in."); return; } formAnswers[`step-${currentStep}`] = parseInt(pi.value); } else { if (!so) { alert("Selecteer een optie."); return; } formAnswers[`step-${currentStep}`] = so.dataset.value; } if (isLastStep()) { berekenAdvies(); return; } do { currentStep++; } while (isStepSkipped(currentStep)); showStep(currentStep); }
function prevStep() { do { currentStep--; } while (isStepSkipped(currentStep) && currentStep > 0); if (currentStep >= 1) showStep(currentStep); }
function selectAnswer(step, element) { const c = document.getElementById(`step-${step}`); c.querySelectorAll('.answer-option').forEach(el => el.classList.remove('selected')); element.classList.add('selected'); }

function berekenAdvies() {
    currentStep = totalSteps + 1;
    setupInteractiveControls();
    showStep('resultaat-stap');
}

function setupInteractiveControls() {
    const controls = ['verbruikSlider', 'panelenSlider', 'evSelect', 'wpSelect'];
    controls.forEach(id => { const el = document.getElementById(id); const eventType = (el.type === 'range' || el.tagName === 'SELECT') ? 'input' : 'change'; el.addEventListener(eventType, recalculateAndRedraw); });
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
    if (state.aantalPanelen > 0) { const paneelType = state.heeftZonnepanelenInitieel ? 400 : 430; totaalWp = state.aantalPanelen * paneelType; }
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
    document.getElementById('scenario3Div').style.display = displayPanels ? 'block' : 'none';
    
    // Altijd de eerste grafiek tonen
    const scenario1Div = document.getElementById('scenario1Div');
    if (scenario1Div) scenario1Div.style.display = 'none'; // Hide scenario 1
    const scenario2Div = document.getElementById('scenario2Div');
    if (scenario2Div) scenario2Div.style.display = 'none'; // Hide scenario 2


    if (displayPanels) {
        renderScenario3Chart(calcs.geschaaldVerbruik, calcs.geschaaldeOpbrengst, calcs.batterijCapaciteit);
    } else {
        document.getElementById('scenario3Div').innerHTML = `<div class="placeholder-message">Voeg zonnepanelen toe om de impact van een thuisbatterij te zien.</div>`;
    }
}

function updateBatteryIndicator(index, batterijCapaciteit) {
    if (index === null || index < 0 || index >= batterijLadingProfiel.length) return;
    const lading = batterijLadingProfiel[index];
    const actie = batterijActieProfiel[index];
    const percentage = (lading / batterijCapaciteit) * 100;
    
    document.getElementById('batteryLevel').style.height = `${percentage}%`;
    document.getElementById('batteryPercentage').textContent = `${Math.round(percentage)}%`;
    document.getElementById('batteryTime').textContent = `${index}:00`;
    const statusEl = document.getElementById('batteryStatusText');
    statusEl.textContent = actie;
    statusEl.className = `status-${actie.toLowerCase()}`;
}

function renderScenario3Chart(verbruikData, opbrengstData, batterijCapaciteit) {
    const ctx = document.getElementById('scenario3ChartCanvas').getContext('2d');
    if (!ctx) return;
    let batterijLading = 0;
    const importData = [], directVerbruikData = [], battVerbruikData = [];
    batterijLadingProfiel = []; 
    batterijActieProfiel = [];

    for (let i = 0; i < 24; i++) {
        const verbruik = verbruikData[i], opbrengst = opbrengstData[i];
        const direct = Math.min(verbruik, opbrengst);
        const netto = opbrengst - verbruik;
        let ontlading = 0, imp = 0, actie = "Inactief";

        if (netto > 0) { 
            const kanLaden = batterijCapaciteit - batterijLading;
            const lading = Math.min(netto, kanLaden);
            if (lading > 0.01) { batterijLading += lading; actie = "Laden"; }
        } else if (netto < 0) { 
            const tekort = -netto;
            const kanOntladen = batterijLading;
            ontlading = Math.min(tekort, kanOntladen);
            if (ontlading > 0.01) { batterijLading -= ontlading; actie = "Ontladen"; }
            imp = tekort - ontlading;
        }
        directVerbruikData.push(direct);
        battVerbruikData.push(ontlading);
        importData.push(imp);
        batterijLadingProfiel.push(batterijLading);
        batterijActieProfiel.push(actie);
    }
    
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
                { label: 'Import van Net', data: importData, backgroundColor: 'rgba(231, 76, 60, 0.7)' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: {display: true, text: 'Energie (kWh)'} } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true, mode: 'index', intersect: false,
                    callbacks: {
                        footer: (tooltipItems) => {
                            const hourIndex = tooltipItems[0]?.dataIndex;
                            if (hourIndex !== undefined) {
                                updateBatteryIndicator(hourIndex, batterijCapaciteit);
                            }
                            return '';
                        }
                    }
                }
            },
            onHover: (event, chartElement) => {
                if (!chartElement.length) { // Wanneer de muis van de grafiek af gaat
                    const defaultIndex = new Date().getHours();
                    updateBatteryIndicator(defaultIndex, batterijCapaciteit);
                }
            }
        }
    });
    // Initialiseer indicator op de huidige tijd van de dag
    updateBatteryIndicator(new Date().getHours(), batterijCapaciteit);
}
