// ════════════════════════════════════════
//  FOCUS BATTLE  —  script.js
// ════════════════════════════════════════

// ── CONSTANTS ──────────────────────────

const XP_PER_LEVEL      = 100;
const HP_LOSS_ON_QUIT   = 20;
const REGEN_HP_AMOUNT   = 5;
const REGEN_INTERVAL_MS = 15 * 60 * 1000;  // 15 minutes
const REGEN_CAP         = 50;

const ENEMIES = [
  { name: 'Distraction Goblin',    hp: 80,  xpReward: 40,  tier: 'Common',
    ability: { type: 'xp_steal',  label: 'XP Thief',    desc: 'Steals 15 XP on quit',       stealAmt: 15 } },
  { name: 'Notification Wraith',   hp: 100, xpReward: 50,  tier: 'Common',
    ability: { type: 'hp_drain',  label: 'Soul Drain',  desc: 'Drains 5 HP every 10 min',   drainAmt: 5  } },
  { name: 'Procrastination Troll', hp: 130, xpReward: 65,  tier: 'Uncommon',
    ability: { type: 'time_curse',label: 'Time Curse',  desc: 'Adds 2 min at halfway'                    } },
  { name: 'Doom Scroll Demon',     hp: 160, xpReward: 80,  tier: 'Rare',
    ability: { type: 'xp_steal',  label: 'XP Thief',    desc: 'Steals 25 XP on quit',       stealAmt: 25 } },
  { name: 'Brain Fog Specter',     hp: 200, xpReward: 100, tier: 'Rare',
    ability: { type: 'hp_drain',  label: 'Soul Drain',  desc: 'Drains 8 HP every 10 min',   drainAmt: 8  } },
];

const BOSSES = [
  { name: 'The Procrastinator King',  hp: 500, xpReward: 200, tier: 'Boss', isBoss: true,
    ability: { type: 'hp_drain',  label: 'Royal Drain',    desc: 'Drains 15 HP every 10 min', drainAmt: 15 } },
  { name: 'Lord of Infinite Scroll',  hp: 700, xpReward: 300, tier: 'Boss', isBoss: true,
    ability: { type: 'xp_steal',  label: 'Soul Harvest',   desc: 'Steals 50 XP on quit',      stealAmt: 50 } },
  { name: 'Eternal Void Sovereign',   hp: 900, xpReward: 450, tier: 'Boss', isBoss: true,
    ability: { type: 'time_curse',label: 'Temporal Rift',  desc: 'Adds 5 min at halfway'                   } },
];

const SHOP_ITEMS = [
  { id: 'potion',  name: 'Health Potion',    desc: 'Restore 30 HP instantly',          cost: 30, icon: '⚗', instant: true  },
  { id: 'elixir',  name: 'Elixir of Rebirth',desc: 'Restore 50 HP — even from zero',   cost: 80, icon: '✦', instant: true  },
  { id: 'shield',  name: 'Iron Shield',      desc: 'Block the next HP penalty',         cost: 50, icon: '⬡', instant: false },
  { id: 'tome',    name: 'XP Tome',          desc: '+25 bonus XP on next completion',   cost: 40, icon: '◈', instant: false },
  { id: 'charm',   name: 'Battle Charm',     desc: 'Negate the next XP steal ability',  cost: 60, icon: '⧖', instant: false },
  { id: 'crystal', name: 'Dark Crystal',     desc: '2× XP reward from next boss',       cost: 70, icon: '◇', instant: false },
];

const DAILY_CHALLENGES = [
  { id: 'complete_any',  desc: 'Complete any focus session',             target: 1,  xpBonus: 40,  type: 'complete'     },
  { id: 'complete_long', desc: 'Complete a 50m or 90m session',          target: 1,  xpBonus: 60,  type: 'complete_long'},
  { id: 'no_quit',       desc: 'Complete 2 sessions without quitting',   target: 2,  xpBonus: 70,  type: 'complete'     },
  { id: 'defeat_rare',   desc: 'Defeat a Rare enemy',                    target: 1,  xpBonus: 80,  type: 'defeat_rare'  },
  { id: 'defeat_boss',   desc: 'Defeat a boss enemy',                    target: 1,  xpBonus: 100, type: 'defeat_boss'  },
  { id: 'streak_focus',  desc: 'Complete a session on a 3+ day streak',  target: 1,  xpBonus: 90,  type: 'streak_focus' },
];

// ── STATE ──────────────────────────────

