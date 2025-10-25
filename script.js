const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Variables de Estado del Juego ---
let level, coins, score, isGamePaused, isGameOver, difficultyMultiplier, currentBossIndex;
let stars = [];
let combo = { count: 0, multiplier: 1, timer: 0 };
const entityArrays = {
    bossProjectiles: [], playerBullets: [], explosions: [], minions: [], powerUps: [],
    minionProjectiles: []
};

// --- Sprites y Sonidos ---
function loadImage(src) {
    const img = new Image();
    img.src = src;
    img.loaded = false;
    img.onload = () => { img.loaded = true; };
    img.onerror = () => { console.error(`No se pudo cargar la imagen: ${src}`); };
    return img;
}
const sprites = {
    player: loadImage('assets/nave.png'),
    bosses: [loadImage('assets/Boss1.png'), loadImage('assets/Boss2.png'), loadImage('assets/Boss3.png')],
    powerUps: {
        tripleShot: loadImage('assets/powerup_triple.png'),
        shield: loadImage('assets/powerup_shield.png'),
        bomb: loadImage('assets/powerup_bomb.png')
    }
};
function loadSound(src) {
    const sound = new Audio(src);
    sound.onerror = () => console.error(`No se pudo cargar el sonido: ${src}`);
    return sound;
}
const sounds = {
    shoot: loadSound('assets/hitHurt.wav'),
    explosion: loadSound('assets/explosion.wav')
};

// --- Definiciones de Entidades ---
const playerDefaults = { speed: 5, damage: 10, shootInterval: 450, size: 50 };
let player = {};
let boss = {};
const bosses = [
    { name: "Guardián", sprite: sprites.bosses[0], width: 140, height: 70, attackPattern: 'burst', minionType: 'standard' },
    { name: "Invasor", sprite: sprites.bosses[1], width: 120, height: 80, attackPattern: 'spiral', minionType: 'fast' },
    { name: "Depredador", sprite: sprites.bosses[2], width: 150, height: 60, attackPattern: 'homing', minionType: 'tank' }
];
const backgroundColors = ["#000010", "#100010", "#100500"];

// --- Elementos del DOM ---
const ui = {
    upgradeMenu: document.getElementById('upgrade-menu'), openUpgradeBtn: document.getElementById('upgradeBtn'),
    closeUpgradeBtn: document.getElementById('close-menu-btn'), coinCountSpan: document.getElementById('coin-count'),
    speedStatSpan: document.getElementById('speed-stat'), damageStatSpan: document.getElementById('damage-stat'),
    firerateStatSpan: document.getElementById('firerate-stat'), upgradeSpeedBtn: document.getElementById('upgrade-speed-btn'),
    upgradeDamageBtn: document.getElementById('upgrade-damage-btn'), upgradeFirerateBtn: document.getElementById('upgrade-firerate-btn'),
    highscoreTable: document.getElementById('highscore-table'), highscoreList: document.getElementById('highscore-list'),
    playAgainBtn: document.getElementById('play-again-btn'), startMenu: document.getElementById('start-menu'),
    pauseOverlay: document.getElementById('pause-overlay'),
    specialMeterBar: document.getElementById('special-meter-bar'),
    easyBtn: document.getElementById('easyBtn'), normalBtn: document.getElementById('normalBtn'), hardBtn: document.getElementById('hardBtn'),
    laserBtn: document.getElementById('laserBtn')
};

// --- Lógica de Inicio y Pausa ---
function startGame(difficulty) {
    difficultyMultiplier = difficulty;
    ui.startMenu.style.display = 'none';
    resetGame();
    gameLoop();
}

function togglePause() {
    if (isGameOver || ui.startMenu.style.display === 'block') return;
    isGamePaused = !isGamePaused;
    ui.pauseOverlay.style.display = isGamePaused ? 'block' : 'none';
}

