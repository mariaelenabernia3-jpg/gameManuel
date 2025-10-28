const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Detección de dispositivo móvil.
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// --- Variables de Estado del Juego ---
let level, score, isGameOver, difficultyMultiplier, currentBossIndex, coinMultiplier, activeControl = 'none';
let stars = [];
let combo = { count: 0, multiplier: 1, timer: 0 };
const entityArrays = { bossProjectiles: [], playerBullets: [], explosions: [], minions: [], powerUps: [], minionProjectiles: [], companionBullets: [] };
let companion = null;
let coinsEarnedThisGame = 0;
let bossesDefeatedInRun = 0;
let laserUsesInRun = 0;

// --- Sprites y Sonidos ---
function loadImage(src) { const img = new Image(); img.src = src; img.loaded = false; img.onload = () => { img.loaded = true; }; img.onerror = () => { console.error(`No se pudo cargar: ${src}`); }; return img; }
const sprites = {
    playerShips: { interceptor: loadImage('assets/nave.png'), vanguard: loadImage('assets/nave2.png'), striker: loadImage('assets/nave3.png') },
    player: null,
    bosses: [loadImage('assets/Boss1.png'), loadImage('assets/Boss2.png'), loadImage('assets/Boss3.png')],
    powerUps: {
        tripleShot: loadImage('assets/powerup_triple.png'),
        shield: loadImage('assets/powerup_shield.png'),
        bomb: loadImage('assets/powerup_bomb.png'),
        health: loadImage('assets/powerup_health.png'),
        companion: loadImage('assets/powerup_companion.png')
    },
    companionDrone: loadImage('assets/drone.png'),
    // --- INICIO DE LA MODIFICACIÓN ---
    minion: loadImage('assets/Enemy.png'), // <-- NUEVA IMAGEN PARA LOS SECUACES
    // --- FIN DE LA MODIFICACIÓN ---
    backgrounds: [loadImage('assets/fondo1.png'), loadImage('assets/fondo2.png')]
};
const sounds = { shoot: new Audio('assets/hitHurt.wav'), explosion: new Audio('assets/explosion.wav') };
let currentBackground = null;

function playSound(sound) {
    const audio = sound.cloneNode();
    audio.play().catch(e => { /* Ignorar error de interacción del usuario si ocurre */ });
}


// --- Definiciones de Naves y Logros ---
const shipsData = {
    'interceptor': { name: 'Interceptor', firePattern: 'single', baseDamage: 10, baseSpeed: 5, baseShootInterval: 450, baseHealth: 100, upgrades: { damage: 2, firerate: -20 } },
    'vanguard':    { name: 'Vanguard',    firePattern: 'spread', baseDamage: 7, baseSpeed: 4.5, baseShootInterval: 500, baseHealth: 75,  upgrades: { damage: 2, spread: 0.05 } },
    'striker':     { name: 'Striker',     firePattern: 'side',   baseDamage: 12, baseSpeed: 4,   baseShootInterval: 480, baseHealth: 100, upgrades: { mainDamage: 3, sideDamage: 2 } }
};

let player = {}; let boss = {}; let minionsDestroyedInLevel = 0; let damageTakenInLevel = 0;
const bosses = [ { name: "Guardián", sprite: sprites.bosses[0], width: 140, height: 70, attackPattern: 'burst', phaseTwoAttack: 'stream', minionType: 'standard' }, { name: "Invasor", sprite: sprites.bosses[1], width: 120, height: 80, attackPattern: 'spiral', phaseTwoAttack: 'walls', minionType: 'fast' }, { name: "Depredador", sprite: sprites.bosses[2], width: 150, height: 60, attackPattern: 'homing', phaseTwoAttack: 'shotgun', minionType: 'tank' } ];
const achievements = { 'level5': { title: "Superviviente Nato", unlocked: false, reward: 50 }, 'combo50': { title: "Maestro del Combo", unlocked: false, reward: 50 }, 'noHitBoss': { title: "Intocable", unlocked: false, reward: 100 }, 'minions100': { title: "Aniquilador", unlocked: false, reward: 75 }, 'allPowerups': { title: "Coleccionista", unlocked: false, progress: new Set(), reward: 75 }, 'bossHunter': { title: "Cazador de Gigantes", unlocked: false, reward: 150 }, 'laserMaster': { title: "Poder Desatado", unlocked: false, reward: 50 }, 'closeCall': { title: "Al Filo de la Muerte", unlocked: false, reward: 100 }, 'creditHoarder': { title: "Botín de Guerra", unlocked: false, reward: 100 } };

const ACHIEVEMENTS_KEY = 'aceCraftAchievements'; const PLAYER_PROGRESS_KEY = 'aceCraftPlayerProgress'; const HIGH_SCORES_KEY = "aceCraftHighScores";

const ui = { startMenu: document.getElementById('start-menu'), easyBtn: document.getElementById('easyBtn'), normalBtn: document.getElementById('normalBtn'), hardBtn: document.getElementById('hardBtn'), backToMenuBtn: document.getElementById('back-to-menu-btn'), highscoreTable: document.getElementById('highscore-table'), highscoreList: document.getElementById('highscore-list'), backToMenuFromScoresBtn: document.getElementById('back-to-menu-from-scores-btn'), specialMeterBar: document.getElementById('special-meter-bar'), laserBtn: document.getElementById('laserBtn'), achievementToast: document.getElementById('achievement-toast'), loadingScreen: document.getElementById('loading-screen'), loadingBar: document.getElementById('loading-bar'), loadingText: document.getElementById('loading-text'), countdownDisplay: document.getElementById('countdown-display') };

