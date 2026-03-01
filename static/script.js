const XP_PER_LEVEL    = 100;
const HP_LOSS_ON_QUIT = 20;

const ENEMIES = [
  {
    name: 'Distraction Goblin',
    hp: 80, xpReward: 40, tier: 'Common',
    ability: { type: 'xp_steal', label: 'XP Thief', desc: 'Steals 15 XP if you quit', stealAmt: 15 },
  },
  {
    name: 'Notification Wraith',
    hp: 100, xpReward: 50, tier: 'Common',
    ability: { type: 'hp_drain', label: 'Soul Drain', desc: 'Drains 5 HP every 10 min', drainAmt: 5 },
  },
  {
    name: 'Procrastination Troll',
    hp: 130, xpReward: 65, tier: 'Uncommon',
    ability: { type: 'time_curse', label: 'Time Curse', desc: 'Adds 2 minutes at the halfway point' },
  },
  {
    name: 'Doom Scroll Demon',
    hp: 160, xpReward: 80, tier: 'Rare',
    ability: { type: 'xp_steal', label: 'XP Thief', desc: 'Steals 25 XP if you quit', stealAmt: 25 },
  },
  {
    name: 'Brain Fog Specter',
    hp: 200, xpReward: 100, tier: 'Rare',
    ability: { type: 'hp_drain', label: 'Soul Drain', desc: 'Drains 8 HP every 10 min', drainAmt: 8 },
  },
];

const SHOP_ITEMS = [
  { id: 'potion', name: 'Health Potion', desc: 'Restore 30 HP instantly', cost: 30, icon: '⚗', instant: true  },
  { id: 'shield', name: 'Iron Shield',   desc: 'Block the next HP penalty', cost: 50, icon: '⬡', instant: false },
  { id: 'tome',   name: 'XP Tome',       desc: '+25 bonus XP on next session complete', cost: 40, icon: '◈', instant: false },
];

// sTATE

let interval        = null;
let selectedMinutes = 25;
let currentEnemy    = null;
let timeCurseAdded  = false;

let state = {
  hp:              100,
  xp:              0,
  level:           1,
  shieldActive:    false,
  xpBoostActive:   false,
  inventory:       [],        // array of item ids
  streak:          0,
  lastSessionDate: null,
};

//PERSISTENCE