// --- NUEVA FUNCIÓN para abrir/cerrar el menú de mejoras ---
function toggleUpgradeMenu() {
    if (isGameOver || ui.startMenu.style.display === 'block') return;

    const isMenuOpen = ui.upgradeMenu.style.display === 'block';
    if (isMenuOpen) {
        ui.upgradeMenu.style.display = 'none';
        isGamePaused = false;
    } else {
        updateUpgradeUI();
        ui.upgradeMenu.style.display = 'block';
        isGamePaused = true;
    }
}


// --- Lógica del Juego Principal ---
function resetGame() {
    isGameOver = false; isGamePaused = false;
    level = 1; coins = 0; score = 0; currentBossIndex = 0;
    combo = { count: 0, multiplier: 1, timer: 0 };
    player = {
        x: canvas.width / 2 - playerDefaults.size / 2, y: canvas.height - 100,
        health: 100, maxHealth: 100, lastShot: 0,
        shieldExpiresAt: 0, tripleShotExpiresAt: 0, isFiringLaser: false,
        specialMeter: 0, maxSpecial: 100,
        ...playerDefaults
    };
    for (const key in entityArrays) { entityArrays[key].length = 0; }
    increaseSpecialMeter(0);
    ui.laserBtn.style.display = 'none';
    loadNextBoss();
}

function loadNextBoss() {
    const bossData = bosses[currentBossIndex];
    boss = {
        ...bossData,
        x: canvas.width / 2 - bossData.width / 2, y: 50,
        speed: (2 + level * 0.1) * difficultyMultiplier,
        shootInterval: Math.max(200, 1000 - level * 50),
        health: (100 + level * 75) * difficultyMultiplier,
        maxHealth: (100 + level * 75) * difficultyMultiplier,
        lastShot: 0, spiralAngle: 0
    };
    createStars();
}

// --- Game Loop ---
let lastTime = 0;
function gameLoop(timestamp) {
    if (isGameOver) return;
    
    const deltaTime = (timestamp - lastTime) / 1000 || 0;
    lastTime = timestamp;

    if (!isGamePaused) {
        score++;
        update(deltaTime);
        draw();
    }
    requestAnimationFrame(gameLoop);
}

// --- Lógica de Actualización y Dibujo (Funciones Principales) ---
function update(dt) {
    updateStars();
    updatePlayerState(dt);
    movePlayer();
    moveBossTowardPlayer();
    autoShootPlayer();
    shootFromBoss();
    updateMinionShooting();
    updateEntities();
    if(player.isFiringLaser) updateLaser();
}
    
function draw() {
    ctx.fillStyle = backgroundColors[currentBossIndex % backgroundColors.length];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawPlayer();
    if (boss && boss.health > 0) drawBoss();
    drawProjectiles();
    drawMinions();
    drawExplosions();
    drawPowerUps();
    if (player.isFiringLaser) drawLaser();
    drawUI();
}
    
// --- Event Listeners ---
window.addEventListener("resize", resizeCanvas);
ui.openUpgradeBtn.addEventListener('click', toggleUpgradeMenu); // MODIFICADO
ui.closeUpgradeBtn.addEventListener('click', toggleUpgradeMenu); // MODIFICADO
ui.playAgainBtn.addEventListener('click', () => { ui.highscoreTable.style.display = 'none'; ui.startMenu.style.display = 'block'; });

ui.easyBtn.addEventListener('click', () => startGame(0.75));
ui.normalBtn.addEventListener('click', () => startGame(1.0));
ui.hardBtn.addEventListener('click', () => startGame(1.5));
ui.laserBtn.addEventListener('click', fireLaser);