function saveAchievements() { const achievementsToSave = {}; for (const key in achievements) { achievementsToSave[key] = { unlocked: achievements[key].unlocked }; } localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievementsToSave)); }
function loadAchievements() { const saved = localStorage.getItem(ACHIEVEMENTS_KEY); if (saved) { try { const savedAchievements = JSON.parse(saved); for (const key in savedAchievements) { if (achievements[key]) { achievements[key].unlocked = savedAchievements[key].unlocked; } } } catch(e) { console.error("Error al cargar logros", e); } } }
function showAchievementToast(title, reward) { ui.achievementToast.textContent = `¡Logro: ${title}! (+${reward} C)`; ui.achievementToast.style.top = '20px'; setTimeout(() => { ui.achievementToast.style.top = '-100px'; }, 4000); }
function unlockAchievement(id) { if (achievements[id] && !achievements[id].unlocked) { achievements[id].unlocked = true; const reward = achievements[id].reward; showAchievementToast(achievements[id].title, reward); const playerProgress = getSanitizedPlayerProgress(); playerProgress.currency += reward; localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(playerProgress)); saveAchievements(); } }

let selectedDifficulty = 1.0;

function prepareGame(diffMult) {
    selectedDifficulty = diffMult;
    ui.startMenu.style.display = 'none';
    ui.loadingScreen.style.display = 'flex';
    preloadAssets(startCountdown);
}

function preloadAssets(onCompleteCallback) {
    // --- INICIO DE LA MODIFICACIÓN ---
    // Añadida la imagen del secuaz a la lista de precarga
    const assetList = [ ...Object.values(sprites.playerShips), ...sprites.bosses, ...Object.values(sprites.powerUps), sprites.companionDrone, sprites.minion, ...sprites.backgrounds, ...Object.values(sounds) ];
    // --- FIN DE LA MODIFICACIÓN ---
    let loadedCount = 0;
    const totalAssets = assetList.length;
    if (totalAssets === 0) { onCompleteCallback(); return; }
    const assetLoaded = () => {
        loadedCount++;
        const progress = loadedCount / totalAssets;
        ui.loadingBar.style.width = `${progress * 100}%`;
        if (loadedCount === totalAssets) { ui.loadingText.textContent = `¡LISTO!`; setTimeout(onCompleteCallback, 500); }
    };
    assetList.forEach(asset => {
        if (asset instanceof HTMLImageElement) { if (asset.complete) { assetLoaded(); } else { asset.onload = assetLoaded; asset.onerror = assetLoaded; }
        } else if (asset instanceof HTMLAudioElement) { if (asset.readyState >= 2) { assetLoaded(); } else { asset.addEventListener('canplaythrough', assetLoaded, { once: true }); asset.addEventListener('error', assetLoaded, { once: true }); } }
    });
}

function startCountdown() {
    ui.loadingScreen.style.display = 'none';
    ui.countdownDisplay.style.display = 'block';
    let count = 3;
    ui.countdownDisplay.textContent = count;
    const interval = setInterval(() => {
        count--;
        if (count > 0) { ui.countdownDisplay.textContent = count; } 
        else { clearInterval(interval); ui.countdownDisplay.textContent = 'START!'; setTimeout(() => { ui.countdownDisplay.style.display = 'none'; startGame(); }, 800); }
    }, 1000);
}

function getSanitizedPlayerProgress() {
    const defaultProgress = { currency: 0, selectedShip: 'interceptor', unlockedShips: ['interceptor'], shipUpgrades: { 'interceptor': { damage: 0, firerate: 0 }, 'vanguard': { damage: 0, spread: 0 }, 'striker': { mainDamage: 0, sideDamage: 0 } } };
    let playerProgress;
    try { const savedProgress = localStorage.getItem(PLAYER_PROGRESS_KEY); playerProgress = savedProgress ? JSON.parse(savedProgress) : defaultProgress; if (typeof playerProgress !== 'object' || playerProgress === null) playerProgress = defaultProgress; } catch { playerProgress = defaultProgress; }
    playerProgress.currency = typeof playerProgress.currency === 'number' ? playerProgress.currency : 0;
    playerProgress.unlockedShips = Array.isArray(playerProgress.unlockedShips) ? playerProgress.unlockedShips : ['interceptor'];
    playerProgress.shipUpgrades = playerProgress.shipUpgrades || {};
    for (const shipId in shipsData) { if (!playerProgress.shipUpgrades[shipId]) { playerProgress.shipUpgrades[shipId] = defaultProgress.shipUpgrades[shipId]; } }
    if (!playerProgress.unlockedShips.includes(playerProgress.selectedShip)) { playerProgress.selectedShip = 'interceptor'; }
    return playerProgress;
}

