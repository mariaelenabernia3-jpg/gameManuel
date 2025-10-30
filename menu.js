document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DEL FONDO DE ESTRELLAS ---
    const canvas = document.getElementById('starfield-canvas');
    const ctx = canvas.getContext('2d');
    let stars = [];
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    function createStars() { stars = []; for (let i = 0; i < 200; i++) { stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 1.5 + 0.5, speed: Math.random() * 0.5 + 0.25 }); } }
    function drawStars() { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "white"; stars.forEach(star => { star.y += star.speed; if (star.y > canvas.height) { star.y = 0; star.x = Math.random() * canvas.width; } ctx.fillRect(star.x, star.y, star.size, star.size); }); }
    function animate() { drawStars(); requestAnimationFrame(animate); }
    window.addEventListener('resize', () => { resizeCanvas(); createStars(); });
    resizeCanvas(); createStars(); animate();

    // --- DEFINICIONES DE DATOS Y CLAVES ---
    const shipsData = {
        'interceptor': { name: 'Interceptor', description: 'Nave equilibrada con un cañón de plasma frontal de alta velocidad.', price: 0, upgrades: { damage: { label: 'Daño de Plasma', cost: 100, maxLevel: 5 }, firerate: { label: 'Cadencia de Fuego', cost: 150, maxLevel: 5 } } },
        'vanguard': { name: 'Vanguard', description: 'Equipada con un cañón de dispersión que dispara tres proyectiles a la vez.', price: 500, upgrades: { damage: { label: 'Daño por Proyectil', cost: 120, maxLevel: 5 }, spread: { label: 'Amplitud de Dispersión', cost: 200, maxLevel: 3 } } },
        'striker': { name: 'Striker', description: 'Dispara un proyectil frontal potente y dos cañones laterales de apoyo.', price: 1000, upgrades: { mainDamage: { label: 'Cañón Principal', cost: 150, maxLevel: 5 }, sideDamage: { label: 'Cañones Laterales', cost: 180, maxLevel: 5 } } }
    };
    const PLAYER_PROGRESS_KEY = 'aceCraftPlayerProgress';
    const GAME_SETTINGS_KEY = 'aceCraftGameSettings';
    const CAMPAIGN_HIGH_SCORES_KEY = 'aceCraftCampaignHighScores';
    const INFINITE_HIGH_SCORES_KEY = 'aceCraftInfiniteHighScores';
    const ACHIEVEMENTS_KEY = 'aceCraftAchievements';
    let playerProgress;
    let targetMissionHtml = ''; 

    // --- MODALES ---
    const campaignModal = document.getElementById('campaign-modal');
    const difficultyModal = document.getElementById('difficulty-modal');
    const hangarModal = document.getElementById('hangar-modal');
    const recordsModal = document.getElementById('records-modal');
    const achievementsModal = document.getElementById('achievements-modal');
    
    // --- CARGA DE DATOS GLOBALES ---
    function loadGlobalData() {
        // Cargar créditos
        const savedProgress = localStorage.getItem(PLAYER_PROGRESS_KEY);
        playerProgress = savedProgress ? JSON.parse(savedProgress) : { currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'], shipUpgrades: {} };
        document.getElementById('total-currency-display').textContent = playerProgress.currency;

        // Cargar y mostrar récord de campaña en el menú
        const campaignScoresRaw = localStorage.getItem(CAMPAIGN_HIGH_SCORES_KEY);
        if (campaignScoresRaw) {
            const highScores = JSON.parse(campaignScoresRaw);
            if (highScores.length > 0) {
                document.getElementById('campaign-highscore-display').textContent = highScores[0].score;
            }
        }
    }

    // --- NAVEGACIÓN PRINCIPAL ---
    document.getElementById('campaign-btn').addEventListener('click', () => {
        campaignModal.classList.remove('hidden');
    });

    document.getElementById('infinite-mode-btn').addEventListener('click', () => {
        targetMissionHtml = 'game_infinite.html';
        difficultyModal.dataset.mode = 'infinite';
        difficultyModal.classList.remove('hidden');
    });

    document.querySelectorAll('.mission-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            targetMissionHtml = e.target.dataset.missionHtml;
            campaignModal.classList.add('hidden');
            difficultyModal.dataset.mode = 'campaign';
            difficultyModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = parseFloat(e.target.dataset.difficulty);
            localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify({ difficulty }));
            if (targetMissionHtml) {
                window.location.href = targetMissionHtml;
            }
        });
    });

    // --- LÓGICA PARA CERRAR TODOS LOS MODALES ---
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });
    
    // --- LÓGICA DEL HANGAR ---
    const shipContainer = document.getElementById('ship-selection-container');
    document.getElementById('hangar-btn').addEventListener('click', () => { renderHangar(); hangarModal.classList.remove('hidden'); });

    function renderHangar() {
        // Carga el progreso más reciente antes de renderizar
        const currentProgress = JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY)) || { currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'], shipUpgrades: {} };
        
        shipContainer.innerHTML = '';
        for (const shipId in shipsData) {
            const ship = shipsData[shipId];
            const isUnlocked = currentProgress.unlockedShips.includes(shipId);
            const isSelected = currentProgress.selectedShip === shipId;
            const bay = document.createElement('div');
            bay.className = `ship-bay ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
            let statusHTML = `<p class="ship-status status-locked">BLOQUEADO</p>`;
            let buttonHTML = `<button class="ship-action-btn buy-btn" data-ship-id="${shipId}">Comprar (${ship.price} C)</button>`;
            if (isUnlocked) {
                statusHTML = `<p class="ship-status status-owned">ADQUIRIDO</p>`;
                buttonHTML = `<button class="ship-action-btn select-btn" data-ship-id="${shipId}" ${isSelected ? 'disabled' : ''}>${isSelected ? 'SELECCIONADO' : 'SELECCIONAR'}</button>`;
            }
            let upgradesHTML = '<div class="ship-upgrades">';
            if (isUnlocked) {
                 for(const upgradeId in ship.upgrades) {
                     const upgradeData = ship.upgrades[upgradeId];
                     const currentLevel = (currentProgress.shipUpgrades[shipId] && currentProgress.shipUpgrades[shipId][upgradeId]) || 0;
                     const cost = upgradeData.cost * (currentLevel + 1);
                     upgradesHTML += `<div class="upgrade-item"><span>${upgradeData.label} [${currentLevel}/${upgradeData.maxLevel}]</span><button data-ship-id="${shipId}" data-upgrade-id="${upgradeId}" ${currentLevel >= upgradeData.maxLevel ? 'disabled' : ''}>${currentLevel >= upgradeData.maxLevel ? 'MAX' : `Mejorar (${cost} C)`}</button></div>`;
                 }
            }
            upgradesHTML += '</div>';
            bay.innerHTML = `<h3 class="ship-name">${ship.name}</h3><p class="ship-desc">${ship.description}</p>${statusHTML}${buttonHTML}${upgradesHTML}`;
            shipContainer.appendChild(bay);
        }
    }
    
    shipContainer.addEventListener('click', (e) => {
        const target = e.target;
        const shipId = target.dataset.shipId;
        if (!shipId) return;

        // Cargar el progreso actual para asegurar que no hay conflictos
        let currentProgress = JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY)) || { currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'], shipUpgrades: {} };

        if (target.classList.contains('buy-btn')) {
            const price = shipsData[shipId].price;
            if (currentProgress.currency >= price) {
                currentProgress.currency -= price;
                currentProgress.unlockedShips.push(shipId);
                localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(currentProgress));
                document.getElementById('total-currency-display').textContent = currentProgress.currency; // Actualiza la UI
                renderHangar();
            } else { alert('Créditos insuficientes.'); }
        } else if (target.classList.contains('select-btn')) {
            currentProgress.selectedShip = shipId;
            localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(currentProgress));
            renderHangar();
        } else if (target.dataset.upgradeId) {
            const upgradeId = target.dataset.upgradeId;
            if (!currentProgress.shipUpgrades[shipId]) currentProgress.shipUpgrades[shipId] = {};
            const currentLevel = currentProgress.shipUpgrades[shipId][upgradeId] || 0;
            const cost = shipsData[shipId].upgrades[upgradeId].cost * (currentLevel + 1);
            if (currentProgress.currency >= cost) {
                currentProgress.currency -= cost;
                currentProgress.shipUpgrades[shipId][upgradeId] = currentLevel + 1;
                localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(currentProgress));
                document.getElementById('total-currency-display').textContent = currentProgress.currency; // Actualiza la UI
                renderHangar();
            } else { alert('Créditos insuficientes.'); }
        }
    });

    // --- LÓGICA DE RÉCORDS ---
    const recordsList = document.getElementById('records-list');
    const recordsTitle = document.getElementById('records-title');
    document.getElementById('records-btn').addEventListener('click', () => { recordsModal.classList.remove('hidden'); });
    document.getElementById('show-campaign-records').addEventListener('click', () => { recordsTitle.textContent = 'Campaña'; populateHighScores(CAMPAIGN_HIGH_SCORES_KEY); });
    document.getElementById('show-infinite-records').addEventListener('click', () => { recordsTitle.textContent = 'Modo Infinito'; populateHighScores(INFINITE_HIGH_SCORES_KEY); });
    function populateHighScores(key) { const highScores = JSON.parse(localStorage.getItem(key)) || []; recordsList.innerHTML = highScores.length === 0 ? '<li>No hay puntuaciones todavía.</li>' : highScores.map(scoreEntry => `<li><span class="name">${scoreEntry.name}</span> <span class="score">${scoreEntry.score}</span></li>`).join(''); }

    // --- LÓGICA DE LOGROS ---
    const achievementDefinitions = { 'mision1': { title: "Primer Vuelo", description: "Completa la Misión 1." }, 'mision3': { title: "Cazador Experto", description: "Completa la Misión 3." }, 'rangoS': { title: "Piloto de Élite", description: "Obtén un rango S en cualquier misión." }, 'infinito10k': { title: "Superviviente", description: "Alcanza 10,000 puntos en Modo Infinito." } };
    document.getElementById('achievements-btn').addEventListener('click', () => { populateAchievements(); achievementsModal.classList.remove('hidden'); });
    function populateAchievements() { const saved = localStorage.getItem(ACHIEVEMENTS_KEY); const savedAchievements = saved ? JSON.parse(saved) : {}; const list = document.getElementById('achievements-list'); list.innerHTML = ''; for (const id in achievementDefinitions) { const isUnlocked = savedAchievements[id]; const item = achievementDefinitions[id]; const li = document.createElement('li'); li.innerHTML = `<strong>${item.title}:</strong> ${item.description}`; li.classList.add(isUnlocked ? 'unlocked' : 'locked'); list.appendChild(li); } }
    
    // --- INICIALIZACIÓN ---
    loadGlobalData();
});