ui.upgradeSpeedBtn.addEventListener('click', () => { const c = 2; if (coins >= c) { player.speed += 0.5; coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });
ui.upgradeDamageBtn.addEventListener('click', () => { const c = 3; if (coins >= c) { player.damage += 5; coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });
ui.upgradeFirerateBtn.addEventListener('click', () => { const c = 4; if (coins >= c) { player.shootInterval = Math.max(50, player.shootInterval - 20); coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });

let direction = null, isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
canvas.addEventListener('touchstart', e => { e.preventDefault(); const t=e.touches[0]; if(player && t.clientX>player.x&&t.clientX<player.x+player.size&&t.clientY>player.y&&t.clientY<player.y+player.size){isDragging=true;dragOffsetX=t.clientX-player.x;dragOffsetY=t.clientY-player.y;}}, {passive:false});
canvas.addEventListener('touchmove', e => { e.preventDefault(); if(isDragging){const t=e.touches[0];player.x=Math.max(0,Math.min(canvas.width-player.size,t.clientX-dragOffsetX));player.y=Math.max(0,Math.min(canvas.height-player.size,t.clientY-dragOffsetY));}}, {passive:false});
canvas.addEventListener('touchend', () => { isDragging = false; });
canvas.addEventListener('mousemove', e => { if (player && !isGamePaused && !isGameOver) { player.x = e.clientX - player.size / 2; player.y = e.clientY - player.size / 2; }});

window.addEventListener("keydown", e => {
    switch(e.key.toLowerCase()){
        case "arrowup":case "w":direction="up";break;
        case "arrowdown":case "s":direction="down";break;
        case "arrowleft":case "a":direction="left";break;
        case "arrowright":case "d":direction="right";break;
        case "p": togglePause(); break;
        case "e": toggleUpgradeMenu(); break; // NUEVO
        case " ": e.preventDefault(); fireLaser(); break;
    }
});
window.addEventListener("keyup", e => {
     switch(e.key.toLowerCase()){case "arrowup":case "w":if(direction==="up")direction=null;break;case "arrowdown":case "s":if(direction==="down")direction=null;break;case "arrowleft":case "a":if(direction==="left")direction=null;break;case "arrowright":case "d":if(direction==="right")direction=null;break;}
});

// --- FUNCIONES DE UTILIDAD Y LÓGICA DE JUEGO DETALLADA ---

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function createStars() { stars = []; for (let i=0; i<100; i++) { stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, size: Math.random()*2+1, speed: Math.random()*1.5+0.5 }); } }
function updateStars() { stars.forEach(s => { s.y+=s.speed; if(s.y>canvas.height){ s.y=0; s.x=Math.random()*canvas.width; } }); }

function movePlayer() {
    if (!player) return;
    // Limitar el movimiento a los bordes del canvas
    if (direction === "up" && player.y > 0) player.y -= player.speed;
    if (direction === "down" && player.y + player.size < canvas.height) player.y += player.speed;
    if (direction === "left" && player.x > 0) player.x -= player.speed;
    if (direction === "right" && player.x + player.size < canvas.width) player.x += player.speed;
}

function autoShootPlayer() {
    if (Date.now() - player.lastShot > player.shootInterval && !player.isFiringLaser) {
        sounds.shoot.currentTime = 0; sounds.shoot.play().catch(()=>{});
        const bulletOffset = player.size / 2;
        const isTriple = Date.now() < player.tripleShotExpiresAt;
        if (isTriple) {
            for(let i = -1; i <= 1; i++) entityArrays.playerBullets.push({ x: player.x + bulletOffset, y: player.y, radius: 6, speed: 8, angle: i * 0.2, active: true });
        } else {
            entityArrays.playerBullets.push({ x: player.x + bulletOffset, y: player.y, radius: 6, speed: 8, angle: 0, active: true });
        }
        player.lastShot = Date.now();
    }
}

function checkPlayerDamage(damage) {
    if (Date.now() < player.shieldExpiresAt) return;
    player.health -= damage;
    if (player.health <= 0 && !isGameOver) saveAndShowScores();
}

function increaseCombo() {
    combo.count++;
    combo.timer = 3;
    combo.multiplier = 1 + Math.floor(combo.count / 5);
}

function updatePlayerState(dt) {
    if (combo.timer > 0) {
        combo.timer -= dt;
        if (combo.timer <= 0) {
            combo.count = 0;
            combo.multiplier = 1;
        }
    }
}

function spawnPowerUp(x, y) {
    const types = ['tripleShot', 'shield', 'bomb'];
    const type = types[Math.floor(Math.random() * types.length)];
    entityArrays.powerUps.push({x, y, type, size: 30, speed: 2, active: true});
}

function activatePowerUp(type) {
    switch(type) {
        case 'tripleShot': player.tripleShotExpiresAt = Date.now() + 10000; break;
        case 'shield': player.shieldExpiresAt = Date.now() + 8000; break;
        case 'bomb': entityArrays.minions.forEach(m => m.active = false); entityArrays.bossProjectiles.forEach(p => p.active = false); entityArrays.minionProjectiles.forEach(p => p.active = false); break;
    }
}

function increaseSpecialMeter(amount) {
    if (player.isFiringLaser) return;
    player.specialMeter = Math.min(player.maxSpecial, player.specialMeter + amount);
    ui.specialMeterBar.style.width = `${(player.specialMeter / player.maxSpecial) * 100}%`;
    if (player.specialMeter >= player.maxSpecial) {
        ui.laserBtn.style.display = 'block';
    }
}

function fireLaser() {
    if (player.specialMeter >= player.maxSpecial && !isGamePaused && !player.isFiringLaser) {
        player.isFiringLaser = true;
        ui.laserBtn.style.display = 'none';
        setTimeout(() => player.isFiringLaser = false, 3000);
    }
}

function updateLaser() {
    player.specialMeter = Math.max(0, player.specialMeter - (player.maxSpecial / (3 * 60)));
    ui.specialMeterBar.style.width = `${(player.specialMeter / player.maxSpecial) * 100}%`;
    const laserRect = { x: player.x + player.size / 2 - 5, y: 0, width: 10, height: player.y };
    
    entityArrays.minions.forEach(enemy => {
         if (enemy.active && laserRect.x < enemy.x + enemy.size && laserRect.x + laserRect.width > enemy.x) {
            enemy.health -= 2;
        }
    });
    if (boss.health > 0 && laserRect.x < boss.x + boss.width && laserRect.x + laserRect.width > boss.x) {
        boss.health -= 2;
    }
}

function moveBossTowardPlayer() {
  if (!boss || boss.health <= 0) return;
  const targetX = player.x + player.size / 2 - boss.width / 2;
  const distance = targetX - boss.x;
  if (Math.abs(distance) > boss.speed) {
      boss.x += Math.sign(distance) * boss.speed;
  }
  boss.x = Math.max(0, Math.min(canvas.width - boss.width, boss.x));
  if (Math.random() < 0.015 && entityArrays.minions.length < 5) spawnMinion();
}

function updateMinionShooting() {
    entityArrays.minions.forEach(m => {
        if (m.active && Date.now() - m.lastShot > m.shootInterval) {
            entityArrays.minionProjectiles.push({ x: m.x + m.size / 2, y: m.y + m.size, radius: 5, speed: 3 * difficultyMultiplier, active: true });
            m.lastShot = Date.now();
        }
    });
}

function shootFromBoss() {
    if (!boss || boss.health <= 0 || Date.now() - boss.lastShot < boss.shootInterval) return;
    boss.lastShot = Date.now();
    const bx = boss.x + boss.width / 2, by = boss.y + boss.height, speed = 4 * difficultyMultiplier;
    switch(boss.attackPattern) {
        case 'burst': for (let i=-1; i<=1; i++) { const a=Math.atan2(player.y-by,player.x+player.size/2-bx)+(i*0.25); entityArrays.bossProjectiles.push({x:bx,y:by,radius:8,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,active:true});} break;
        case 'spiral': for(let i=0; i<4; i++){ const a=boss.spiralAngle+i*(Math.PI/2); entityArrays.bossProjectiles.push({x:bx,y:by,radius:6,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,active:true});} boss.spiralAngle += 0.3; break;
        case 'homing': const a=Math.atan2(player.y-by,player.x+player.size/2-bx); entityArrays.bossProjectiles.push({x:bx,y:by,radius:10,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,active:true, homing: true, homingDuration: Date.now() + 2000}); break;
    }
}

function spawnMinion() {
    const type = boss.minionType;
    let props = {x:Math.random()*(canvas.width-35), y:120, size:25, type, health:10, speedX:2, active:true, lastShot: Date.now(), shootInterval: 3000};
    if(type==='fast'){props.size=20;props.health=5*difficultyMultiplier;props.speedX=4*difficultyMultiplier; props.shootInterval=2500;}
    else if(type==='tank'){props.size=35;props.health=30*difficultyMultiplier;props.speedX=1*difficultyMultiplier; props.shootInterval=4000; props.maxHealth = props.health;}
    else {props.health*=difficultyMultiplier; props.speedX*=difficultyMultiplier;}
    entityArrays.minions.push(props);
}

function updateEntities() {
    function checkCircleRectCollision(circle, rect) {
        let testX = circle.x, testY = circle.y;
        if (circle.x < rect.x) testX = rect.x; else if (circle.x > rect.x + (rect.size||rect.width)) testX = rect.x + (rect.size||rect.width);
        if (circle.y < rect.y) testY = rect.y; else if (circle.y > rect.y + (rect.size||rect.height)) testY = rect.y + (rect.size||rect.height);
        return Math.hypot(circle.x - testX, circle.y - testY) <= circle.radius;
    }

    entityArrays.bossProjectiles.forEach(p=>{ 
        if (p.homing && Date.now() < p.homingDuration && player) {
            const angle = Math.atan2(player.y + player.size / 2 - p.y, player.x + player.size / 2 - p.x);
            const speed = 4 * difficultyMultiplier;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
        }
        p.x+=p.vx; p.y+=p.vy; if(checkCircleRectCollision(p, player)) {checkPlayerDamage(10);p.active=false;} if(p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) p.active = false;});
    
    entityArrays.playerBullets.forEach(b=>{b.x+=Math.sin(b.angle)*b.speed;b.y-=Math.cos(b.angle)*b.speed;if(b.y<-20)b.active=false; if(boss.health > 0 && checkCircleRectCollision(b, boss)){boss.health-=player.damage;b.active=false;increaseSpecialMeter(0.5);} });
    
    entityArrays.minionProjectiles.forEach(p => { p.y += p.speed; if(checkCircleRectCollision(p, player)) {checkPlayerDamage(5);p.active=false;} if(p.y > canvas.height) p.active=false; });

    entityArrays.explosions.forEach(e=>{e.radius+=2;e.alpha-=0.05;if(e.alpha<=0)e.active=false;});
    entityArrays.powerUps.forEach(p=>{p.y+=p.speed; if(player && p.x < player.x+player.size && p.x+p.size > player.x && p.y < player.y+player.size && p.y+p.size > player.y){activatePowerUp(p.type);p.active=false;} if(p.y > canvas.height)p.active=false;});
    entityArrays.minions.forEach(m=>{m.x+=m.speedX; if(m.x<=0||m.x+m.size>=canvas.width)m.speedX*=-1; entityArrays.playerBullets.forEach(b=>{if(b.active && checkCircleRectCollision(b, m)){m.health-=player.damage;b.active=false;increaseSpecialMeter(1);}}); if(m.health<=0){if(m.active){score+=50*combo.multiplier;coins+=0.5;increaseCombo();} m.active=false; if(Math.random()<0.15)spawnPowerUp(m.x,m.y);}});
    
    if (boss.health <= 0) {
        entityArrays.explosions.push({x:boss.x+boss.width/2,y:boss.y+boss.height/2,radius:30,alpha:1,active:true});
        sounds.explosion.currentTime=0;sounds.explosion.play().catch(()=>{});
        coins++; score+=1000*level*combo.multiplier; level++; increaseCombo();
        currentBossIndex = (currentBossIndex + 1) % bosses.length;
        entityArrays.minions.forEach(m => m.active = false);
        entityArrays.bossProjectiles.forEach(p => p.active = false);
        entityArrays.minionProjectiles.forEach(p => p.active = false);
        loadNextBoss();
    }
    for (const key in entityArrays) { entityArrays[key] = entityArrays[key].filter(e => e.active); }
}

// --- FUNCIONES DE DIBUJO ---
function drawPlayer(){if(Date.now()<player.shieldExpiresAt){ctx.fillStyle="rgba(0, 255, 255, 0.3)";ctx.beginPath();ctx.arc(player.x+player.size/2,player.y+player.size/2,player.size/1.5,0,Math.PI*2);ctx.fill();} if(sprites.player.loaded){ctx.drawImage(sprites.player,player.x,player.y,player.size,player.size);}else{ctx.fillStyle='lime';ctx.fillRect(player.x,player.y,player.size,player.size);} const barWidth=player.size,barHeight=6,healthRatio=player.health/player.maxHealth;ctx.fillStyle="#333";ctx.fillRect(player.x,player.y-12,barWidth,barHeight);ctx.fillStyle="#00ff00";ctx.fillRect(player.x,player.y-12,barWidth*healthRatio,barHeight);}
function drawBoss(){if(sprites.bosses[currentBossIndex].loaded){ctx.drawImage(sprites.bosses[currentBossIndex],boss.x,boss.y,boss.width,boss.height);}else{ctx.fillStyle='red';ctx.fillRect(boss.x,boss.y,boss.width,boss.height);} const barWidth=boss.width,barHeight=8,healthRatio=boss.health/boss.maxHealth;ctx.fillStyle="#333";ctx.fillRect(boss.x,boss.y-14,barWidth,barHeight);ctx.fillStyle="#ff0000";ctx.fillRect(boss.x,boss.y-14,barWidth*healthRatio,barHeight);}
function drawProjectiles(){entityArrays.bossProjectiles.forEach(p=>{ctx.fillStyle= (p.homing && Date.now() < p.homingDuration) ? "orange" : "#FF00FF"; ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();});ctx.fillStyle="cyan";entityArrays.playerBullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,Math.PI*2);ctx.fill();});ctx.fillStyle="pink";entityArrays.minionProjectiles.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();});}
function drawMinions(){entityArrays.minions.forEach(m=>{ctx.fillStyle=m.type==='tank'?'#A04040':'#8B0000';ctx.fillRect(m.x,m.y,m.size,m.size); if(m.type==='tank' && m.health>0){const barWidth=m.size;const healthRatio=m.health/m.maxHealth;ctx.fillStyle="#333";ctx.fillRect(m.x,m.y-8,barWidth,4);ctx.fillStyle="red";ctx.fillRect(m.x,m.y-8,barWidth*healthRatio,4);}});}
function drawExplosions(){entityArrays.explosions.forEach(e=>{ctx.fillStyle=`rgba(255,165,0,${e.alpha})`;ctx.beginPath();ctx.arc(e.x,e.y,e.radius,0,Math.PI*2);ctx.fill();});}
function drawPowerUps(){entityArrays.powerUps.forEach(p=>{if(sprites.powerUps[p.type] && sprites.powerUps[p.type].loaded){ctx.drawImage(sprites.powerUps[p.type],p.x,p.y,p.size,p.size)}else{ctx.fillStyle='yellow';ctx.fillRect(p.x,p.y,p.size,p.size)}});}
function drawLaser(){ctx.fillStyle="rgba(255,0,255,0.8)";ctx.fillRect(player.x+player.size/2-5,0,10,player.y);ctx.fillStyle="rgba(255,255,255,0.9)";ctx.fillRect(player.x+player.size/2-2,0,4,player.y);}
function drawStars(){ctx.fillStyle="white"; stars.forEach(s=>ctx.fillRect(s.x,s.y,s.size,s.size));}

