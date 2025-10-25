const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- Variables de Estado del Juego ---
let level, coins, score, isGamePaused, isGameOver, difficultyMultiplier, currentBossIndex;
let lastActiveControl = 'keyboard'; // NUEVO: Para recordar el control antes de pausar
let activeControl = 'keyboard';
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

// --- CORRECCIÓN: Lógica de pausa mejorada ---
function togglePause() {
    if (isGameOver || ui.startMenu.style.display === 'block') return;
    isGamePaused = !isGamePaused;
    ui.pauseOverlay.style.display = isGamePaused ? 'block' : 'none';
    
    if (isGamePaused) {
        lastActiveControl = activeControl; // Guardar el control actual
        activeControl = 'none'; // Desactivar todo control
    } else {
        activeControl = lastActiveControl; // Restaurar el control
    }
}

function toggleUpgradeMenu() {
    if (isGameOver || ui.startMenu.style.display === 'block') return;
    const isMenuOpen = ui.upgradeMenu.style.display === 'block';
    if (isMenuOpen) {
        ui.upgradeMenu.style.display = 'none';
        isGamePaused = false;
        activeControl = lastActiveControl; // Restaurar
    } else {
        updateUpgradeUI();
        ui.upgradeMenu.style.display = 'block';
        isGamePaused = true;
        lastActiveControl = activeControl; // Guardar
        activeControl = 'none'; // Desactivar
    }
}