let interval       = null;
let selectedMinutes = 25;
let currentEnemy   = null;
let timeCurseAdded = false;
let regenTimer     = null;

const STATE_VERSION = 3;  // bump to wipe old incompatible saves

const DEFAULT_STATE = {
  version:         STATE_VERSION,
  hp:              100,
  xp:              0,
  level:           1,
  shieldActive:    false,
  xpBoostActive:   false,
  charmActive:     false,
  crystalActive:   false,
  inventory:       [],
  streak:          0,
  lastSessionDate: null,
  lastDeathTime:   null,
  regenHpGiven:    0,
  sessionHistory:  [],
  dailyChallenge:  null,
};

let state = { ...DEFAULT_STATE };

// ── PERSISTENCE ────────────────────────

function saveState() {
  localStorage.setItem('focusBattle', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('focusBattle');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    // Wipe if version mismatch — old saves had no version field
    if (!parsed.version || parsed.version < STATE_VERSION) {
      console.info('Old save detected — resetting to fresh state.');
      localStorage.removeItem('focusBattle');
      return;
    }
    state = { ...DEFAULT_STATE, ...parsed };
  } catch (e) {
    console.warn('Save data corrupted, starting fresh.');
    localStorage.removeItem('focusBattle');
  }
}

// ── SOUND ───────────────────────────────

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.25, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(0, ctx.currentTime + delay);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch (_) {}
}

const SFX = {
  start()    { playTone(110,'sine',0.3,0.2); playTone(220,'sine',0.2,0.15,0.15); },
  defeat()   { [330,440,550,660].forEach((f,i) => playTone(f,'sine',0.25,0.2,i*0.1)); },
  boss()     { [110,138,165,220].forEach((f,i) => playTone(f,'sawtooth',0.4,0.3,i*0.15)); },
  levelUp()  { [261,329,392,523].forEach((f,i) => playTone(f,'triangle',0.3,0.25,i*0.12)); },
  hpLoss()   { playTone(200,'sawtooth',0.15,0.2); playTone(140,'sawtooth',0.15,0.2,0.12); },
  death()    { [220,196,165,110].forEach((f,i) => playTone(f,'sawtooth',0.4,0.3,i*0.2)); },
  purchase() { playTone(660,'sine',0.1,0.2); playTone(880,'sine',0.1,0.15,0.08); },
  tick()     { playTone(440,'sine',0.04,0.04); },
  ability()  { playTone(180,'square',0.2,0.15); playTone(155,'square',0.2,0.15,0.15); },
  regen()    { playTone(440,'sine',0.1,0.15); playTone(520,'sine',0.1,0.1,0.1); },
  challenge(){ [440,523,659].forEach((f,i) => playTone(f,'triangle',0.2,0.2,i*0.1)); },
};

// ── STATS UI ───────────────────────────

function updateStats() {
  document.getElementById('level').textContent       = state.level;
  document.getElementById('hp-val').textContent      = state.hp;
  document.getElementById('xp-val').textContent      = state.xp;
  document.getElementById('streak-val').textContent  = state.streak;
  document.getElementById('hp-fill').style.width     = `${Math.max(0, state.hp)}%`;

  const xpIntoLevel = state.xp % XP_PER_LEVEL;
  document.getElementById('xp-fill').style.width = `${(xpIntoLevel / XP_PER_LEVEL) * 100}%`;

  // Boss incoming indicator
  const bossEl = document.getElementById('boss-incoming-stat');
  bossEl.style.display = (state.level % 5 === 0 && !interval) ? 'flex' : 'none';

  renderActiveItems();
  saveState();
}

function renderActiveItems() {
  const el = document.getElementById('active-items');
  el.innerHTML = '';
  const badges = [
    [state.shieldActive,  '⬡ Shield',     ''],
    [state.xpBoostActive, '◈ XP Boost',   'xp-badge'],
    [state.charmActive,   '⧖ Charm',      ''],
    [state.crystalActive, '◇ Crystal',    'xp-badge'],
  ];
  badges.forEach(([active, label, cls]) => {
    if (!active) return;
    const b = document.createElement('span');
    b.className   = `item-badge ${cls}`.trim();
    b.textContent = label;
    el.appendChild(b);
  });
}

// ── XP & HP ────────────────────────────

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
  updateStats();
  if (state.hp === 0) triggerDeath();
}

// ── HP REGEN ───────────────────────────

function triggerDeath() {
  SFX.death();
  state.lastDeathTime = Date.now();
  state.regenHpGiven  = 0;
  saveState();
  showDeathScreen();
  startRegenInterval();
}