function startGame() {
    difficultyMultiplier = selectedDifficulty;
    if (difficultyMultiplier === 0.75) { coinMultiplier = 0.4; } else if (difficultyMultiplier === 1.5) { coinMultiplier = 1.5; } else { coinMultiplier = 0.8; }
    const playerProgress = getSanitizedPlayerProgress();
    const selectedShipId = playerProgress.selectedShip;
    const shipBaseStats = shipsData[selectedShipId];
    const shipUpgrades = playerProgress.shipUpgrades[selectedShipId];
    sprites.player = sprites.playerShips[selectedShipId];
    const finalStats = { ...shipBaseStats };
    if (selectedShipId === 'interceptor') { finalStats.damage = shipBaseStats.baseDamage + (shipUpgrades.damage * shipBaseStats.upgrades.damage); finalStats.shootInterval = shipBaseStats.baseShootInterval + (shipUpgrades.firerate * shipBaseStats.upgrades.firerate);
    } else if (selectedShipId === 'vanguard') { finalStats.damage = shipBaseStats.baseDamage + (shipUpgrades.damage * shipBaseStats.upgrades.damage); finalStats.spreadAngle = 0.2 + (shipUpgrades.spread * shipBaseStats.upgrades.spread); finalStats.shootInterval = shipBaseStats.baseShootInterval;
    } else if (selectedShipId === 'striker') { finalStats.damage = shipBaseStats.baseDamage + (shipUpgrades.mainDamage * shipBaseStats.upgrades.mainDamage); finalStats.sideDamage = 4 + (shipUpgrades.sideDamage * shipBaseStats.upgrades.sideDamage); finalStats.shootInterval = shipBaseStats.baseShootInterval; }
    finalStats.speed = shipBaseStats.baseSpeed;
    resetGame(finalStats);
    gameLoop();
}

function resetGame(finalStats) {
    isGameOver = false; level = 1; score = 0; currentBossIndex = 0; activeControl = 'none';
    combo = { count: 0, multiplier: 1, timer: 0 }; minionsDestroyedInLevel = 0; damageTakenInLevel = 0;
    coinsEarnedThisGame = 0; if (achievements.allPowerups) achievements.allPowerups.progress = new Set();
    player = { x: canvas.width / 2 - 25, y: canvas.height - 100, health: finalStats.baseHealth, maxHealth: finalStats.baseHealth, lastShot: 0, shieldExpiresAt: 0, tripleShotExpiresAt: 0, isFiringLaser: false, specialMeter: 0, maxSpecial: 100, size: 50, ...finalStats };
    player.hitboxWidth = player.size * 0.6;
    player.hitboxHeight = player.size * 0.8;
    for (const key in entityArrays) { entityArrays[key].length = 0; }
    companion = null;
    bossesDefeatedInRun = 0; laserUsesInRun = 0;
    increaseSpecialMeter(0); ui.laserBtn.style.display = 'none'; loadNextBoss();
}

function loadNextBoss() {
    damageTakenInLevel = 0;
    const bossData = bosses[currentBossIndex];
    boss = { ...bossData, x: canvas.width / 2 - bossData.width / 2, y: 50, speed: (2 + level * 0.1) * difficultyMultiplier, shootInterval: Math.max(200, (1000 - level * 50) / difficultyMultiplier), health: (100 + level * 75) * difficultyMultiplier, maxHealth: (100 + level * 75) * difficultyMultiplier, lastShot: 0, spiralAngle: 0, isPhaseTwo: false, phaseTwoProps: {} };
    currentBackground = sprites.backgrounds[(level - 1) % sprites.backgrounds.length];
    createStars();
}

let lastTime = 0; function gameLoop(timestamp) { if (isGameOver) return; const deltaTime = (timestamp - lastTime) / 1000 || 0; lastTime = timestamp; score++; update(deltaTime); draw(); requestAnimationFrame(gameLoop); }

function update(dt) {
    updateStars(); 
    updatePlayerState(dt); 
    updateCompanion();
    handleControls(); 
    autoShootPlayer();
    if (boss.health > 0) { if (boss.health <= boss.maxHealth / 2 && !boss.isPhaseTwo) { enterPhaseTwo(); } moveBoss(); shootFromBoss(); }
    updateMinionShooting(); 
    updateEntities();
    if (player.isFiringLaser) updateLaser();
    if (coinsEarnedThisGame >= 250) { unlockAchievement('creditHoarder'); }
}

function draw() {
    ctx.fillStyle = "#000010"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (currentBackground && currentBackground.loaded) { ctx.drawImage(currentBackground, 0, 0, canvas.width, canvas.height); }
    drawStars(); 
    drawPlayer(); 
    if (companion && companion.active) drawCompanion();
    if (boss && boss.health > 0) drawBoss(); 
    drawProjectiles(); 
    drawMinions(); 
    drawExplosions(); 
    drawPowerUps(); 
    if (player.isFiringLaser) drawLaser(); 
    drawUI();
}
    
ui.easyBtn.addEventListener('click', () => prepareGame(0.75));
ui.normalBtn.addEventListener('click', () => prepareGame(1.0));
ui.hardBtn.addEventListener('click', () => prepareGame(1.5));
ui.backToMenuBtn.addEventListener('click', () => { window.location.href = 'menu.html'; });
ui.laserBtn.addEventListener('click', fireLaser);
ui.backToMenuFromScoresBtn.addEventListener('click', () => { window.location.href = 'menu.html'; });

window.addEventListener("resize", resizeCanvas);
canvas.addEventListener('contextmenu', e => e.preventDefault());
let direction = null; const mousePos = { x: 0, y: 0 };
canvas.addEventListener('mousemove', e => { activeControl = 'mouse'; mousePos.x = e.clientX; mousePos.y = e.clientY; });
window.addEventListener("keydown", e => { const key = e.key.toLowerCase(); if (["arrowup", "w", "arrowdown", "s", "arrowleft", "a", "arrowright", "d"].includes(key)) { activeControl = 'keyboard'; } switch (key) { case "arrowup": case "w": direction = "up"; break; case "arrowdown": case "s": direction = "down"; break; case "arrowleft": case "a": direction = "left"; break; case "arrowright": case "d": direction = "right"; break; case " ": e.preventDefault(); fireLaser(); break; } });
window.addEventListener("keyup", e => { switch(e.key.toLowerCase()){case "arrowup":case "w":if(direction==="up")direction=null;break;case "arrowdown":case "s":if(direction==="down")direction=null;break;case "arrowleft":case "a":if(direction==="left")direction=null;break;case "arrowright":case "d":if(direction==="right")direction=null;break;} });

