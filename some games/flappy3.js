// Flappy Adventure prototype (flappy3.js)
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Game states
  const STATE = {MENU:0, PLAYING:1, SHOP:2, LEVEL_SELECT:3, BOSS:4, HARDCORE:5};
  let state = STATE.MENU;

  // Persistent data
  const storage = {
    coins: Number(localStorage.getItem('fl_coins')||0),
    streak: Number(localStorage.getItem('fl_streak')||0),
    bestStreak: Number(localStorage.getItem('fl_bestStreak')||0),
    skins: JSON.parse(localStorage.getItem('fl_skins')||'[]'),
    purchases: JSON.parse(localStorage.getItem('fl_purchases')||'{}'),
    unlockedLevels: JSON.parse(localStorage.getItem('fl_unlocked')||'[1]'), // levels unlocked by id
    mapMultiplier: Number(localStorage.getItem('fl_mapMult')||1)
  };

  function save(){ localStorage.setItem('fl_coins', storage.coins); localStorage.setItem('fl_streak', storage.streak);
    localStorage.setItem('fl_bestStreak', storage.bestStreak); localStorage.setItem('fl_skins', JSON.stringify(storage.skins));
    localStorage.setItem('fl_purchases', JSON.stringify(storage.purchases)); localStorage.setItem('fl_unlocked', JSON.stringify(storage.unlockedLevels));
    localStorage.setItem('fl_mapMult', storage.mapMultiplier);
  }

  // UI refs
  const coinsEl = document.getElementById('coins'); const streakEl = document.getElementById('streak');
  const scoreEl = document.getElementById('score'); const levelEl = document.getElementById('level');
  const panel = document.getElementById('panel-content'); const menu = document.getElementById('menu');

  function updateUI(){ coinsEl.textContent = storage.coins; streakEl.textContent = storage.streak; }
  updateUI();

  // Levels config
  const levels = [
    null,
    // level 1: much longer (50 pipes) and longer spacing between pipes; reward 50 coins on completion
    {id:1, pipeSpeed:2.2, gap:140, pipeFreq:2200, length:50, bossHP:30, reward:50},
    {id:2, pipeSpeed:2.8, gap:120, pipeFreq:1200, length:10, bossHP:50, reward:200},
    {id:3, pipeSpeed:3.4, gap:100, pipeFreq:1000, length:12, bossHP:80, reward:400}
  ];

  let currentLevel = 1;
  let hardcoreMode = false; // when true, game becomes endless and awards 4 coins per pipe

  // Player
  const player = {x:80,y:H/2,vy:0,r:18,alive:true,skin:null,canShoot:false};
  // reduce flap strength so jump height is lower
  const gravity = 0.45; const flap = -6;

  // Game variables
  let pipes = [], coins = [], score=0, lastPipe=0, pipeCount=0, lastTime=0, running=false, paused=false;

  // Boss
  let boss = null; // {hp,x,y,w,h,lastFire}

  // Shop pricing
  function price(key, base){ const bought = Number(storage.purchases[key]||0); return Math.ceil(base * Math.pow(1.25, bought)); }

  // Crate logic
  function openCrate(type){ // returns reward object
    // rarities: common 70, rare 25, epic 5
    const roll = Math.random()*100; let rarity='common'; if(roll>95) rarity='epic'; else if(roll>70) rarity='rare';
    if(type==='skin'){ // skin ids
      const id = `skin_${rarity}_${Math.floor(Math.random()*1000)}`;
      storage.skins.push({id,rarity}); storage.purchases['skin']=(Number(storage.purchases['skin']||0)+1);
      save(); updateUI(); return {type:'skin',id,rarity};
    } else { // map crate: increase coin multiplier or direct coins
      storage.purchases['map']=(Number(storage.purchases['map']||0)+1);
      if(rarity==='epic'){ storage.mapMultiplier += 0.3; save(); updateUI(); return {type:'map',effect:'+30% coins',rarity}; }
      if(rarity==='rare'){ storage.mapMultiplier += 0.12; save(); updateUI(); return {type:'map',effect:'+12% coins',rarity}; }
      storage.mapMultiplier += 0.04; save(); updateUI(); return {type:'map',effect:'+4% coins',rarity};
    }
  }

  // menu buttons
  document.getElementById('btn-play').addEventListener('click', ()=> startLevel(1));
  document.getElementById('btn-shop').addEventListener('click', showShop);
  document.getElementById('btn-levels').addEventListener('click', showLevels);
  const hardcoreBtn = document.getElementById('btn-hardcore');
  if(hardcoreBtn) hardcoreBtn.addEventListener('click', startHardcore);
  document.getElementById('btn-streak').addEventListener('click', ()=> alert(`Streak: ${storage.streak}\nBest: ${storage.bestStreak}`));

  function showShop(){ menu.style.display='none'; panel.innerHTML = '';
  const tpl = document.getElementById('shop-template').content.cloneNode(true);
  // add a back button to return to the main menu
  const backBtn = document.createElement('button'); backBtn.textContent = 'Back to Menu'; backBtn.className = 'small';
  backBtn.style.marginTop = '8px';
  backBtn.addEventListener('click', ()=>{ panel.innerHTML=''; menu.style.display='block'; state = STATE.MENU; });
  panel.appendChild(backBtn);
    panel.appendChild(tpl);
    const skinPriceEl = panel.querySelector('#skinPrice'); const mapPriceEl = panel.querySelector('#mapPrice');
    function refreshPrices(){ skinPriceEl.textContent = price('skin', 100); mapPriceEl.textContent = price('map', 150); }
    refreshPrices();
    panel.querySelector('#buySkin').addEventListener('click', ()=>{
  const cost = price('skin',100); if(storage.coins < cost){ alert('Not enough coins'); return; }
  function showInGameMenu(){
    if(state !== STATE.PLAYING && state !== STATE.BOSS) return;
    paused = true;
    panel.innerHTML = '';
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>Game Menu</h3>
      <p>Your progress will be deleted if you return to the main menu.</p>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button id="ig-return">Return to Menu</button>
        <button id="ig-restart">Restart Level</button>
        <button id="ig-cancel">Cancel</button>
      </div>
    `;
    panel.appendChild(div);
    // handlers
    panel.querySelector('#ig-return').addEventListener('click', ()=>{
      const ok = confirm('Your progress will be deleted, continue?');
      if(!ok) return;
  // discard current run progress
  running = false; player.alive = false; score = 0; updateScore(); storage.streak = 0; save(); hardcoreMode = false;
  panel.innerHTML = ''; menu.style.display = 'block'; state = STATE.MENU; paused = false;
    });
    panel.querySelector('#ig-restart').addEventListener('click', ()=>{
      resetGame(levels[currentLevel]); paused = false; state = STATE.PLAYING; panel.innerHTML='';
    });
    panel.querySelector('#ig-cancel').addEventListener('click', ()=>{ paused = false; panel.innerHTML=''; state = STATE.PLAYING; });
  }
      storage.coins -= cost; save(); updateUI(); const reward = openCrate('skin'); alert(`You opened a ${reward.rarity} skin: ${reward.id}`); refreshPrices(); renderSkins();
    });
    panel.querySelector('#buyMap').addEventListener('click', ()=>{
      const cost = price('map',150); if(storage.coins < cost){ alert('Not enough coins'); return; }
      storage.coins -= cost; save(); updateUI(); const reward = openCrate('map'); alert(`You opened a ${reward.rarity} map crate: ${reward.effect}`); refreshPrices();
    });
    renderSkins(); state = STATE.SHOP; }

  function renderSkins(){ const list = panel.querySelector('#skinsList'); if(!list) return; list.innerHTML = '';
    storage.skins.forEach(s=>{ const d = document.createElement('div'); d.className='badge'; d.textContent = `${s.rarity} — ${s.id}`; list.appendChild(d); }); }

  function showLevels(){ menu.style.display='none'; panel.innerHTML='';
    const div = document.createElement('div'); div.innerHTML = '<h3>Levels</h3>';
    levels.forEach(l=>{ if(!l) return; const b = document.createElement('button'); b.textContent = `Level ${l.id} ${storage.unlockedLevels.includes(l.id)?'Unlocked':'Locked'}`; b.disabled=!storage.unlockedLevels.includes(l.id); b.addEventListener('click', ()=> startLevel(l.id)); div.appendChild(b); });
    panel.appendChild(div); state = STATE.LEVEL_SELECT; }

  function startLevel(id){ hardcoreMode = false; currentLevel = id; levelEl.textContent = id; resetGame(levels[id]); menu.style.display='none'; panel.innerHTML=''; state = STATE.PLAYING; }

  function startHardcore(){ // endless, harder mode: higher rewards per pipe
    hardcoreMode = true;
    currentLevel = 1; // use level 1 parameters as base
    levelEl.textContent = 'HC';
    // small difficulty tweak: increase base pipe speed and reduce gap slightly for challenge
    levels[1] = Object.assign({}, levels[1]); // shallow copy
    levels[1].pipeSpeed = levels[1].pipeSpeed * 1.3;
    levels[1].gap = Math.max(80, levels[1].gap - 20);
    resetGame(levels[1]); menu.style.display='none'; panel.innerHTML=''; state = STATE.HARDCORE;
  }

  function resetGame(level){ pipes=[]; coins=[]; score=0; lastPipe=0; pipeCount=0; player.y = H/2; player.vy=0; player.alive=true; player.canShoot=false; running=true; paused=false; boss=null; updateUI(); updateScore(); }

  function updateScore(){ scoreEl.textContent = score; }

  // Game loop
  let last = performance.now();
  function loop(now){ const dt = now - last; last = now; if((state===STATE.PLAYING || state===STATE.HARDCORE) && !paused){ step(dt); } render(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  function step(dt){ // spawn pipes
    const lvl = levels[currentLevel];
    lastPipe += dt;
    // in hardcore mode the level is endless; otherwise spawn until level length
    if((!hardcoreMode && pipeCount < lvl.length && lastPipe > lvl.pipeFreq) || (hardcoreMode && lastPipe > lvl.pipeFreq)){
      spawnPipe(lvl); lastPipe = 0; pipeCount++; }
    // update pipes
    for(let i=pipes.length-1;i>=0;i--){ pipes[i].x -= lvl.pipeSpeed; if(pipes[i].x + pipes[i].w < 0) pipes.splice(i,1); }
    // update coins (floating) - not used separate
    // player physics
    player.vy += gravity; player.y += player.vy; if(player.y < 0) { die(); }
    if(player.y > H){ die(); }
    // collisions with pipes
  for(const p of pipes){ if(collisionPipe(p, player)){ die(); } else if(!p.passed && p.x + p.w < player.x){ p.passed=true; score++; // reward coin per point
    const basePerPipe = hardcoreMode ? 2 : 1;
    const awarded = Math.ceil(basePerPipe * storage.mapMultiplier); storage.coins += awarded; updateUI(); save(); }
    }
  // if not hardcore and all pipes passed -> start boss
  if(!hardcoreMode && pipeCount >= lvl.length && pipes.length===0 && !boss){ startBoss(levels[currentLevel]); }
    // boss update
    if(boss){ updateBoss(dt); }
  }

  function spawnPipe(lvl){ const w = 80; const gap = lvl.gap; const top = Math.random()*(H-gap-120)+60; pipes.push({x:W, y:0, w, h:top, gap, passed:false}); pipes.push({x:W, y:top+gap, w, h:H-(top+gap), passed:false, bottom:true}); }

  function collisionPipe(p, pl){ // simple AABB for top/bottom pipes
    if(p.bottom){ const rect = {x:p.x,y:p.y,w:p.w,h:p.h}; if(rect.x < pl.x+pl.r && rect.x+rect.w > pl.x-pl.r && rect.y < pl.y+pl.r && rect.y+rect.h > pl.y-pl.r) return true; }
    else{ const rect = {x:p.x,y:p.y,w:p.w,h:p.h}; if(rect.x < pl.x+pl.r && rect.x+rect.w > pl.x-pl.r && rect.y < pl.y+pl.r && rect.y+rect.h > pl.y-pl.r) return true; }
    return false;
  }

  function die(){ if(!player.alive) return; player.alive=false; running=false; storage.streak=0; if(storage.bestStreak < storage.streak) storage.bestStreak = storage.streak; save(); updateUI(); alert('You died! Streak reset.'); hardcoreMode = false; state = STATE.MENU; menu.style.display='block'; }
  function die(){ if(!player.alive) return; player.alive=false; running=false; // update best streak then reset
    if(storage.streak > storage.bestStreak) storage.bestStreak = storage.streak;
    storage.streak = 0; save(); updateUI(); alert('You died! Streak reset.'); hardcoreMode = false; state = STATE.MENU; menu.style.display='block'; }

  // Boss mechanics
  function startBoss(lvl){ boss = {hp:lvl.bossHP, x:W-160, y:H/2, w:140, h:140, lastFire:0}; player.canShoot=true; player.x = 140; // freeze x roughly
    state = STATE.BOSS; }

  function updateBoss(dt){ // boss shoots fireballs
    boss.lastFire += dt; if(boss.lastFire > 1200){ boss.lastFire = 0; spawnFire(); }
  }

  const bullets = []; const fireballs = [];

  function spawnFire(){ fireballs.push({x:boss.x, y:boss.y + (Math.random()*boss.h - boss.h/2), vx:-5 - Math.random()*3}); }

  function updateBullets(dt){ for(let i=bullets.length-1;i>=0;i--){ bullets[i].x += bullets[i].vx; if(bullets[i].x > W){ bullets.splice(i,1); continue; } // hit boss
      if(bullets[i].x > boss.x && bullets[i].x < boss.x + boss.w && Math.abs(bullets[i].y - boss.y) < boss.h/2){ boss.hp -= bullets[i].d; bullets.splice(i,1); if(boss.hp <=0) bossDefeated(); }
    } for(let i=fireballs.length-1;i>=0;i--){ fireballs[i].x += fireballs[i].vx; if(fireballs[i].x < 0) fireballs.splice(i,1); if(Math.abs(fireballs[i].x - player.x) < 20 && Math.abs(fireballs[i].y - player.y) < 20){ // instant death
        die(); }
    } }

  function bossDefeated(){ // reward, unlock next level, increment streak
    const lvl = levels[currentLevel]; storage.coins += lvl.reward; storage.streak += 1; if(storage.streak > storage.bestStreak) storage.bestStreak = storage.streak;
    // unlock next level
    if(levels[currentLevel+1] && !storage.unlockedLevels.includes(levels[currentLevel+1].id)) storage.unlockedLevels.push(levels[currentLevel+1].id);
    save(); updateUI(); alert('Boss defeated! Coins awarded. Level unlocked.'); boss=null; player.canShoot=false; state = STATE.MENU; menu.style.display='block'; }

  // controls
  window.addEventListener('keydown', e=>{
    if(state===STATE.PLAYING || state===STATE.HARDCORE){ if(e.code==='Space'){ flapPlayer(); } if(e.code==='KeyP'){ paused=!paused; } }
    if(state===STATE.BOSS){ if(e.code==='KeyE' && player.canShoot){ bullets.push({x:player.x+20,y:player.y, vx:8, d:5}); } if(e.code==='Space'){ flapPlayer(); } if(e.code==='KeyP'){ paused=!paused; } }
    // in-game menu (Q)
    if(e.code === 'KeyQ'){
      showInGameMenu();
    }
  });

  function flapPlayer(){ if(!player.alive) return; player.vy = flap; }

  // rendering
  function render(){ ctx.clearRect(0,0,W,H);
    // draw background simple
    ctx.fillStyle='#87ceeb'; ctx.fillRect(0,0,W,H);
    // draw pipes
    ctx.fillStyle='#2e8b57'; for(const p of pipes){ ctx.fillRect(p.x,p.y,p.w,p.h); }
    // draw player
    ctx.fillStyle = '#ffdd57'; if(storage.skins.length) ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
    // draw bullets
    ctx.fillStyle='#fff'; for(const b of bullets) ctx.fillRect(b.x-3,b.y-2,6,4);
    // draw fireballs
    ctx.fillStyle='#f33'; for(const f of fireballs) ctx.beginPath(), ctx.arc(f.x,f.y,8,0,Math.PI*2), ctx.fill();
    // draw boss
    if(boss){ ctx.fillStyle='#555'; ctx.fillRect(boss.x-boss.w/2,boss.y-boss.h/2,boss.w,boss.h); ctx.fillStyle='#fff'; ctx.fillText(`HP:${boss.hp}`, boss.x-boss.w/2+8,boss.y-boss.h/2+20); }
    // HUD
    scoreEl.textContent = score; coinsEl.textContent = storage.coins; streakEl.textContent = storage.streak; levelEl.textContent = currentLevel;
    if(state===STATE.MENU){ /* nothing */ }
    if(state===STATE.SHOP){ /* panel shows shop */ }
    if(state===STATE.LEVEL_SELECT){ /* panel shows levels */ }
    // draw bullets/fire collision with boss handled in updateBullets
  }

  function spawnPipe(lvl){ const gap = lvl.gap; const top = Math.random()*(H-gap-120)+60; const w=80; pipes.push({x:W,y:0,w,h:top,passed:false}); pipes.push({x:W,y:top+gap,w,h:H-(top+gap),passed:false,bottom:true}); }

  // small timer to update bullets and fireballs
  setInterval(()=>{ if(state===STATE.BOSS){ updateBullets(16); } }, 40);

  // simple mouse/touch controls for mobile
  canvas.addEventListener('touchstart', e=>{ e.preventDefault(); if(state===STATE.PLAYING) flapPlayer(); if(state===STATE.MENU) startLevel(1); });
  canvas.addEventListener('mousedown', e=>{ if(state===STATE.PLAYING) flapPlayer(); if(state===STATE.MENU) startLevel(1); });

  // menu button opens in-game menu
  const menuBtn = document.getElementById('menuBtn');
  if(menuBtn) menuBtn.addEventListener('click', showInGameMenu);

  // expose startLevel for menu
  window.startLevel = startLevel;

})();