function checkRegen() {
  if (!state.lastDeathTime || state.hp >= REGEN_CAP) return;
  const elapsed       = Date.now() - state.lastDeathTime;
  const totalExpected = Math.min(Math.floor(elapsed / REGEN_INTERVAL_MS) * REGEN_HP_AMOUNT, REGEN_CAP);
  const toGive        = totalExpected - (state.regenHpGiven || 0);
  if (toGive > 0) {
    state.hp          = Math.min(REGEN_CAP, (state.hp || 0) + toGive);
    state.regenHpGiven = (state.regenHpGiven || 0) + toGive;
    SFX.regen();
    showMessage(`❤ Regenerated ${toGive} HP`);
    updateStats();
    if (state.hp > 0) hideDeathScreen();
  }
}

function startRegenInterval() {
  if (regenTimer) clearInterval(regenTimer);
  regenTimer = setInterval(() => {
    checkRegen();
    updateRegenCountdown();
  }, 10000);   // check every 10s for accurate countdown
}

function updateRegenCountdown() {
  const el = document.getElementById('regen-countdown');
  if (!el || !state.lastDeathTime) return;
  if (state.hp >= REGEN_CAP) { el.textContent = 'Max regen reached'; return; }
  const elapsed   = Date.now() - state.lastDeathTime;
  const msInCycle = elapsed % REGEN_INTERVAL_MS;
  const msLeft    = REGEN_INTERVAL_MS - msInCycle;
  const mins      = Math.floor(msLeft / 60000);
  const secs      = Math.floor((msLeft % 60000) / 1000);
  el.textContent  = `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

function showDeathScreen() {
  updateRegenCountdown();
  openModal('death-screen');
}

function hideDeathScreen() {
  closeModal('death-screen');
  if (regenTimer) { clearInterval(regenTimer); regenTimer = null; }
}

// ── STREAK ─────────────────────────────

function getTodayStr()     { return new Date().toISOString().split('T')[0]; }
function getYesterdayStr() { return new Date(Date.now() - 86400000).toISOString().split('T')[0]; }

function handleStreak() {
  const today = getTodayStr();
  if (state.lastSessionDate === today)              return 0;
  state.streak = (state.lastSessionDate === getYesterdayStr()) ? state.streak + 1 : 1;
  state.lastSessionDate = today;
  return Math.min(state.streak * 5, 25);
}

// ── DAILY CHALLENGE ─────────────────────

function pickDailyChallenge() {
  const today    = getTodayStr();
  const existing = state.dailyChallenge;

  // Already have today's challenge
  if (existing && existing.date === today) return;

  // Pick deterministically by date hash
  const hash   = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const picked = DAILY_CHALLENGES[hash % DAILY_CHALLENGES.length];

  state.dailyChallenge = { ...picked, progress: 0, date: today };
  saveState();
}

function renderDailyChallenge() {
  const dc = state.dailyChallenge;
  if (!dc) return;

  document.getElementById('dc-desc').textContent     = dc.desc;
  document.getElementById('dc-progress').textContent = `${dc.progress} / ${dc.target}`;

  const statusEl = document.getElementById('dc-status');
  if (dc.progress >= dc.target) {
    statusEl.textContent   = `✓ +${dc.xpBonus} XP`;
    statusEl.className     = 'dc-done';
    document.getElementById('daily-challenge').classList.add('dc-complete');
  } else {
    statusEl.textContent   = `+${dc.xpBonus} XP`;
    statusEl.className     = '';
    document.getElementById('daily-challenge').classList.remove('dc-complete');
  }
}

// Check and award challenge progress — called after session events
function tickChallenge(event, ctx = {}) {
  const dc = state.dailyChallenge;
  if (!dc || dc.progress >= dc.target) return;

  let progress = false;

  if (dc.type === 'complete'      && event === 'session_complete')                    progress = true;
  if (dc.type === 'complete_long' && event === 'session_complete' && ctx.mins >= 50)  progress = true;
  if (dc.type === 'defeat_rare'   && event === 'session_complete' && ctx.tier === 'Rare') progress = true;
  if (dc.type === 'defeat_boss'   && event === 'session_complete' && ctx.isBoss)      progress = true;
  if (dc.type === 'streak_focus'  && event === 'session_complete' && state.streak >= 3) progress = true;

  if (progress) {
    state.dailyChallenge.progress++;
    if (state.dailyChallenge.progress >= dc.target) {
      gainXP(dc.xpBonus);
      SFX.challenge();
      showMessage(`🏆 Daily Challenge Complete! +${dc.xpBonus} XP`);
    }
    renderDailyChallenge();
    saveState();
  }
}

// ── BOSS SYSTEM ────────────────────────

function isBossLevel() { return state.level % 5 === 0; }

function getBoss() {
  const idx   = Math.floor(state.level / 5) - 1;
  const boss  = BOSSES[idx % BOSSES.length];
  // Scale HP and XP on repeat cycles
  const cycle = Math.floor(idx / BOSSES.length);
  return {
    ...boss,
    ability: { ...boss.ability },
    hp:        Math.round(boss.hp * (1 + cycle * 0.5)),
    xpReward:  Math.round(boss.xpReward * (1 + cycle * 0.3)),
  };
}

// ── ENEMY SYSTEM ───────────────────────

function spawnEnemy() {
  const template  = isBossLevel() ? getBoss() : ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  currentEnemy    = { ...template, ability: { ...template.ability }, currentHp: template.hp, maxHp: template.hp };
  timeCurseAdded  = false;

  document.getElementById('enemy-name').textContent          = currentEnemy.name;
  document.getElementById('enemy-ability-label').textContent = currentEnemy.ability.label;
  document.getElementById('enemy-ability-desc').textContent  = currentEnemy.ability.desc;

  const badge = document.getElementById('enemy-tier-badge');
  badge.textContent = currentEnemy.tier;
  badge.className   = `tier-${currentEnemy.tier.toLowerCase()}`;

  const card = document.getElementById('enemy-card');
  card.classList.toggle('boss-card', !!currentEnemy.isBoss);

  if (currentEnemy.isBoss) SFX.boss();

  updateEnemyBar();
  card.classList.remove('hidden');
  requestAnimationFrame(() => card.classList.add('visible'));
}

function updateEnemyBar() {
  if (!currentEnemy) return;
  const pct = (currentEnemy.currentHp / currentEnemy.maxHp) * 100;
  document.getElementById('enemy-hp-fill').style.width = `${Math.max(0, pct)}%`;
  document.getElementById('enemy-hp-text').textContent  = `${currentEnemy.currentHp} / ${currentEnemy.maxHp}`;
}

function damageEnemy(dmg) {
  if (!currentEnemy) return;
  currentEnemy.currentHp = Math.max(0, currentEnemy.currentHp - dmg);
  updateEnemyBar();
}

function triggerEnemyAbility(context) {
  if (!currentEnemy) return null;
  const ab = currentEnemy.ability;

  if (ab.type === 'xp_steal' && context === 'quit') {
    if (state.charmActive) {
      state.charmActive = false;
      SFX.ability();
      showMessage('⧖ Battle Charm deflected the XP steal!');
      updateStats();
      return null;
    }
    const amt  = ab.stealAmt || 15;
    state.xp   = Math.max(0, state.xp - amt);
    SFX.ability();
    showMessage(`💀 ${currentEnemy.name} stole ${amt} XP!`);
    updateStats();
  }

  if (ab.type === 'hp_drain' && context === 'tick_10min') {
    loseHP(ab.drainAmt || 5);
    showMessage(`🩸 ${currentEnemy.name} drained ${ab.drainAmt} HP!`);
  }

  if (ab.type === 'time_curse' && context === 'halfway' && !timeCurseAdded) {
    timeCurseAdded = true;
    const addMins = currentEnemy.isBoss ? 5 : 2;
    SFX.ability();
    showMessage(`⏳ ${currentEnemy.name} cursed you! +${addMins} minutes!`);
    return { addSeconds: addMins * 60 };
  }

  return null;
}

function defeatEnemy() {
  if (!currentEnemy) return;
  currentEnemy.currentHp = 0;
  updateEnemyBar();

  const streakBonus  = handleStreak();
  const xpBonus      = state.xpBoostActive ? 25 : 0;
  const crystalBonus = (state.crystalActive && currentEnemy.isBoss) ? currentEnemy.xpReward : 0;

  if (state.xpBoostActive)  state.xpBoostActive  = false;
  if (state.crystalActive && currentEnemy.isBoss) state.crystalActive = false;

  const total      = currentEnemy.xpReward + xpBonus + streakBonus + crystalBonus;
  const bonusParts = [];
  if (xpBonus)     bonusParts.push(`+${xpBonus} Tome`);
  if (streakBonus) bonusParts.push(`+${streakBonus} Streak ×${state.streak}`);
  if (crystalBonus)bonusParts.push(`+${crystalBonus} Crystal ×2`);

  SFX.defeat();
  gainXP(total);

  let msg = `⚔ ${currentEnemy.name} defeated! +${total} XP`;
  if (bonusParts.length) msg += ` (${bonusParts.join(', ')})`;
  if (state.streak > 1)  msg += ` 🔥 ${state.streak}d streak`;
  showMessage(msg);

  // Daily challenge tick
  tickChallenge('session_complete', {
    mins:   selectedMinutes,
    tier:   currentEnemy.tier,
    isBoss: !!currentEnemy.isBoss,
  });

  // Session history entry
  pushHistory({ completed: true, xpGained: total });

  hideEnemyCard();
  currentEnemy = null;
}

function hideEnemyCard() {
  const card = document.getElementById('enemy-card');
  card.classList.remove('visible');
  setTimeout(() => { card.classList.add('hidden'); card.classList.remove('boss-card'); }, 500);
}

// ── SESSION HISTORY ─────────────────────

function pushHistory({ completed, xpGained }) {
  const now   = new Date();
  const entry = {
    timestamp: now.getTime(),
    date:      now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    time:      now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }),
    enemyName: currentEnemy ? currentEnemy.name : '—',
    tier:      currentEnemy ? currentEnemy.tier  : '—',
    isBoss:    currentEnemy ? !!currentEnemy.isBoss : false,
    duration:  selectedMinutes,
    xpGained,
    completed,
  };
  state.sessionHistory.unshift(entry);
  if (state.sessionHistory.length > 20) state.sessionHistory.pop();
  saveState();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (!state.sessionHistory.length) {
    list.innerHTML = '<p class="inv-empty">No sessions yet.<br>Complete your first session to start tracking.</p>';
    return;
  }

  state.sessionHistory.forEach(s => {
    const row = document.createElement('div');
    row.className = `history-row${s.isBoss ? ' boss-row' : ''}${!s.completed ? ' quit-row' : ''}`;
    row.innerHTML = `
      <div class="history-left">
        <span class="history-enemy">${s.enemyName}</span>
        <span class="history-meta">${s.date} · ${s.time} · ${s.duration}m</span>
      </div>
      <div class="history-right">
        <span class="history-xp">+${s.xpGained} XP</span>
        <span class="history-result ${s.completed ? 'won' : 'lost'}">${s.completed ? 'WIN' : 'QUIT'}</span>
      </div>
    `;
    list.appendChild(row);
  });
}

// ── TIMER ──────────────────────────────

function resetTimer() {
  document.getElementById('timer').textContent = `${selectedMinutes}:00`;
}

// ── SESSION START ───────────────────────

document.getElementById('start-btn').addEventListener('click', function () {
  if (interval) return;
  if (state.hp <= 0) { showMessage('💀 You have no HP. Visit the Apothecary or wait to regen.'); showDeathScreen(); return; }

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

    if (totalSeconds > 0 && totalSeconds % 60 === 0) {
      minutesPassed++;
      damageEnemy(dmgPerMinute);
      SFX.tick();

      if (minutesPassed % 10 === 0)       triggerEnemyAbility('tick_10min');
      if (minutesPassed === halfwayMin) {
        const result = triggerEnemyAbility('halfway');
        if (result && result.addSeconds)  totalSeconds += result.addSeconds;
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

// ── SESSION STOP ───────────────────────

document.getElementById('btn-stop').addEventListener('click', function () {
  if (!interval) return;
  clearInterval(interval);
  interval = null;

  triggerEnemyAbility('quit');
  loseHP(HP_LOSS_ON_QUIT);
  if (state.hp > 0) showMessage(`⚠ Session abandoned! -${HP_LOSS_ON_QUIT} HP`);

  pushHistory({ completed: false, xpGained: 0 });
  hideEnemyCard();
  currentEnemy = null;
  resetTimer();
});

// ── DURATION PICKER ────────────────────

document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    if (interval) return;
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedMinutes = parseInt(this.dataset.min);
    resetTimer();
  });
});

// ── SHOP ───────────────────────────────

function renderShop() {
  const grid = document.getElementById('shop-items-grid');
  grid.innerHTML = '';

  SHOP_ITEMS.forEach(item => {
    const canAfford     = state.xp >= item.cost;
    const alreadyOwned  = !item.instant && state.inventory.includes(item.id);
    const alreadyActive =
      (item.id === 'shield'  && state.shieldActive)  ||
      (item.id === 'tome'    && state.xpBoostActive)  ||
      (item.id === 'charm'   && state.charmActive)    ||
      (item.id === 'crystal' && state.crystalActive);

    const disabled = !canAfford || alreadyOwned || alreadyActive;
    const btnLabel = alreadyActive ? 'Active' : alreadyOwned ? 'Owned' : `${item.cost} XP`;

    const card     = document.createElement('div');
    card.className = `shop-card${!canAfford ? ' locked' : ''}${alreadyActive || alreadyOwned ? ' active-item' : ''}`;
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
    `;

    if (!disabled) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => { buyItem(item); renderShop(); });
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
    if (item.id === 'elixir') {
      state.hp           = 50;
      state.lastDeathTime = null;
      state.regenHpGiven  = 0;
      hideDeathScreen();
      showMessage('✦ Elixir of Rebirth! HP restored to 50');
    }
  } else {
    state.inventory.push(item.id);
    showMessage(`${item.icon} ${item.name} added to inventory!`);
  }
  updateStats();
}

