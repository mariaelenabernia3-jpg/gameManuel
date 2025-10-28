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
    const HIGH_SCORES_KEY = 'aceCraftHighScores';
    const BOSS_RUSH_HIGH_SCORES_KEY = 'aceCraftBossRushHighScores';
    const ACHIEVEMENTS_KEY = 'aceCraftAchievements';
    let playerProgress;
    let targetMissionHtml = ''; // Variable para guardar a qué misión ir (ej: "game1.html")

    // --- LÓGICA DE PROGRESO DEL JUGADOR ---
    function loadProgress() {
        const saved = localStorage.getItem(PLAYER_PROGRESS_KEY);
        try {
            playerProgress = saved ? JSON.parse(saved) : {
                currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'],
                shipUpgrades: { 'interceptor': { damage: 0, firerate: 0 }, 'vanguard': { damage: 0, spread: 0 }, 'striker': { mainDamage: 0, sideDamage: 0 } }
            };
             // Asegurar que la estructura de shipUpgrades exista para todas las naves
            for (const shipId in shipsData) {
                if (!playerProgress.shipUpgrades[shipId]) {
                    playerProgress.shipUpgrades[shipId] = {};
                }
            }
        } catch (e) {
            console.error("Error al cargar progreso, reseteando.");
            playerProgress = { currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'], shipUpgrades: { 'interceptor': { damage: 0, firerate: 0 }, 'vanguard': { damage: 0, spread: 0 }, 'striker': { mainDamage: 0, sideDamage: 0 } } };
        }
        document.getElementById('total-currency-display').textContent = playerProgress.currency;
    }

    function saveProgress() {
        localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(playerProgress));
        document.getElementById('total-currency-display').textContent = playerProgress.currency;
    }

    // --- LÓGICA DE MODALES ---
    const campaignModal = document.getElementById('campaign-modal');
    const difficultyModal = document.getElementById('difficulty-modal');
    const hangarModal = document.getElementById('hangar-modal');
    const recordsModal = document.getElementById('records-modal');
    const achievementsModal = document.getElementById('achievements-modal');

    // --- SELECCIÓN DE MODO DE JUEGO Y DIFICULTAD ---
    document.getElementById('campaign-btn').addEventListener('click', () => {
        campaignModal.classList.remove('hidden');
    });
    
    document.querySelectorAll('.mission-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            targetMissionHtml = e.target.dataset.missionHtml;
            campaignModal.classList.add('hidden');
            difficultyModal.dataset.mode = 'campaign';
            difficultyModal.classList.remove('hidden');
        });
    });

    document.getElementById('boss-rush-btn').addEventListener('click', () => {
        alert("Modo Boss Rush en construcción.");
        // Para cuando lo implementes, el código sería:
        // targetMissionHtml = 'game_boss_rush.html'; 
        // difficultyModal.dataset.mode = 'boss_rush';
        // difficultyModal.classList.remove('hidden');
    });

    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = parseFloat(e.target.dataset.difficulty);
            const mode = difficultyModal.dataset.mode;
            
            localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify({ difficulty, mode }));

            if (targetMissionHtml) {
                window.location.href = targetMissionHtml;
            }
        });
    });
    
    document.querySelectorAll('.close-campaign-modal, .close-difficulty-modal, .close-hangar-cross-btn, .close-records-modal, .close-achievements-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });


    // --- LÓGICA DEL HANGAR ---
    const shipContainer = document.getElementById('ship-selection-container');
    document.getElementById('hangar-btn').addEventListener('click', () => { loadProgress(); renderHangar(); hangarModal.classList.remove('hidden'); });
    document.getElementById('close-hangar-btn').addEventListener('click', () => hangarModal.classList.add('hidden'));
    
    function renderHangar() {
        shipContainer.innerHTML = '';
        for (const shipId in shipsData) {
            const ship = shipsData[shipId];
            const isUnlocked = playerProgress.unlockedShips.includes(shipId);
            const isSelected = playerProgress.selectedShip === shipId;
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
                     const currentLevel = playerProgress.shipUpgrades[shipId][upgradeId] || 0;
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
        if (target.classList.contains('buy-btn')) {
            const price = shipsData[shipId].price;
            if (playerProgress.currency >= price) {
                playerProgress.currency -= price;
                playerProgress.unlockedShips.push(shipId);
                saveProgress();
                renderHangar();
            } else { alert('Créditos insuficientes.'); }
        } else if (target.classList.contains('select-btn')) {
            playerProgress.selectedShip = shipId;
            saveProgress();
            renderHangar();
        } else if (target.dataset.upgradeId) {
            const upgradeId = target.dataset.upgradeId;
            const upgradeData = shipsData[shipId].upgrades[upgradeId];
            const currentLevel = playerProgress.shipUpgrades[shipId][upgradeId] || 0;
            const cost = upgradeData.cost * (currentLevel + 1);
            if(playerProgress.currency >= cost) {
                playerProgress.currency -= cost;
                playerProgress.shipUpgrades[shipId][upgradeId] = (playerProgress.shipUpgrades[shipId][upgradeId] || 0) + 1;
                saveProgress();
                renderHangar();
            } else { alert('Créditos insuficientes.'); }
        }
    });

    // --- LÓGICA DE RÉCORDS ---
    const recordsList = document.getElementById('records-list');
    const recordsTitle = document.getElementById('records-title');
    document.getElementById('records-btn').addEventListener('click', () => { recordsTitle.textContent = 'Selecciona una tabla'; recordsList.innerHTML = ''; recordsModal.classList.remove('hidden'); });
    document.getElementById('show-standard-records').addEventListener('click', () => { recordsTitle.textContent = 'Campaña'; populateHighScores(HIGH_SCORES_KEY); });
    document.getElementById('show-boss-rush-records').addEventListener('click', () => { recordsTitle.textContent = 'Boss Rush'; populateHighScores(BOSS_RUSH_HIGH_SCORES_KEY); });
    function initializeHighScores() { if (!localStorage.getItem(HIGH_SCORES_KEY)) { const defaultScores = [{name:"ACE_PILOT",score:150000},{name:"VOID_DRIFTER",score:100000},{name:"NOVA_STRIKER",score:75000},{name:"CYGNUS_X1",score:40000},{name:"ROOKIE",score:10000}]; localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(defaultScores)); } if (!localStorage.getItem(BOSS_RUSH_HIGH_SCORES_KEY)) { const defaultScores = [{name:"TITAN_SLAYER",score:250000},{name:"JUGGERNAUT",score:180000},{name:"WARLORD",score:120000},{name:"GLADIATOR",score:80000},{name:"SURVIVOR",score:50000}]; localStorage.setItem(BOSS_RUSH_HIGH_SCORES_KEY, JSON.stringify(defaultScores)); } }
    function populateHighScores(key) { const highScores = JSON.parse(localStorage.getItem(key)) || []; recordsList.innerHTML = highScores.length === 0 ? '<li>No hay puntuaciones todavía.</li>' : highScores.map(scoreEntry => `<li><span class="name">${scoreEntry.name}</span> <span class="score">${scoreEntry.score}</span></li>`).join(''); }
    
    // --- LÓGICA DE LOGROS ---
    const achievementDefinitions = {
        'level5': { title: "Superviviente Nato", description: "Completa 5 misiones." },
        'combo50': { title: "Maestro del Combo", description: "Alcanza un combo de 50." },
        'noHitBoss': { title: "Intocable", description: "Derrota a un jefe sin recibir daño." },
        'allShips': { title: "Coleccionista de Élite", description: "Desbloquea todas las naves." }
    };
    document.getElementById('achievements-btn').addEventListener('click', () => { populateAchievements(); achievementsModal.classList.remove('hidden'); });
    document.getElementById('close-achievements-btn').addEventListener('click', () => achievementsModal.classList.add('hidden'));
    function populateAchievements() { const saved = localStorage.getItem(ACHIEVEMENTS_KEY); const savedAchievements = saved ? JSON.parse(saved) : {}; const list = document.getElementById('achievements-list'); list.innerHTML = ''; for (const id in achievementDefinitions) { const isUnlocked = savedAchievements[id] ? savedAchievements[id].unlocked : false; const item = achievementDefinitions[id]; const li = document.createElement('li'); li.innerHTML = `<strong>${item.title}:</strong> ${item.description}`; li.classList.add(isUnlocked ? 'unlocked' : 'locked'); list.appendChild(li); } }
    
    // --- INICIALIZACIÓN ---
    loadProgress();
    initializeHighScores();
});