// --- Lógica del Juego Principal ---
function resetGame() {
    isGameOver = false; isGamePaused = false;
    level = 1; coins = 0; score = 0; currentBossIndex = 0;
    activeControl = 'keyboard'; lastActiveControl = 'keyboard';
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
    boss = { ...bossData, x: canvas.width/2 - bossData.width/2, y: 50, speed: (2+level*0.1)*difficultyMultiplier, shootInterval: Math.max(200, 1000-level*50), health: (100+level*75)*difficultyMultiplier, maxHealth: (100+level*75)*difficultyMultiplier, lastShot:0, spiralAngle:0 };
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

function update(dt) {
    updateStars();
    updatePlayerState(dt);
    handleControls();
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
ui.openUpgradeBtn.addEventListener('click', toggleUpgradeMenu);
ui.closeUpgradeBtn.addEventListener('click', toggleUpgradeMenu);
ui.playAgainBtn.addEventListener('click', () => { ui.highscoreTable.style.display = 'none'; ui.startMenu.style.display = 'block'; });
ui.easyBtn.addEventListener('click', () => startGame(0.75));
ui.normalBtn.addEventListener('click', () => startGame(1.0));
ui.hardBtn.addEventListener('click', () => startGame(1.5));
ui.laserBtn.addEventListener('click', fireLaser);
ui.upgradeSpeedBtn.addEventListener('click', () => { const c = 2; if (coins >= c) { player.speed += 0.5; coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });
ui.upgradeDamageBtn.addEventListener('click', () => { const c = 3; if (coins >= c) { player.damage += 5; coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });
ui.upgradeFirerateBtn.addEventListener('click', () => { const c = 4; if (coins >= c) { player.shootInterval = Math.max(50, player.shootInterval - 20); coins -= c; updateUpgradeUI(); } else { alert("Monedas insuficientes."); } });

let direction = null, isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
const mousePos = { x: 0, y: 0 };

canvas.addEventListener('touchstart', e => { e.preventDefault(); if(!isGamePaused){activeControl = 'touch';} const t=e.touches[0]; if(player && t.clientX>player.x&&t.clientX<player.x+player.size&&t.clientY>player.y&&t.clientY<player.y+player.size){isDragging=true;dragOffsetX=t.clientX-player.x;dragOffsetY=t.clientY-player.y;}}, {passive:false});
canvas.addEventListener('touchmove', e => { e.preventDefault(); if(isDragging){const t=e.touches[0];player.x=Math.max(0,Math.min(canvas.width-player.size,t.clientX-dragOffsetX));player.y=Math.max(0,Math.min(canvas.height-player.size,t.clientY-dragOffsetY));}}, {passive:false});
canvas.addEventListener('touchend', () => { isDragging = false; });

canvas.addEventListener('mousemove', e => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
    if (!isGamePaused) {
        if (activeControl !== 'keyboard') { // No activar el ratón si se están usando las teclas
             activeControl = 'mouse';
        }
    }
});

window.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    if (["arrowup", "w", "arrowdown", "s", "arrowleft", "a", "arrowright", "d"].includes(key)) {
        if (!isGamePaused) activeControl = 'keyboard';
    }
    switch(key){
        case "arrowup":case "w":direction="up";break;
        case "arrowdown":case "s":direction="down";break;
        case "arrowleft":case "a":direction="left";break;
        case "arrowright":case "d":direction="right";break;
        case "p": togglePause(); break;
        case "e": toggleUpgradeMenu(); break;
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

function handleControls() {
    if (!player || activeControl === 'none') return;
    if (activeControl === 'keyboard') {
        if (direction === "up" && player.y > 0) player.y -= player.speed;
        if (direction === "down" && player.y + player.size < canvas.height) player.y += player.speed;
        if (direction === "left" && player.x > 0) player.x -= player.speed;
        if (direction === "right" && player.x + player.size < canvas.width) player.x += player.speed;
    } else if (activeControl === 'mouse') {
        player.x = mousePos.x - player.size / 2;
        player.y = mousePos.y - player.size / 2;
    }
}

function autoShootPlayer(){if(Date.now()-player.lastShot>player.shootInterval&&!player.isFiringLaser){sounds.shoot.currentTime=0;sounds.shoot.play().catch(()=>{});const t=player.size/2,e=Date.now()<player.tripleShotExpiresAt;if(e)for(let a=-1;a<=1;a++)entityArrays.playerBullets.push({x:player.x+t,y:player.y,radius:6,speed:8,angle:.2*a,active:!0});else entityArrays.playerBullets.push({x:player.x+t,y:player.y,radius:6,speed:8,angle:0,active:!0});player.lastShot=Date.now()}}
function checkPlayerDamage(t){if(!(Date.now()<player.shieldExpiresAt)){player.health-=t,player.health<=0&&!isGameOver&&saveAndShowScores()}}
function increaseCombo(){combo.count++,combo.timer=3,combo.multiplier=1+Math.floor(combo.count/5)}
function updatePlayerState(t){combo.timer>0&&(combo.timer-=t,combo.timer<=0&&(combo.count=0,combo.multiplier=1))}
function spawnPowerUp(t,e){const a=["tripleShot","shield","bomb"],r=a[Math.floor(Math.random()*a.length)];entityArrays.powerUps.push({x:t,y:e,type:r,size:30,speed:2,active:!0})}
function activatePowerUp(t){switch(t){case"tripleShot":player.tripleShotExpiresAt=Date.now()+1e4;break;case"shield":player.shieldExpiresAt=Date.now()+8e3;break;case"bomb":entityArrays.minions.forEach(t=>t.active=!1),entityArrays.bossProjectiles.forEach(t=>t.active=!1),entityArrays.minionProjectiles.forEach(t=>t.active=!1)}}
function increaseSpecialMeter(t){player.isFiringLaser||(player.specialMeter=Math.min(player.maxSpecial,player.specialMeter+t),ui.specialMeterBar.style.width=`${player.specialMeter/player.maxSpecial*100}%`,player.specialMeter>=player.maxSpecial&&(ui.laserBtn.style.display="block"))}
function fireLaser(){player.specialMeter>=player.maxSpecial&&!isGamePaused&&!player.isFiringLaser&&(player.isFiringLaser=!0,ui.laserBtn.style.display="none",setTimeout(()=>{player.isFiringLaser=!1},3e3))}
function updateLaser(){player.specialMeter=Math.max(0,player.specialMeter-player.maxSpecial/180),ui.specialMeterBar.style.width=`${player.specialMeter/player.maxSpecial*100}%`;const t={x:player.x+player.size/2-5,y:0,width:10,height:player.y};entityArrays.minions.forEach(e=>{e.active&&t.x<e.x+e.size&&t.x+t.width>e.x&&(e.health-=2)}),boss.health>0&&t.x<boss.x+boss.width&&t.x+t.width>boss.x&&(boss.health-=2)}
function moveBossTowardPlayer(){if(boss&&!(boss.health<=0)){const t=player.x+player.size/2-boss.width/2,e=t-boss.x;Math.abs(e)>boss.speed&&(boss.x+=Math.sign(e)*boss.speed),boss.x=Math.max(0,Math.min(canvas.width-boss.width,boss.x)),Math.random()<.015&&entityArrays.minions.length<5&&spawnMinion()}}
function updateMinionShooting(){entityArrays.minions.forEach(t=>{t.active&&Date.now()-t.lastShot>t.shootInterval&&(entityArrays.minionProjectiles.push({x:t.x+t.size/2,y:t.y+t.size,radius:5,speed:3*difficultyMultiplier,active:!0}),t.lastShot=Date.now())})}
function shootFromBoss(){if(boss&&!(boss.health<=0)&&!(Date.now()-boss.lastShot<boss.shootInterval)){boss.lastShot=Date.now();const t=boss.x+boss.width/2,e=boss.y+boss.height,a=4*difficultyMultiplier;switch(boss.attackPattern){case"burst":for(let r=-1;r<=1;r++){const s=Math.atan2(player.y-e,player.x+player.size/2-t)+.25*r;entityArrays.bossProjectiles.push({x:t,y:e,radius:8,vx:Math.cos(s)*a,vy:Math.sin(s)*a,active:!0})}break;case"spiral":for(let r=0;r<4;r++){const s=boss.spiralAngle+r*(Math.PI/2);entityArrays.bossProjectiles.push({x:t,y:e,radius:6,vx:Math.cos(s)*a,vy:Math.sin(s)*a,active:!0})}boss.spiralAngle+=.3;break;case"homing":const r=Math.atan2(player.y-e,player.x+player.size/2-t);entityArrays.bossProjectiles.push({x:t,y:e,radius:10,vx:Math.cos(r)*a,vy:Math.sin(r)*a,active:!0,homing:!0,homingDuration:Date.now()+2e3})}}}
function spawnMinion(){const t=boss.minionType;let e={x:Math.random()*(canvas.width-35),y:120,size:25,type:t,health:10,speedX:2,active:!0,lastShot:Date.now(),shootInterval:3e3};"fast"===t?(e.size=20,e.health=5*difficultyMultiplier,e.speedX=4*difficultyMultiplier,e.shootInterval=2500):"tank"===t?(e.size=35,e.health=30*difficultyMultiplier,e.speedX=1*difficultyMultiplier,e.shootInterval=4e3,e.maxHealth=e.health):(e.health*=difficultyMultiplier,e.speedX*=difficultyMultiplier),entityArrays.minions.push(e)}
function updateEntities(){function t(t,e){let a=t.x,r=t.y;return t.x<e.x?a=e.x:t.x>e.x+(e.size||e.width)&&(a=e.x+(e.size||e.width)),t.y<e.y?r=e.y:t.y>e.y+(e.size||e.height)&&(r=e.y+(e.size||e.height)),Math.hypot(t.x-a,t.y-r)<=t.radius}entityArrays.bossProjectiles.forEach(e=>{e.homing&&Date.now()<e.homingDuration&&player&&(()=>{const t=Math.atan2(player.y+player.size/2-e.y,player.x+player.size/2-e.x),a=4*difficultyMultiplier;e.vx=Math.cos(t)*a,e.vy=Math.sin(t)*a})(),e.x+=e.vx,e.y+=e.vy,t(e,player)&&(checkPlayerDamage(10),e.active=!1),(e.y>canvas.height+20||e.x<-20||e.x>canvas.width+20)&&(e.active=!1)}),entityArrays.playerBullets.forEach(e=>{e.x+=Math.sin(e.angle)*e.speed,e.y-=Math.cos(e.angle)*e.speed,e.y<-20&&(e.active=!1),boss.health>0&&t(e,boss)&&(boss.health-=player.damage,e.active=!1,increaseSpecialMeter(.5))}),entityArrays.minionProjectiles.forEach(e=>{e.y+=e.speed,t(e,player)&&(checkPlayerDamage(5),e.active=!1),e.y>canvas.height&&(e.active=!1)}),entityArrays.explosions.forEach(t=>{t.radius+=2,t.alpha-=.05,t.alpha<=0&&(t.active=!1)}),entityArrays.powerUps.forEach(t=>{t.y+=t.speed,player&&t.x<player.x+player.size&&t.x+t.size>player.x&&t.y<player.y+player.size&&t.y+t.size>player.y&&(activatePowerUp(t.type),t.active=!1),t.y>canvas.height&&(t.active=!1)}),entityArrays.minions.forEach(e=>{e.x+=e.speedX,(e.x<=0||e.x+e.size>=canvas.width)&&(e.speedX*=-1),entityArrays.playerBullets.forEach(a=>{a.active&&t(a,e)&&(e.health-=player.damage,a.active=!1,increaseSpecialMeter(1))}),e.health<=0&&(e.active&&(score+=50*combo.multiplier,coins+=.5,increaseCombo()),e.active=!1,Math.random()<.15&&spawnPowerUp(e.x,e.y))}),boss.health<=0&&(entityArrays.explosions.push({x:boss.x+boss.width/2,y:boss.y+boss.height/2,radius:30,alpha:1,active:!0}),sounds.explosion.currentTime=0,sounds.explosion.play().catch(()=>{}),coins++,score+=1e3*level*combo.multiplier,level++,increaseCombo(),currentBossIndex=(currentBossIndex+1)%bosses.length,entityArrays.minions.forEach(t=>t.active=!1),entityArrays.bossProjectiles.forEach(t=>t.active=!1),entityArrays.minionProjectiles.forEach(t=>t.active=!1),loadNextBoss());for(const a in entityArrays)entityArrays[a]=entityArrays[a].filter(t=>t.active)}
function drawPlayer(){if(Date.now()<player.shieldExpiresAt){ctx.fillStyle="rgba(0, 255, 255, 0.3)";ctx.beginPath();ctx.arc(player.x+player.size/2,player.y+player.size/2,player.size/1.5,0,2*Math.PI);ctx.fill();} sprites.player.loaded?ctx.drawImage(sprites.player,player.x,player.y,player.size,player.size):[ctx.fillStyle="lime",ctx.fillRect(player.x,player.y,player.size,player.size)];const t=player.size,e=6,a=player.health/player.maxHealth;ctx.fillStyle="#333",ctx.fillRect(player.x,player.y-12,t,e),ctx.fillStyle="#00ff00",ctx.fillRect(player.x,player.y-12,t*a,e)}
function drawBoss(){sprites.bosses[currentBossIndex].loaded?ctx.drawImage(sprites.bosses[currentBossIndex],boss.x,boss.y,boss.width,boss.height):[ctx.fillStyle="red",ctx.fillRect(boss.x,boss.y,boss.width,boss.height)];const t=boss.width,e=8,a=boss.health/boss.maxHealth;ctx.fillStyle="#333",ctx.fillRect(boss.x,boss.y-14,t,e),ctx.fillStyle="#ff0000",ctx.fillRect(boss.x,boss.y-14,t*a,e)}
function drawProjectiles(){entityArrays.bossProjectiles.forEach(t=>{ctx.fillStyle=t.homing&&Date.now()<t.homingDuration?"orange":"#FF00FF",ctx.beginPath(),ctx.arc(t.x,t.y,t.radius,0,2*Math.PI),ctx.fill()}),ctx.fillStyle="cyan",entityArrays.playerBullets.forEach(t=>{ctx.beginPath(),ctx.arc(t.x,t.y,t.radius,0,2*Math.PI),ctx.fill()}),ctx.fillStyle="pink",entityArrays.minionProjectiles.forEach(t=>{ctx.beginPath(),ctx.arc(t.x,t.y,t.radius,0,2*Math.PI),ctx.fill()})}
function drawMinions(){entityArrays.minions.forEach(t=>{ctx.fillStyle="tank"===t.type?"#A04040":"#8B0000",ctx.fillRect(t.x,t.y,t.size,t.size),"tank"===t.type&&t.health>0&&(()=>{const e=t.size,a=t.health/t.maxHealth;ctx.fillStyle="#333",ctx.fillRect(t.x,t.y-8,e,4),ctx.fillStyle="red",ctx.fillRect(t.x,t.y-8,e*a,4)})()})}
function drawExplosions(){entityArrays.explosions.forEach(t=>{ctx.fillStyle=`rgba(255,165,0,${t.alpha})`,ctx.beginPath(),ctx.arc(t.x,t.y,t.radius,0,2*Math.PI),ctx.fill()})}
function drawPowerUps(){entityArrays.powerUps.forEach(t=>{sprites.powerUps[t.type]&&sprites.powerUps[t.type].loaded?ctx.drawImage(sprites.powerUps[t.type],t.x,t.y,t.size,t.size):[ctx.fillStyle="yellow",ctx.fillRect(t.x,t.y,t.size,t.size)]})}
function drawLaser(){ctx.fillStyle="rgba(255,0,255,0.8)",ctx.fillRect(player.x+player.size/2-5,0,10,player.y),ctx.fillStyle="rgba(255,255,255,0.9)",ctx.fillRect(player.x+player.size/2-2,0,4,player.y)}
function drawStars(){ctx.fillStyle="white",stars.forEach(t=>ctx.fillRect(t.x,t.y,t.size,t.size))}
function drawTimerCircle(t,e,a,r,s,i,o){const n=(r/s)*2*Math.PI;ctx.beginPath(),ctx.arc(t,e,a,0,2*Math.PI),ctx.strokeStyle="rgba(255,255,255,0.3)",ctx.lineWidth=2,ctx.stroke(),ctx.beginPath(),ctx.moveTo(t,e),ctx.arc(t,e,a,-Math.PI/2,-Math.PI/2+n),ctx.closePath(),ctx.fillStyle=o,ctx.fill(),i&&i.loaded&&(()=>{const r=1.2*a;ctx.drawImage(i,t-r/2,e-r/2,r,r)})()}
function drawUI(){ctx.fillStyle="white",ctx.font="18px Arial",ctx.textAlign="left",ctx.fillText(`Puntuación: ${score}`,10,25),ctx.fillText(`Nivel: ${level}`,10,50),ctx.fillText(`Monedas: ${coins.toFixed(1)}`,10,75);let t=110;const e=Date.now();e<player.shieldExpiresAt&&sprites.powerUps.shield.loaded&&(drawTimerCircle(30,t,15,player.shieldExpiresAt-e,8e3,sprites.powerUps.shield,"rgba(0, 255, 255, 0.7)"),t+=45),e<player.tripleShotExpiresAt&&sprites.powerUps.tripleShot.loaded&&drawTimerCircle(30,t,15,player.tripleShotExpiresAt-e,1e4,sprites.powerUps.tripleShot,"rgba(255, 165, 0, 0.7)"),combo.count>0&&(ctx.font="22px Arial",ctx.textAlign="center",ctx.fillStyle="rgba(255, 255, 255, 0.5)",ctx.fillText(`${combo.count} COMBO`,canvas.width/2,canvas.height/2+150),ctx.font="bold 26px Arial",ctx.fillStyle="rgba(255, 255, 255, 0.7)",ctx.fillText(`x${combo.multiplier}`,canvas.width/2,canvas.height/2+185))}
const HIGH_SCORES_KEY="aceCraftHighScores";function initializeHighScores(){localStorage.getItem(HIGH_SCORES_KEY)||localStorage.setItem(HIGH_SCORES_KEY,JSON.stringify([{name:"ACE_PILOT",score:5e4},{name:"VOID_DRIFTER",score:35e3},{name:"NOVA_STRIKER",score:2e4},{name:"CYGNUS_X1",score:1e4},{name:"ROOKIE",score:5e3}]))}
function saveAndShowScores(){isGameOver=!0;const t=prompt("Fin del Juego. Introduce tu nombre para la tabla de récords:","PILOTO"),e={name:t||"PILOTO",score:score},a=JSON.parse(localStorage.getItem(HIGH_SCORES_KEY));a.push(e),a.sort((t,e)=>e.score-t.score),a.splice(5),localStorage.setItem(HIGH_SCORES_KEY,JSON.stringify(a)),ui.highscoreList.innerHTML="",a.forEach(t=>{const e=document.createElement("li");e.innerHTML=`<span class="name">${t.name}</span> <span class="score">${t.score}</span>`,ui.highscoreList.appendChild(e)}),ui.highscoreTable.style.display="block"}
function updateUpgradeUI(){ui.coinCountSpan.textContent=coins.toFixed(1),ui.speedStatSpan.textContent=`Velocidad Actual: ${player.speed.toFixed(1)}`,ui.damageStatSpan.textContent=`Daño Actual: ${player.damage}`,ui.firerateStatSpan.textContent=`Cadencia Actual: ${player.shootInterval}ms`}

// --- Inicialización del Juego ---
resizeCanvas();
initializeHighScores();
createStars();
    