document.getElementById('btn-shop').addEventListener('click', () => { renderShop(); openModal('shop-modal'); });
document.getElementById('shop-close').addEventListener('click', () => closeModal('shop-modal'));
document.getElementById('shop-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('shop-modal'); });
document.getElementById('death-shop-btn').addEventListener('click', () => { renderShop(); openModal('shop-modal'); });

// ── INVENTORY ──────────────────────────

function renderInventory() {
  const grid = document.getElementById('inv-items-grid');
  grid.innerHTML = '';

  if (!state.inventory.length) {
    grid.innerHTML = '<p class="inv-empty">Your inventory is empty.<br>Buy items from the shop first.</p>';
    return;
  }

  const counts = {};
  state.inventory.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  Object.entries(counts).forEach(([id, count]) => {
    const item          = SHOP_ITEMS.find(s => s.id === id);
    if (!item) return;
    const alreadyActive =
      (id === 'shield'  && state.shieldActive)  ||
      (id === 'tome'    && state.xpBoostActive)  ||
      (id === 'charm'   && state.charmActive)    ||
      (id === 'crystal' && state.crystalActive);

    const card = document.createElement('div');
    card.className = `shop-card${alreadyActive ? ' active-item' : ''}`;
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}${count > 1 ? ` <em>×${count}</em>` : ''}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${alreadyActive ? 'disabled' : ''}>${alreadyActive ? 'Active' : 'Equip'}</button>
    `;
    if (!alreadyActive) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => { equipItem(id); renderInventory(); });
    }
    grid.appendChild(card);
  });
}

function equipItem(id) {
  const idx = state.inventory.indexOf(id);
  if (idx === -1) return;
  state.inventory.splice(idx, 1);

  const msgs = {
    shield:  ['shieldActive',  '⬡ Iron Shield equipped! Next HP penalty blocked.'],
    tome:    ['xpBoostActive', '◈ XP Tome activated! +25 XP on next completion.'],
    charm:   ['charmActive',   '⧖ Battle Charm equipped! Next XP steal negated.'],
    crystal: ['crystalActive', '◇ Dark Crystal equipped! 2× XP from next boss.'],
  };
  if (msgs[id]) {
    state[msgs[id][0]] = true;
    SFX.purchase();
    showMessage(msgs[id][1]);
  }
  updateStats();
}

document.getElementById('btn-inv').addEventListener('click', () => { renderInventory(); openModal('inv-modal'); });
document.getElementById('inv-close').addEventListener('click', () => closeModal('inv-modal'));
document.getElementById('inv-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('inv-modal'); });

// ── HISTORY ────────────────────────────

document.getElementById('btn-history').addEventListener('click', () => { renderHistory(); openModal('history-modal'); });
document.getElementById('history-close').addEventListener('click', () => closeModal('history-modal'));
document.getElementById('history-modal').addEventListener('click', function (e) { if (e.target === this) closeModal('history-modal'); });

// ── MODAL HELPERS ───────────────────────

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

// ── TOAST ───────────────────────────────

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

// ── INIT ────────────────────────────────

loadState();
checkRegen();                  // apply any offline regen
pickDailyChallenge();
updateStats();
resetTimer();
renderDailyChallenge();

// If still dead on load, show death screen
if (state.hp <= 0) {
  showDeathScreen();
  startRegenInterval();
}