// --- Controles Táctiles Relativos (Anti-Teletransporte) ---
let isDragging = false;
let touchStartX = 0;
let touchStartY = 0;
let playerStartX = 0;
let playerStartY = 0;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (isGameOver) return;
    activeControl = 'touch';
    isDragging = true;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    playerStartX = player.x;
    playerStartY = player.y;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (isDragging) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        player.x = playerStartX + deltaX;
        player.y = playerStartY + deltaY;
    }
}, { passive: false });

canvas.addEventListener('touchend', () => { isDragging = false; });
// --- Fin de los Controles Táctiles ---

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function createStars() { stars = []; for (let i = 0; i < 100; i++) { stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: Math.random() * 2 + 1, speed: Math.random() * 1.5 + 0.5 }); } }
function updateStars() { stars.forEach(s => { s.y += s.speed; if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; } }); }
function handleControls() { if (!player || typeof player.speed !== 'number') return; if (activeControl === 'mouse') { player.x = mousePos.x - player.size / 2; player.y = mousePos.y - player.size / 2; } else if (activeControl === 'keyboard') { if (direction === "up" && player.y > 0) player.y -= player.speed; if (direction === "down" && player.y + player.size < canvas.height) player.y += player.speed; if (direction === "left" && player.x > 0) player.x -= player.speed; if (direction === "right" && player.x + player.size < canvas.width) player.x += player.speed; } player.x = Math.max(0, Math.min(canvas.width - player.size, player.x)); player.y = Math.max(0, Math.min(canvas.height - player.size, player.y)); }
function autoShootPlayer() { if (!player || typeof player.shootInterval !== 'number') return; if (Date.now() - player.lastShot > player.shootInterval && !player.isFiringLaser) { playSound(sounds.shoot); const centerX = player.x + player.size / 2; const tripleShotActive = Date.now() < player.tripleShotExpiresAt; if (tripleShotActive) { for (let i = -1; i <= 1; i++) entityArrays.playerBullets.push({ x: centerX, y: player.y, radius: 6, speed: 8, damage: player.damage, angle: 0.2 * i, active: true }); } else { switch(player.firePattern) { case 'single': entityArrays.playerBullets.push({ x: centerX, y: player.y, radius: 6, speed: 8, damage: player.damage, angle: 0, active: true }); break; case 'spread': for (let i = -1; i <= 1; i++) entityArrays.playerBullets.push({ x: centerX, y: player.y, radius: 5, speed: 7, damage: player.damage, angle: player.spreadAngle * i, active: true }); break; case 'side': entityArrays.playerBullets.push({ x: centerX, y: player.y, radius: 7, speed: 8, damage: player.damage, angle: 0, active: true }); entityArrays.playerBullets.push({ x: player.x, y: player.y + 20, radius: 4, speed: 6, damage: player.sideDamage, isSide: true, direction: -1, active: true }); entityArrays.playerBullets.push({ x: player.x + player.size, y: player.y + 20, radius: 4, speed: 6, damage: player.sideDamage, isSide: true, direction: 1, active: true }); break; } } player.lastShot = Date.now(); } }
function checkPlayerDamage(t) { if (!(Date.now() < player.shieldExpiresAt)) { player.health -= t; damageTakenInLevel += t; if (player.health <= 0 && !isGameOver) saveAndShowScores() } }
function increaseCombo() { combo.count++; combo.timer = 3; combo.multiplier = 1 + Math.floor(combo.count / 5); if (combo.count >= 50) unlockAchievement('combo50') }
function updatePlayerState(t) { if (combo.timer > 0) { combo.timer -= t; if (combo.timer <= 0) { combo.count = 0; combo.multiplier = 1 } } }
function spawnPowerUp(t, e) {
    const powerupTypes = ['tripleShot', 'shield', 'bomb', 'health', 'companion'];
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    const size = (type === 'health') ? 64 : (type === 'companion' ? 40 : 30);
    entityArrays.powerUps.push({ x: t, y: e, type: type, size: size, speed: 2, active: true });
}
function activatePowerUp(t){
    achievements.allPowerups.progress.add(t);
    if(achievements.allPowerups.progress.size >= 5) unlockAchievement('allPowerups');
    switch(t){
        case 'tripleShot': player.tripleShotExpiresAt = Date.now() + 10000; break;
        case 'shield': player.shieldExpiresAt = Date.now() + 8000; break;
        case 'bomb': entityArrays.minions.forEach(t => t.active = !1); entityArrays.bossProjectiles.forEach(t => t.active = !1); entityArrays.minionProjectiles.forEach(t => t.active = !1); break;
        case 'health': player.health = Math.min(player.maxHealth, player.health + 25); break;
        case 'companion':
            companion = {
                x: player.x,
                y: player.y,
                size: 40,
                expiresAt: Date.now() + 15000, 
                lastShot: 0,
                shootInterval: 600, 
                damage: 5, 
                active: true
            };
            break;
    }
}
function increaseSpecialMeter(t){if(player.isFiringLaser)return;player.specialMeter=Math.min(player.maxSpecial,player.specialMeter+t);ui.specialMeterBar.style.width=`${player.specialMeter/player.maxSpecial*100}%`;if(player.specialMeter>=player.maxSpecial){ui.laserBtn.style.display='block'}}
function fireLaser(){if(player.specialMeter>=player.maxSpecial&&!isGameOver&&!player.isFiringLaser){player.isFiringLaser=!0;ui.laserBtn.style.display='none';setTimeout(()=>{player.isFiringLaser=!1},3e3); laserUsesInRun++; if (laserUsesInRun >= 5) { unlockAchievement('laserMaster'); } }}
function updateLaser(){player.specialMeter=Math.max(0,player.specialMeter-player.maxSpecial/180);ui.specialMeterBar.style.width=`${player.specialMeter/player.maxSpecial*100}%`;const t={x:player.x+player.size/2-5,y:0,width:10,height:player.y};entityArrays.minions.forEach(e=>{if(e.active&&t.x<e.x+e.size&&t.x+t.width>e.x){e.health-=2}});if(boss.health>0&&t.x<boss.x+boss.width&&t.x+t.width>boss.x){boss.health-=2}}
function updateCompanion() {
    if (!companion || !companion.active) return;

    if (Date.now() > companion.expiresAt) {
        companion.active = false;
        companion = null;
        return;
    }

    const targetX = player.x - 50; 
    const targetY = player.y + 20;
    const lerpFactor = 0.1; 
    companion.x += (targetX - companion.x) * lerpFactor;
    companion.y += (targetY - companion.y) * lerpFactor;

    if (Date.now() - companion.lastShot > companion.shootInterval) {
        playSound(sounds.shoot); 
        entityArrays.companionBullets.push({
            x: companion.x + companion.size / 2,
            y: companion.y,
            radius: 4,
            speed: 6,
            damage: companion.damage,
            active: true
        });
        companion.lastShot = Date.now();
    }
}
function enterPhaseTwo() { boss.isPhaseTwo = true; boss.speed *= 1.5; boss.shootInterval *= 0.7; if (boss.name === "Invasor") boss.phaseTwoProps.wallDirection = 1; if (boss.name === "Depredador") boss.phaseTwoProps.nextTeleport = Date.now() + 2000; entityArrays.minions.forEach(minion => { if (minion.active) { minion.isKamikaze = true; const angle = Math.atan2((player.y + player.size / 2) - (minion.y + minion.size / 2), (player.x + player.size / 2) - (minion.x + minion.size / 2)); const speed = 4 * difficultyMultiplier; minion.vx = Math.cos(angle) * speed; minion.vy = Math.sin(angle) * speed; } }); }
function moveBoss() { if (!boss || boss.health <= 0) return; if (boss.isPhaseTwo) { switch (boss.name) { case "Guardián": case "Invasor": const targetX = player.x + player.size / 2 - boss.width / 2; const dir = targetX - boss.x; if (Math.abs(dir) > boss.speed) boss.x += Math.sign(dir) * boss.speed; break; case "Depredador": if (Date.now() > boss.phaseTwoProps.nextTeleport) { boss.x = Math.random() * (canvas.width - boss.width); boss.phaseTwoProps.nextTeleport = Date.now() + 3000; } break; } } else { const targetX = player.x + player.size / 2 - boss.width / 2; const dir = targetX - boss.x; if (Math.abs(dir) > boss.speed) boss.x += Math.sign(dir) * boss.speed; } boss.x = Math.max(0, Math.min(canvas.width - boss.width, boss.x)); if (Math.random() < (0.015 * difficultyMultiplier) && entityArrays.minions.length < 5) spawnMinion(); }
function updateMinionShooting() { entityArrays.minions.forEach(t => { if (t.active && !t.isKamikaze && Date.now() - t.lastShot > t.shootInterval) { entityArrays.minionProjectiles.push({ x: t.x + t.size / 2, y: t.y + t.size, radius: 5, speed: 3 * difficultyMultiplier, active: true }); t.lastShot = Date.now(); } }); }
function shootFromBoss() {
    if (!boss || boss.health <= 0 || Date.now() - boss.lastShot < boss.shootInterval) return;
    boss.lastShot = Date.now();
    const centerX = boss.x + boss.width / 2;
    const centerY = boss.y + boss.height;
    const speedModifier = isMobile ? 0.85 : 1.0;
    const baseSpeed = (4 * difficultyMultiplier) * speedModifier;
    const attack = boss.isPhaseTwo ? boss.phaseTwoAttack : boss.attackPattern;
    switch (attack) {
        case 'burst': for(let r=-1;r<=1;r++){const s=Math.atan2(player.y-centerY,player.x+player.size/2-centerX)+.25*r;entityArrays.bossProjectiles.push({x:centerX,y:centerY,radius:8,vx:Math.cos(s)*baseSpeed,vy:Math.sin(s)*baseSpeed,active:true})}break;
        case 'spiral': for(let r=0;r<4;r++){const s=boss.spiralAngle+r*(Math.PI/2);entityArrays.bossProjectiles.push({x:centerX,y:centerY,radius:6,vx:Math.cos(s)*baseSpeed,vy:Math.sin(s)*baseSpeed,active:true})}boss.spiralAngle+=.3;break;
        case 'homing': const r=Math.atan2(player.y-centerY,player.x+player.size/2-centerX);entityArrays.bossProjectiles.push({x:centerX,y:centerY,radius:10,vx:Math.cos(r)*baseSpeed,vy:Math.sin(r)*baseSpeed,active:true,homing:true,homingDuration:Date.now()+2e3}); break;
        case 'stream': for(let i=0; i < 3; i++) { setTimeout(() => { if(boss.health > 0) { const s=Math.atan2(player.y-centerY,player.x+player.size/2-centerX);entityArrays.bossProjectiles.push({x:centerX,y:centerY,radius:5,vx:Math.cos(s)*baseSpeed*1.2,vy:Math.sin(s)*baseSpeed*1.2,active:true}); } }, i * 100); } break;
        case 'walls': const gap = canvas.width / 6; for(let i=0; i < 7; i++) { if(i !== boss.phaseTwoProps.wallDirection) { entityArrays.bossProjectiles.push({x:i*gap,y:centerY,radius:10,vx:0,vy:baseSpeed*0.8,active:true}); } } boss.phaseTwoProps.wallDirection = (boss.phaseTwoProps.wallDirection + 1) % 7; break;
        case 'shotgun': const bulletCount = isMobile ? 8 : 12; for(let i=0; i<bulletCount; i++) { const s=Math.atan2(player.y-centerY,player.x+player.size/2-centerX)+(Math.random()-0.5)*0.8;entityArrays.bossProjectiles.push({x:centerX,y:centerY,radius:7,vx:Math.cos(s)*baseSpeed,vy:Math.sin(s)*baseSpeed,active:true}); } break;
    }
}
function spawnMinion(){const t=boss.minionType;let e={x:Math.random()*(canvas.width-35),y:120,size:25,type:t,health:10,speedX:2,active:true,lastShot:Date.now(),shootInterval:3e3};if(t==='fast'){e.size=20;e.health=5*difficultyMultiplier;e.speedX=4*difficultyMultiplier;e.shootInterval=2500}else if(t==='tank'){e.size=35;e.health=30*difficultyMultiplier;e.speedX=1*difficultyMultiplier;e.shootInterval=4e3;e.maxHealth=e.health}else{e.health*=difficultyMultiplier;e.speedX*=difficultyMultiplier}entityArrays.minions.push(e)}
function updateEntities(){ function t(t,e){if(!t||!e)return!1;let a=t.x,r=t.y;if(t.x<e.x)a=e.x;else if(t.x>e.x+(e.size||e.width))a=e.x+(e.size||e.width);if(t.y<e.y)r=e.y;else if(t.y>e.y+(e.size||e.height))r=e.y+(e.size||e.height);return Math.hypot(t.x-a,t.y-r)<=t.radius}
    const playerHitbox = { x: player.x + (player.size - player.hitboxWidth) / 2, y: player.y + (player.size - player.hitboxHeight) / 2, width: player.hitboxWidth, height: player.hitboxHeight };
    entityArrays.bossProjectiles.forEach(e=>{if(e.homing&&Date.now()<e.homingDuration&&player){const t=Math.atan2(player.y+player.size/2-e.y,player.x+player.size/2-e.x),a=4*difficultyMultiplier;e.vx=Math.cos(t)*a;e.vy=Math.sin(t)*a}e.x+=e.vx;e.y+=e.vy;if(player && t(e,playerHitbox)){checkPlayerDamage(10);e.active=!1}if(e.y>canvas.height+20||e.x<-20||e.x>canvas.width+20)e.active=!1});
    entityArrays.playerBullets.forEach(e=>{if(e.isSide){ e.x += e.speed * e.direction; e.y -= 0.5; } else { e.x += Math.sin(e.angle) * e.speed; e.y -= Math.cos(e.angle) * e.speed } if(e.y<-20||e.y>canvas.height||e.x<-20||e.x>canvas.width+20)e.active=!1; if(boss.health>0&&t(e,boss)){boss.health-=e.damage;e.active=!1;increaseSpecialMeter(.5)}});
    entityArrays.minionProjectiles.forEach(e=>{e.y+=e.speed;if(player && t(e,playerHitbox)){checkPlayerDamage(5);e.active=!1}if(e.y>canvas.height)e.active=!1});
    entityArrays.explosions.forEach(t=>{t.radius+=2;t.alpha-=.05;if(t.alpha<=0)t.active=!1});
    entityArrays.powerUps.forEach(t=>{t.y+=t.speed;if(player && t.x<player.x+player.size&&t.x+t.size>player.x&&t.y<player.y+player.size&&t.y+t.size>player.y){activatePowerUp(t.type);t.active=!1}if(t.y>canvas.height)t.active=!1});
    entityArrays.minions.forEach(e=>{ if (e.isKamikaze) { e.x += e.vx; e.y += e.vy; const playerHitboxRadius = (player.hitboxWidth + player.hitboxHeight) / 4; const distance = Math.hypot( (e.x + e.size/2) - (player.x + player.size/2), (e.y + e.size/2) - (player.y + player.size/2) ); if (player && distance < playerHitboxRadius + e.size/2) { checkPlayerDamage(20); e.active = false; entityArrays.explosions.push({x: e.x + e.size/2, y: e.y + e.size/2, radius: 15, alpha:1, active:true});} if(e.y > canvas.height + e.size || e.y < -e.size || e.x < -e.size || e.x > canvas.width + e.size) e.active = false; } else { e.x += e.speedX; if(e.x<=0||e.x+e.size>=canvas.width)e.speedX*=-1; } entityArrays.playerBullets.forEach(a=>{if(a.active&&t(a,e)){e.health-=a.damage;a.active=!1;increaseSpecialMeter(1)}}); if(e.health<=0){if(e.active){score+=50*combo.multiplier;coinsEarnedThisGame += (1 * coinMultiplier);increaseCombo();minionsDestroyedInLevel++;if(minionsDestroyedInLevel>=100)unlockAchievement('minions100');}e.active=!1;if(Math.random()<.15)spawnPowerUp(e.x,e.y)} });
    entityArrays.companionBullets.forEach(bullet => {
        bullet.y -= bullet.speed; 
        if (bullet.y < -10) bullet.active = false;
        entityArrays.minions.forEach(minion => {
            if (minion.active && t(bullet, minion)) {
                minion.health -= bullet.damage;
                bullet.active = false;
            }
        });
        if (boss.health > 0 && t(bullet, boss)) {
            boss.health -= bullet.damage;
            bullet.active = false;
        }
    });
    if(boss.health<=0){ entityArrays.explosions.push({x:boss.x+boss.width/2,y:boss.y+boss.height/2,radius:30,alpha:1,active:!0}); playSound(sounds.explosion); coinsEarnedThisGame += (50 * coinMultiplier); score+=1e3*level*combo.multiplier; if(damageTakenInLevel===0) unlockAchievement('noHitBoss'); if (player && player.health / player.maxHealth < 0.1) unlockAchievement('closeCall'); level++; if(level>=5) unlockAchievement('level5'); bossesDefeatedInRun++; if (bossesDefeatedInRun >= 3) unlockAchievement('bossHunter'); increaseCombo(); currentBossIndex=(currentBossIndex+1)%bosses.length; entityArrays.minions.forEach(t=>t.active=!1); entityArrays.bossProjectiles.forEach(t=>t.active=!1); entityArrays.minionProjectiles.forEach(t=>t.active=!1); loadNextBoss(); }
    for(const a in entityArrays)entityArrays[a]=entityArrays[a].filter(t=>t.active)
}
function drawPlayer(){if(!player || isNaN(player.x)) return; if(Date.now()<player.shieldExpiresAt){ctx.fillStyle="rgba(0, 255, 255, 0.3)";ctx.beginPath();ctx.arc(player.x+player.size/2,player.y+player.size/2,player.size/1.5,0,2*Math.PI);ctx.fill();}if(sprites.player&&sprites.player.loaded){ctx.drawImage(sprites.player,player.x,player.y,player.size,player.size)}else{ctx.fillStyle='lime';ctx.fillRect(player.x,player.y,player.size,player.size)}const t=player.size,e=6,a=player.health/player.maxHealth;if(isNaN(a))return;ctx.fillStyle="#333";ctx.fillRect(player.x,player.y-12,t,e);ctx.fillStyle="#00ff00";ctx.fillRect(player.x,player.y-12,t*a,e)}
function drawBoss(){if(!boss||isNaN(boss.x)||isNaN(boss.y))return; const phaseTwoEffect = boss.isPhaseTwo && Math.floor(Date.now() / 200) % 2 === 0; if (phaseTwoEffect) ctx.filter = 'brightness(1.5) saturate(2)'; if(sprites.bosses[currentBossIndex]&&sprites.bosses[currentBossIndex].loaded){ctx.drawImage(sprites.bosses[currentBossIndex],boss.x,boss.y,boss.width,boss.height)}else{ctx.fillStyle='red';ctx.fillRect(boss.x,boss.y,boss.width,boss.height)} ctx.filter = 'none'; const t=boss.width,e=8,a=boss.health/boss.maxHealth;if(isNaN(a))return;ctx.fillStyle="#333";ctx.fillRect(boss.x,boss.y-14,t,e);ctx.fillStyle="#ff0000";ctx.fillRect(boss.x,boss.y-14,t*a,e)}
function drawProjectiles(){
    entityArrays.bossProjectiles.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;ctx.fillStyle=t.homing&&Date.now()<t.homingDuration?"orange":"#FF00FF";ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,2*Math.PI);ctx.fill()});
    ctx.fillStyle="cyan";entityArrays.playerBullets.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,2*Math.PI);ctx.fill()});
    ctx.fillStyle="pink";entityArrays.minionProjectiles.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,2*Math.PI);ctx.fill()});
    ctx.fillStyle = "#FFA500"; 
    entityArrays.companionBullets.forEach(t => { if (!t || isNaN(t.x) || isNaN(t.y)) return; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, 2 * Math.PI); ctx.fill() });
}
// --- INICIO DE LA MODIFICACIÓN ---
// Actualizada la función para dibujar los secuaces con su imagen
function drawMinions() {
    entityArrays.minions.forEach(t => {
        if (!t || isNaN(t.x) || isNaN(t.y)) return;

        if (sprites.minion && sprites.minion.loaded) {
            // Si es kamikaze, le aplicamos un filtro para que se vea rojo y brillante
            if (t.isKamikaze) {
                ctx.filter = 'hue-rotate(180deg) brightness(1.5)';
            }
            ctx.drawImage(sprites.minion, t.x, t.y, t.size, t.size);
            // Reseteamos el filtro para que no afecte a otros elementos
            ctx.filter = 'none';
        } else {
            // Si la imagen no carga, dibujamos un cuadrado como antes
            ctx.fillStyle = t.isKamikaze ? "#FF5733" : ("tank" === t.type ? "#A04040" : "#8B0000");
            ctx.fillRect(t.x, t.y, t.size, t.size);
        }

        // Dibuja la barra de vida para los secuaces tipo 'tank'
        if (t.type === 'tank' && t.health > 0) {
            const e = t.size, a = t.health / t.maxHealth;
            if (isNaN(a)) return;
            ctx.fillStyle = "#333";
            ctx.fillRect(t.x, t.y - 8, e, 4);
            ctx.fillStyle = "red";
            ctx.fillRect(t.x, t.y - 8, e * a, 4);
        }
    });
}
// --- FIN DE LA MODIFICACIÓN ---
function drawExplosions(){entityArrays.explosions.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;ctx.fillStyle=`rgba(255,165,0,${t.alpha})`,ctx.beginPath(),ctx.arc(t.x,t.y,t.radius,0,2*Math.PI),ctx.fill()})}
function drawPowerUps(){entityArrays.powerUps.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;if(sprites.powerUps[t.type]&&sprites.powerUps[t.type].loaded){ctx.drawImage(sprites.powerUps[t.type],t.x,t.y,t.size,t.size)}else{ctx.fillStyle='yellow';ctx.fillRect(t.x,t.y,t.size,t.size)}})}
function drawCompanion() {
    if (!companion || isNaN(companion.x)) return;
    if (sprites.companionDrone && sprites.companionDrone.loaded) {
        ctx.drawImage(sprites.companionDrone, companion.x, companion.y, companion.size, companion.size);
    } else {
        ctx.fillStyle = '#00FFFF'; 
        ctx.fillRect(companion.x, companion.y, companion.size, companion.size);
    }
}
function drawLaser(){if(!player||isNaN(player.x))return;ctx.fillStyle="rgba(255,0,255,0.8)",ctx.fillRect(player.x+player.size/2-5,0,10,player.y),ctx.fillStyle="rgba(255,255,255,0.9)",ctx.fillRect(player.x+player.size/2-2,0,4,player.y)}
function drawStars(){ctx.fillStyle="white",stars.forEach(t=>{if(!t||isNaN(t.x)||isNaN(t.y))return;ctx.fillRect(t.x,t.y,t.size,t.size)})}
function drawTimerCircle(t,e,a,r,s,i,o){const n=(r/s)*2*Math.PI;ctx.beginPath(),ctx.arc(t,e,a,0,2*Math.PI),ctx.strokeStyle="rgba(255,255,255,0.3)",ctx.lineWidth=2,ctx.stroke(),ctx.beginPath(),ctx.moveTo(t,e),ctx.arc(t,e,a,-Math.PI/2,-Math.PI/2+n),ctx.closePath(),ctx.fillStyle=o,ctx.fill(),i&&i.loaded&&(()=>{const r=1.2*a;ctx.drawImage(i,t-r/2,e-r/2,r,r)})()}
function drawUI(){
    if(!isGameOver){ctx.fillStyle="white";ctx.font="18px Arial";ctx.textAlign="left";ctx.fillText(`Puntuación: ${score}`,10,25);ctx.fillText(`Nivel: ${level}`,10,50);ctx.fillText(`Créditos: ${Math.floor(coinsEarnedThisGame)}`,10,75);}
    let t = 110;
    const e = Date.now();
    if (e < player.shieldExpiresAt && sprites.powerUps.shield.loaded) {
        drawTimerCircle(30, t, 15, player.shieldExpiresAt - e, 8000, sprites.powerUps.shield, "rgba(0, 255, 255, 0.7)");
        t += 45;
    }
    if (e < player.tripleShotExpiresAt && sprites.powerUps.tripleShot.loaded) {
        drawTimerCircle(30, t, 15, player.tripleShotExpiresAt - e, 10000, sprites.powerUps.tripleShot, "rgba(255, 165, 0, 0.7)");
        t += 45;
    }
    if (companion && companion.active && sprites.powerUps.companion.loaded) {
        drawTimerCircle(30, t, 15, companion.expiresAt - e, 15000, sprites.powerUps.companion, "rgba(173, 216, 230, 0.7)");
        t += 45;
    }
    if(combo.count>0){ctx.font="22px Arial",ctx.textAlign="center",ctx.fillStyle="rgba(255, 255, 255, 0.5)",ctx.fillText(`${combo.count} COMBO`,canvas.width/2,canvas.height/2+150),ctx.font="bold 26px Arial",ctx.fillStyle="rgba(255, 255, 255, 0.7)",ctx.fillText(`x${combo.multiplier}`,canvas.width/2,canvas.height/2+185)}
}
function initializeHighScores() { if(!localStorage.getItem(HIGH_SCORES_KEY)){const defaultScores=[{name:"ACE_PILOT",score:150000},{name:"VOID_DRIFTER",score:100000},{name:"NOVA_STRIKER",score:75000},{name:"CYGNUS_X1",score:40000},{name:"ROOKIE",score:10000}];localStorage.setItem(HIGH_SCORES_KEY,JSON.stringify(defaultScores))}}
function saveAndShowScores() { isGameOver = true; const playerProgress = getSanitizedPlayerProgress(); playerProgress.currency += Math.floor(coinsEarnedThisGame); localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(playerProgress)); const name = prompt("Fin de la Misión. Registra tu nombre de piloto:", "PILOTO"); try { const highScores = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY)) || []; const newScore = { name: name || "PILOTO", score: score }; highScores.push(newScore); highScores.sort((a, b) => b.score - a.score); highScores.splice(5); localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores)); ui.highscoreList.innerHTML = ''; highScores.forEach(scoreEntry => { const li = document.createElement('li'); li.innerHTML = `<span class="name">${scoreEntry.name}</span> <span class.score">${scoreEntry.score}</span>`; ui.highscoreList.appendChild(li); }); } catch (e) { console.error("Error al procesar las puntuaciones", e); ui.highscoreList.innerHTML = '<li>Error al cargar puntuaciones</li>'; } ui.highscoreTable.style.display = 'block'; }

// --- INICIALIZACIÓN ---
resizeCanvas(); initializeHighScores(); loadAchievements(); createStars();