function saveState() {
  localStorage.setItem('focusBattle', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('focusBattle');
  if (saved) {
    try {
      state = { ...state, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Could not load saved state, starting fresh.');
    }
  }
}

//SOUND (Web Audio API)
// No external files — all tones generated at runtime.

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.25, delay = 0) {
  try {
    const ctx  = getCtx();
    const osc  = ctx.createOscillator();
    const vol  = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(0, ctx.currentTime + delay);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch (_) {}  // silently fail if audio is unavailable
}

const SFX = {
  start()   {
    playTone(110, 'sine', 0.3, 0.2);
    playTone(220, 'sine', 0.2, 0.15, 0.15);
  },
  defeat()  {
    [330, 440, 550, 660].forEach((f, i) => playTone(f, 'sine', 0.25, 0.2, i * 0.1));
  },
  levelUp() {
    [261, 329, 392, 523].forEach((f, i) => playTone(f, 'triangle', 0.3, 0.25, i * 0.12));
  },
  hpLoss()  {
    playTone(200, 'sawtooth', 0.15, 0.2);
    playTone(140, 'sawtooth', 0.15, 0.2, 0.12);
  },
  purchase() {
    playTone(660, 'sine', 0.1, 0.2);
    playTone(880, 'sine', 0.1, 0.15, 0.08);
  },
  tick()    { playTone(440, 'sine', 0.04, 0.04); },
  ability() {
    playTone(180, 'square', 0.2, 0.15);
    playTone(155, 'square', 0.2, 0.15, 0.15);
  },
};

//STATS UI

function updateStats() {
  document.getElementById('level').textContent   = state.level;
  document.getElementById('hp-val').textContent  = state.hp;
  document.getElementById('xp-val').textContent  = state.xp;
  document.getElementById('streak-val').textContent = state.streak;

  document.getElementById('hp-fill').style.width  = `${Math.max(0, state.hp)}%`;

  const xpIntoLevel = state.xp % XP_PER_LEVEL;
  document.getElementById('xp-fill').style.width  = `${(xpIntoLevel / XP_PER_LEVEL) * 100}%`;

  renderActiveItems();
  saveState();
}

function renderActiveItems() {
  const el = document.getElementById('active-items');
  el.innerHTML = '';
  if (state.shieldActive) {
    const b = document.createElement('span');
    b.className   = 'item-badge';
    b.textContent = '⬡ Shield';
    el.appendChild(b);
  }
  if (state.xpBoostActive) {
    const b = document.createElement('span');
    b.className   = 'item-badge xp-badge';
    b.textContent = '◈ XP Boost';
    el.appendChild(b);
  }
}

// XP & HP

function gainXP(amount) {
  state.xp += amount;
  while (state.xp >= state.level * XP_PER_LEVEL) {
    state.level++;
    SFX.levelUp();
    showMessage(`⬆ Level Up! You are now Level ${state.level}!`);
  }
  updateStats();
}

function loseHP(amount) {
  if (state.shieldActive) {
    state.shieldActive = false;
    showMessage('⬡ Shield absorbed the hit! No HP lost.');
    updateStats();
    return;
  }
  SFX.hpLoss();
  state.hp = Math.max(0, state.hp - amount);
  if (state.hp === 0) showMessage('💀 No HP remaining. Rest up and come back.');
  updateStats();
}

//STREAK

function getTodayStr() {
  return new Date().toISOString().split('T')[0];  // "YYYY-MM-DD"
}

function getYesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

// Called on session complete. Returns bonus XP earned from streak.
function handleStreak() {
  const today     = getTodayStr();
  const yesterday = getYesterdayStr();

  if (state.lastSessionDate === today) {
    // Multiple sessions today — streak already counted, no extra bonus
    return 0;
  } else if (state.lastSessionDate === yesterday) {
    state.streak++;
  } else {
    // Missed a day or first session ever
    state.streak = 1;
  }

  state.lastSessionDate = today;

  // +5 XP per streak day, capped at +25 (5-day streak)
  return Math.min(state.streak * 5, 25);
}

//ENEMY SYSTEM

function spawnEnemy() {
  const template = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  currentEnemy   = { ...template, ability: { ...template.ability }, currentHp: template.hp, maxHp: template.hp };
  timeCurseAdded = false;

  document.getElementById('enemy-name').textContent         = currentEnemy.name;
  document.getElementById('enemy-ability-label').textContent = currentEnemy.ability.label;
  document.getElementById('enemy-ability-desc').textContent  = currentEnemy.ability.desc;

  const badge      = document.getElementById('enemy-tier-badge');
  badge.textContent = currentEnemy.tier;
  badge.className   = `tier-${currentEnemy.tier.toLowerCase()}`;

  updateEnemyBar();

  const card = document.getElementById('enemy-card');
  card.classList.remove('hidden');
  requestAnimationFrame(() => card.classList.add('visible'));
}

function updateEnemyBar() {
  if (!currentEnemy) return;
  const pct = (currentEnemy.currentHp / currentEnemy.maxHp) * 100;
  document.getElementById('enemy-hp-fill').style.width = `${Math.max(0, pct)}%`;
  document.getElementById('enemy-hp-text').textContent  =
    `${currentEnemy.currentHp} / ${currentEnemy.maxHp}`;
}

function damageEnemy(dmg) {
  if (!currentEnemy) return;
  currentEnemy.currentHp = Math.max(0, currentEnemy.currentHp - dmg);
  updateEnemyBar();
}

// context: 'quit' | 'tick_10min' | 'halfway'
function triggerEnemyAbility(context) {
  if (!currentEnemy) return null;
  const ab = currentEnemy.ability;

  if (ab.type === 'xp_steal' && context === 'quit') {
    const amt  = ab.stealAmt || 15;
    state.xp   = Math.max(0, state.xp - amt);
    SFX.ability();
    showMessage(`💀 ${currentEnemy.name} stole ${amt} XP!`);
    updateStats();
  }

  if (ab.type === 'hp_drain' && context === 'tick_10min') {
    const amt = ab.drainAmt || 5;
    loseHP(amt);
    showMessage(`🩸 ${currentEnemy.name} drained ${amt} HP!`);
  }

  if (ab.type === 'time_curse' && context === 'halfway' && !timeCurseAdded) {
    timeCurseAdded = true;
    SFX.ability();
    showMessage(`⏳ ${currentEnemy.name} cursed you! +2 minutes added!`);
    return 'add_time';  // signal to timer loop
  }

  return null;
}

function defeatEnemy() {
  if (!currentEnemy) return;
  currentEnemy.currentHp = 0;
  updateEnemyBar();

  const streakBonus = handleStreak();
  const xpBonus     = state.xpBoostActive ? 25 : 0;
  if (state.xpBoostActive) state.xpBoostActive = false;

  const total      = currentEnemy.xpReward + xpBonus + streakBonus;
  const bonusParts = [];
  if (xpBonus)     bonusParts.push(`+${xpBonus} Tome`);
  if (streakBonus) bonusParts.push(`+${streakBonus} Streak ×${state.streak}`);

  SFX.defeat();
  gainXP(total);

  let msg = `⚔ ${currentEnemy.name} defeated! +${total} XP`;
  if (bonusParts.length) msg += ` (${bonusParts.join(', ')})`;
  if (state.streak > 1)  msg += ` 🔥 ${state.streak}-day streak!`;
  showMessage(msg);

  hideEnemyCard();
  currentEnemy = null;
}

function hideEnemyCard() {
  const card = document.getElementById('enemy-card');
  card.classList.remove('visible');
  setTimeout(() => card.classList.add('hidden'), 500);
}

//TIMER

function resetTimer() {
  document.getElementById('timer').textContent = `${selectedMinutes}:00`;
}

//SESSION START

document.getElementById('start-btn').addEventListener('click', function () {
  if (interval) return;

  spawnEnemy();
  SFX.start();

  let totalSeconds   = selectedMinutes * 60;
  let minutesPassed  = 0;
  const dmgPerMinute = Math.ceil(currentEnemy.maxHp / selectedMinutes);
  const halfwayMin   = Math.floor(selectedMinutes / 2);
  const timerEl      = document.getElementById('timer');

  interval = setInterval(function () {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerEl.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    totalSeconds--;

    // Per-minute events
    if (totalSeconds > 0 && totalSeconds % 60 === 0) {
      minutesPassed++;
      damageEnemy(dmgPerMinute);
      SFX.tick();

      // HP drain every 10 minutes
      if (minutesPassed % 10 === 0) {
        triggerEnemyAbility('tick_10min');
      }

      // Time curse at halfway
      if (minutesPassed === halfwayMin) {
        const result = triggerEnemyAbility('halfway');
        if (result === 'add_time') totalSeconds += 120;
      }
    }

    if (totalSeconds < 0) {
      clearInterval(interval);
      interval = null;
      defeatEnemy();
      resetTimer();
    }
  }, 1000);
});

//SESSION STOP

document.getElementById('btn-stop').addEventListener('click', function () {
  if (!interval) return;
  clearInterval(interval);
  interval = null;

  triggerEnemyAbility('quit');   // XP steal fires here if applicable
  loseHP(HP_LOSS_ON_QUIT);
  if (state.hp > 0) showMessage(`⚠ Session abandoned! -${HP_LOSS_ON_QUIT} HP`);

  hideEnemyCard();
  currentEnemy = null;
  resetTimer();
});

//DURATION PICKER

document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    if (interval) return;
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedMinutes = parseInt(this.dataset.min);
    resetTimer();
  });
});