function drawTimerCircle(x, y, radius, remaining, duration, sprite, color) {
    const angle = (remaining / duration) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    
    if(sprite && sprite.loaded) {
        const iconSize = radius * 1.2;
        ctx.drawImage(sprite, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
    }
}

function drawUI(){
    ctx.fillStyle="white";ctx.font="18px Arial";ctx.textAlign="left";
    ctx.fillText(`Puntuación: ${score}`,10,25);
    ctx.fillText(`Nivel: ${level}`,10,50);
    ctx.fillText(`Monedas: ${coins.toFixed(1)}`,10,75); 

    let powerUpY = 110;
    const now = Date.now();
    
    if (now < player.shieldExpiresAt) {
        const remaining = player.shieldExpiresAt - now;
        drawTimerCircle(30, powerUpY, 15, remaining, 8000, sprites.powerUps.shield, 'rgba(0, 255, 255, 0.7)');
        powerUpY += 45;
    }
    if (now < player.tripleShotExpiresAt) {
        const remaining = player.tripleShotExpiresAt - now;
        drawTimerCircle(30, powerUpY, 15, remaining, 10000, sprites.powerUps.tripleShot, 'rgba(255, 165, 0, 0.7)');
    }

    if(combo.count > 0){
        ctx.font="22px Arial";ctx.textAlign="center";ctx.fillStyle="rgba(255, 255, 255, 0.5)";
        ctx.fillText(`${combo.count} COMBO`,canvas.width/2,canvas.height/2+150);
        ctx.font="bold 26px Arial";ctx.fillStyle="rgba(255, 255, 255, 0.7)";
        ctx.fillText(`x${combo.multiplier}`,canvas.width/2,canvas.height/2+185);
    }
}

// --- FUNCIONES DE ALMACENAMIENTO Y UI ---
const HIGH_SCORES_KEY = 'aceCraftHighScores';
function initializeHighScores(){if(!localStorage.getItem(HIGH_SCORES_KEY)){const defaultScores=[{name:'ACE_PILOT',score:50000},{name:'VOID_DRIFTER',score:35000},{name:'NOVA_STRIKER',score:20000},{name:'CYGNUS_X1',score:10000},{name:'ROOKIE',score:5000},];localStorage.setItem(HIGH_SCORES_KEY,JSON.stringify(defaultScores));}}
function saveAndShowScores(){isGameOver=true;const name=prompt("Fin del Juego. Introduce tu nombre para la tabla de récords:","PILOTO");const finalScore={name:name||"PILOTO",score:score};const scores=JSON.parse(localStorage.getItem(HIGH_SCORES_KEY));scores.push(finalScore);scores.sort((a,b)=>b.score-a.score);scores.splice(5);localStorage.setItem(HIGH_SCORES_KEY,JSON.stringify(scores));ui.highscoreList.innerHTML='';scores.forEach(s=>{const li=document.createElement('li');li.innerHTML=`<span class="name">${s.name}</span> <span class="score">${s.score}</span>`;ui.highscoreList.appendChild(li);});ui.highscoreTable.style.display='block';}
function updateUpgradeUI() { ui.coinCountSpan.textContent=coins.toFixed(1);ui.speedStatSpan.textContent=`Velocidad Actual: ${player.speed.toFixed(1)}`;ui.damageStatSpan.textContent=`Daño Actual: ${player.damage}`;ui.firerateStatSpan.textContent=`Cadencia Actual: ${player.shootInterval}ms`;}

// --- Inicialización del Juego ---
resizeCanvas();
initializeHighScores();
createStars();
    
