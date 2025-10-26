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
    resizeCanvas();
    createStars();
    animate();

    // --- DEFINICIONES DE DATOS ---
    const shipsData = {
        'interceptor': { name: 'Interceptor', description: 'Nave equilibrada con un cañón de plasma frontal de alta velocidad.', price: 0, upgrades: { damage: { label: 'Daño de Plasma', cost: 100, maxLevel: 5 }, firerate: { label: 'Cadencia de Fuego', cost: 150, maxLevel: 5 } } },
        'vanguard': { name: 'Vanguard', description: 'Equipada con un cañón de dispersión que dispara tres proyectiles a la vez.', price: 500, upgrades: { damage: { label: 'Daño por Proyectil', cost: 120, maxLevel: 5 }, spread: { label: 'Amplitud de Dispersión', cost: 200, maxLevel: 3 } } },
        'striker': { name: 'Striker', description: 'Dispara un proyectil frontal potente y dos cañones laterales de apoyo.', price: 1000, upgrades: { mainDamage: { label: 'Cañón Principal', cost: 150, maxLevel: 5 }, sideDamage: { label: 'Cañones Laterales', cost: 180, maxLevel: 5 } } }
    };
    
    // --- LÓGICA DE PROGRESO DEL JUGADOR ---
    const PLAYER_PROGRESS_KEY = 'aceCraftPlayerProgress';
    let playerProgress;

    /**
     * CORRECCIÓN: Esta función ahora usa try-catch para evitar que un error en
     * JSON.parse() detenga la ejecución de todo el script.
     */
    function loadProgress() {
        const saved = localStorage.getItem(PLAYER_PROGRESS_KEY);
        
        try {
            if (saved) {
                playerProgress = JSON.parse(saved);
                // Si los datos parseados no son un objeto válido, forzamos la creación de datos por defecto.
                if (typeof playerProgress !== 'object' || playerProgress === null) {
                    throw new Error("Los datos guardados no son válidos.");
                }
            } else {
                 // Si no hay datos guardados, lanzamos un error para ir al bloque catch.
                throw new Error("No hay progreso guardado.");
            }
        } catch (error) {
            // Si el 'try' falla (por JSON corrupto o porque no había datos), creamos un estado inicial seguro.
            console.error("No se pudo cargar el progreso. Se usará el estado por defecto.", error);
            playerProgress = {
                currency: 0,
                selectedShip: 'interceptor',
                unlockedShips: ['interceptor'],
                shipUpgrades: {
                    'interceptor': { damage: 0, firerate: 0 },
                    'vanguard': { damage: 0, spread: 0 },
                    'striker': { mainDamage: 0, sideDamage: 0 }
                }
            };
        }

        // Nos aseguramos de que la moneda sea un número antes de mostrarla, por si los datos guardados están corruptos.
        if (typeof playerProgress.currency !== 'number' || isNaN(playerProgress.currency)) {
            playerProgress.currency = 0;
        }
        
        document.getElementById('total-currency-display').textContent = playerProgress.currency;
    }


    function saveProgress() {
        localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(playerProgress));
        document.getElementById('total-currency-display').textContent = playerProgress.currency;
    }

    // --- LÓGICA DEL HANGAR ---
    const hangarModal = document.getElementById('hangar-modal');
    const shipContainer = document.getElementById('ship-selection-container');
    const hangarBtn = document.getElementById('hangar-btn');
    const closeHangarBtn = document.getElementById('close-hangar-btn');
    const closeHangarCrossBtn = document.getElementById('close-hangar-cross-btn');

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
                     const currentLevel = playerProgress.shipUpgrades[shipId][upgradeId];
                     const cost = upgradeData.cost * (currentLevel + 1);
                     upgradesHTML += `<div class="upgrade-item"><span>${upgradeData.label} [${currentLevel}/${upgradeData.maxLevel}]</span><button data-ship-id="${shipId}" data-upgrade-id="${upgradeId}" ${currentLevel >= upgradeData.maxLevel ? 'disabled' : ''}>${currentLevel >= upgradeData.maxLevel ? 'MAX' : `Mejorar (${cost} C)`}</button></div>`;
                 }
            }
            upgradesHTML += '</div>';
            bay.innerHTML = `<h3 class="ship-name">${ship.name}</h3><p class="ship-desc">${ship.description}</p>${statusHTML}${buttonHTML}${upgradesHTML}`;
            shipContainer.appendChild(bay);
        }
    }
    
    hangarBtn.addEventListener('click', () => { renderHangar(); hangarModal.classList.remove('hidden'); });
    closeHangarBtn.addEventListener('click', () => hangarModal.classList.add('hidden'));
    closeHangarCrossBtn.addEventListener('click', () => hangarModal.classList.add('hidden'));

    shipContainer.addEventListener('click', (e) => {
        const target = e.target;
        const shipId = target.dataset.shipId;
        if (!shipId) return;
        if (target.classList.contains('ship-action-btn')) {
            if (target.classList.contains('buy-btn')) { const price = shipsData[shipId].price; if (playerProgress.currency >= price) { playerProgress.currency -= price; playerProgress.unlockedShips.push(shipId); saveProgress(); renderHangar(); } else { alert('Créditos insuficientes.'); } }
            else if (target.classList.contains('select-btn')) { playerProgress.selectedShip = shipId; saveProgress(); renderHangar(); }
        } else if (target.dataset.upgradeId) { const upgradeId = target.dataset.upgradeId; const upgradeData = shipsData[shipId].upgrades[upgradeId]; const currentLevel = playerProgress.shipUpgrades[shipId][upgradeId]; const cost = upgradeData.cost * (currentLevel + 1); if(playerProgress.currency >= cost) { playerProgress.currency -= cost; playerProgress.shipUpgrades[shipId][upgradeId]++; saveProgress(); renderHangar(); } else { alert('Créditos insuficientes.'); } }
    });

    // --- LÓGICA DE OTROS BOTONES ---
    document.getElementById('new-game-btn').addEventListener('click', () => { window.location.href = 'game.html'; });
    const creditsBtn = document.getElementById('credits-btn'); const creditsModal = document.getElementById('credits-modal'); const closeCreditsBtn = document.getElementById('close-credits-btn');
    creditsBtn.addEventListener('click', () => creditsModal.classList.remove('hidden')); closeCreditsBtn.addEventListener('click', () => creditsModal.classList.add('hidden'));
    
    const achievementsBtn = document.getElementById('achievements-btn'); const achievementsModal = document.getElementById('achievements-modal'); const closeAchievementsBtn = document.getElementById('close-achievements-btn'); const ACHIEVEMENTS_KEY = 'aceCraftAchievements'; const achievementDefinitions = { 'level5': { title: "Superviviente Nato", description: "Alcanza el nivel 5." }, 'combo50': { title: "Maestro del Combo", description: "Alcanza un combo de 50." }, 'noHitBoss': { title: "Intocable", description: "Derrota a un jefe sin recibir daño." }, 'minions100': { title: "Aniquilador", description: "Destruye 100 secuaces en una partida." }, 'allPowerups': { title: "Coleccionista", description: "Usa todos los tipos de power-ups." } };
    
    function populateAchievements() { const saved = localStorage.getItem(ACHIEVEMENTS_KEY); const savedAchievements = saved ? JSON.parse(saved) : {}; const list = document.getElementById('achievements-list'); list.innerHTML = ''; for (const id in achievementDefinitions) { const isUnlocked = savedAchievements[id] ? savedAchievements[id].unlocked : false; const item = achievementDefinitions[id]; const li = document.createElement('li'); li.textContent = `${item.title}: ${item.description}`; li.classList.add(isUnlocked ? 'unlocked' : 'locked'); list.appendChild(li); } }
    achievementsBtn.addEventListener('click', () => { populateAchievements(); achievementsModal.classList.remove('hidden'); });
    closeAchievementsBtn.addEventListener('click', () => achievementsModal.classList.add('hidden'));

    // Carga inicial de datos del jugador
    loadProgress();
});