//SHOP

function renderShop() {
  const grid = document.getElementById('shop-items-grid');
  grid.innerHTML = '';

  SHOP_ITEMS.forEach(item => {
    const canAfford    = state.xp >= item.cost;
    const alreadyOwned = !item.instant && state.inventory.includes(item.id);
    const alreadyActive =
      (item.id === 'shield' && state.shieldActive) ||
      (item.id === 'tome'   && state.xpBoostActive);

    const card     = document.createElement('div');
    const disabled = !canAfford || alreadyOwned || alreadyActive;
    const btnLabel = alreadyActive ? 'Active' : alreadyOwned ? 'Owned' : `${item.cost} XP`;

    card.className = `shop-card${!canAfford ? ' locked' : ''}${alreadyActive || alreadyOwned ? ' active-item' : ''}`;
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
    `;

    if (!disabled) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => {
        buyItem(item);
        renderShop();
      });
    }

    grid.appendChild(card);
  });
}

function buyItem(item) {
  state.xp -= item.cost;
  SFX.purchase();

  if (item.instant) {
    if (item.id === 'potion') {
      state.hp = Math.min(100, state.hp + 30);
      showMessage('⚗ Health Potion used! +30 HP');
    }
  } else {
    // Non-instant items go to inventory — equip from there
    state.inventory.push(item.id);
    showMessage(`${item.icon} ${item.name} added to inventory!`);
  }

  updateStats();
}

document.getElementById('btn-shop').addEventListener('click', () => {
  renderShop();
  openModal('shop-modal');
});
document.getElementById('shop-close').addEventListener('click', () => closeModal('shop-modal'));
document.getElementById('shop-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal('shop-modal');
});

//INVENTORY

function renderInventory() {
  const grid = document.getElementById('inv-items-grid');
  grid.innerHTML = '';

  if (state.inventory.length === 0) {
    grid.innerHTML = '<p class="inv-empty">Your inventory is empty.<br>Buy items from the shop first.</p>';
    return;
  }

  // Count duplicates
  const counts = {};
  state.inventory.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  Object.entries(counts).forEach(([id, count]) => {
    const item = SHOP_ITEMS.find(s => s.id === id);
    if (!item) return;

    const alreadyActive =
      (id === 'shield' && state.shieldActive) ||
      (id === 'tome'   && state.xpBoostActive);

    const card = document.createElement('div');
    card.className = `shop-card${alreadyActive ? ' active-item' : ''}`;
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}${count > 1 ? ` <em>×${count}</em>` : ''}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${alreadyActive ? 'disabled' : ''}>${alreadyActive ? 'Active' : 'Equip'}</button>
    `;

    if (!alreadyActive) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => {
        equipItem(id);
        renderInventory();
      });
    }

    grid.appendChild(card);
  });
}

function equipItem(id) {
  const idx = state.inventory.indexOf(id);
  if (idx === -1) return;
  state.inventory.splice(idx, 1);  // remove one copy

  if (id === 'shield') {
    state.shieldActive = true;
    SFX.purchase();
    showMessage('⬡ Iron Shield equipped! Next HP penalty blocked.');
  } else if (id === 'tome') {
    state.xpBoostActive = true;
    SFX.purchase();
    showMessage('◈ XP Tome activated! +25 XP on next completion.');
  }

  updateStats();
}

document.getElementById('btn-inv').addEventListener('click', () => {
  renderInventory();
  openModal('inv-modal');
});
document.getElementById('inv-close').addEventListener('click', () => closeModal('inv-modal'));
document.getElementById('inv-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal('inv-modal');
});

//MODAL HELPERS

function openModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  requestAnimationFrame(() => el.classList.add('open'));
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  setTimeout(() => el.classList.add('hidden'), 300);
}

//TOAST

function showMessage(text) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id          = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

//INIT
loadState();
updateStats();
resetTimer();