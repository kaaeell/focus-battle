// ════════════════════════════════════════
//  FOCUS BATTLE  —  script.js
// ════════════════════════════════════════

// ── CONSTANTS ──────────────────────────

const STATE_VERSION     = 6;
const XP_PER_LEVEL      = 100;
const HP_LOSS_ON_QUIT   = 20;
const REGEN_HP_AMOUNT   = 5;
const REGEN_INTERVAL_MS = 15 * 60 * 1000;
const REGEN_CAP         = 50;

const DEFAULT_STATE = {
  version:              STATE_VERSION,
  hp:                   100,
  xp:                   0,
  level:                1,
  shieldActive:         false,
  xpBoostActive:        false,
  charmActive:          false,
  crystalActive:        false,
  inventory:            [],
  streak:               0,
  highestStreak:        0,
  lastSessionDate:      null,
  lastDeathTime:        null,
  regenHpGiven:         0,
  sessionHistory:       [],
  dailyChallenge:       null,
  achievements:         {},
  totalSessions:        0,
  totalBossKills:       0,
  totalRareKills:       0,
  totalMinutesFocused:  0,
  totalXpEarned:        0,
  muted:                false,
  particlesEnabled:     true,
};

let state = { ...DEFAULT_STATE };


// ════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════

const canvas  = document.getElementById('bg-canvas');
const pCtx    = canvas.getContext('2d');
let particles = [];
let bossParticleMode = false;
let particleAnimId   = null;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function makeParticle() {
  return {
    x:       Math.random() * canvas.width,
    y:       Math.random() * canvas.height,
    size:    Math.random() * 1.4 + 0.4,
    speedX:  (Math.random() - 0.5) * 0.25,
    speedY:  -(Math.random() * 0.35 + 0.08),
    opacity: Math.random() * 0.25 + 0.04,
    phase:   Math.random() * Math.PI * 2,   // for the slow opacity pulse
  };
}

function initParticles() {
  resizeCanvas();
  particles = Array.from({ length: 65 }, makeParticle);
}

function drawParticles() {
  if (!state.particlesEnabled) {
    pCtx.clearRect(0, 0, canvas.width, canvas.height);
    particleAnimId = requestAnimationFrame(drawParticles);
    return;
  }

  pCtx.clearRect(0, 0, canvas.width, canvas.height);

  const now   = Date.now() / 1000;
  const speed = bossParticleMode ? 2.8 : 1;
  const color = bossParticleMode ? '255, 195, 70' : '255, 255, 255';

  particles.forEach(p => {
    // gentle pulsing opacity
    const pulse = Math.sin(now * 0.7 + p.phase) * 0.07;
    const alpha = Math.min(0.45, Math.max(0, p.opacity + pulse));

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(${color}, ${alpha})`;
    pCtx.fill();

    p.x += p.speedX * speed;
    p.y += p.speedY * speed;

    // wrap when a particle leaves the screen
    if (p.y < -5) {
      p.y = canvas.height + 5;
      p.x = Math.random() * canvas.width;
    }
    if (p.x < -5)              p.x = canvas.width + 5;
    if (p.x > canvas.width + 5) p.x = -5;
  });

  particleAnimId = requestAnimationFrame(drawParticles);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  // keep particles within the new bounds
  particles.forEach(p => {
    p.x = Math.random() * canvas.width;
    p.y = Math.random() * canvas.height;
  });
});


// ════════════════════════════════════════
//  ACHIEVEMENTS
// ════════════════════════════════════════

const ACHIEVEMENTS = [
  { id: 'first_blood',  icon: '⚔', name: 'First Blood',  desc: 'Complete your first session',         category: 'Session'     },
  { id: 'ten_sessions', icon: '📜', name: 'Veteran',      desc: 'Complete 10 sessions',                category: 'Session'     },
  { id: 'long_haul',    icon: '⏳', name: 'Long Haul',    desc: 'Complete a 90-minute session',        category: 'Session'     },
  { id: 'no_damage',    icon: '🛡', name: 'Untouchable',  desc: 'Finish a session without losing HP',  category: 'Session'     },
  { id: 'rare_hunter',  icon: '💀', name: 'Rare Hunter',  desc: 'Defeat a Rare enemy',                 category: 'Combat'      },
  { id: 'boss_slayer',  icon: '👑', name: 'Boss Slayer',  desc: 'Defeat your first boss',              category: 'Combat'      },
  { id: 'three_bosses', icon: '🔱', name: 'Warlord',      desc: 'Defeat 3 bosses',                     category: 'Combat'      },
  { id: 'void_slayer',  icon: '🌑', name: 'Void Walker',  desc: 'Defeat the Eternal Void Sovereign',   category: 'Combat'      },
  { id: 'streak_3',     icon: '🔥', name: 'On Fire',      desc: 'Reach a 3-day streak',                category: 'Streak'      },
  { id: 'streak_7',     icon: '⚡', name: 'Unstoppable',  desc: 'Reach a 7-day streak',                category: 'Streak'      },
  { id: 'level_5',      icon: '⬆', name: 'Rising',       desc: 'Reach Level 5',                       category: 'Progression' },
  { id: 'level_10',     icon: '✦', name: 'Ascendant',    desc: 'Reach Level 10',                      category: 'Progression' },
];

function checkAchievements(event, ctx = {}) {
  const newlyUnlocked = [];

  function check(id, condition) {
    if (!state.achievements[id] && condition) {
      state.achievements[id] = true;
      const found = ACHIEVEMENTS.find(a => a.id === id);
      if (found) newlyUnlocked.push(found);
    }
  }

  if (event === 'session_complete') {
    check('first_blood',  state.totalSessions >= 1);
    check('ten_sessions', state.totalSessions >= 10);
    check('long_haul',    ctx.mins >= 90);
    check('no_damage',    ctx.noDamage);
    check('rare_hunter',  ctx.tier === 'Rare');
    check('boss_slayer',  ctx.isBoss && state.totalBossKills >= 1);
    check('three_bosses', state.totalBossKills >= 3);
    check('void_slayer',  ctx.enemyName === 'Eternal Void Sovereign');
  }

  if (event === 'streak_update') {
    check('streak_3', state.streak >= 3);
    check('streak_7', state.streak >= 7);
  }

  if (event === 'level_up') {
    check('level_5',  state.level >= 5);
    check('level_10', state.level >= 10);
  }

  // stagger multiple unlock toasts so they don't stack
  newlyUnlocked.forEach((a, i) => {
    setTimeout(() => {
      showAchievementToast(a);
      SFX.achievement();
    }, i * 1300);
  });

  if (newlyUnlocked.length) saveState();
}

function showAchievementToast(achievement) {
  const el = document.createElement('div');
  el.className = 'achievement-toast';
  el.innerHTML = `
    <span class="ach-toast-icon">${achievement.icon}</span>
    <span class="ach-toast-body">
      <span class="ach-toast-label">Feat Unlocked</span>
      <span class="ach-toast-name">${achievement.name}</span>
    </span>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  }, 3400);
}

function renderAchievements() {
  const grid    = document.getElementById('achievements-grid');
  const countEl = document.getElementById('achievements-count');
  const total   = Object.keys(state.achievements).length;

  countEl.textContent = `${total} / ${ACHIEVEMENTS.length} unlocked`;
  grid.innerHTML = '';

  const categories = [...new Set(ACHIEVEMENTS.map(a => a.category))];

  categories.forEach(cat => {
    const heading = document.createElement('p');
    heading.className   = 'ach-category';
    heading.textContent = cat;
    grid.appendChild(heading);

    const group = document.createElement('div');
    group.className = 'ach-group';

    ACHIEVEMENTS
      .filter(a => a.category === cat)
      .forEach(a => {
        const card = document.createElement('div');
        card.className = `ach-card${state.achievements[a.id] ? ' unlocked' : ''}`;
        card.innerHTML = `
          <span class="ach-icon">${a.icon}</span>
          <span class="ach-name">${a.name}</span>
          <span class="ach-desc">${a.desc}</span>
        `;
        group.appendChild(card);
      });

    grid.appendChild(group);
  });
}


// ════════════════════════════════════════
//  PLAYER STATS PAGE
// ════════════════════════════════════════

function formatTime(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function renderPlayerStats() {
  const grid = document.getElementById('player-stats-grid');

  const achievementsUnlocked = Object.keys(state.achievements).length;

  const rows = [
    { label: 'Sessions Completed', value: state.totalSessions,                       icon: '⚔' },
    { label: 'Time Focused',        value: formatTime(state.totalMinutesFocused),      icon: '⏱' },
    { label: 'Bosses Defeated',     value: state.totalBossKills,                      icon: '👑' },
    { label: 'Rare Kills',          value: state.totalRareKills,                      icon: '💀' },
    { label: 'Total XP Earned',     value: state.totalXpEarned,                       icon: '✦' },
    { label: 'Current Level',       value: state.level,                               icon: '⬆' },
    { label: 'Highest Streak',      value: `${state.highestStreak} days`,             icon: '🔥' },
    { label: 'Feats Unlocked',      value: `${achievementsUnlocked} / ${ACHIEVEMENTS.length}`, icon: '🏆' },
  ];

  grid.innerHTML = rows.map(row => `
    <div class="stat-row">
      <span class="stat-row-icon">${row.icon}</span>
      <span class="stat-row-label">${row.label}</span>
      <span class="stat-row-value">${row.value}</span>
    </div>
  `).join('');
}


// ════════════════════════════════════════
//  AMBIENT MUSIC
// ════════════════════════════════════════

let musicCtx    = null;
let musicNodes  = [];
let currentMood = null;

function getMusicCtx() {
  if (!musicCtx) musicCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (musicCtx.state === 'suspended') musicCtx.resume();
  return musicCtx;
}

function stopMusic() {
  musicNodes.forEach(node => { try { node.stop(); } catch (_) {} });
  musicNodes  = [];
  currentMood = null;
}

function startMusic(mood = 'calm') {
  if (state.muted)           return;
  if (currentMood === mood)  return;

  stopMusic();
  currentMood = mood;

  const ctx    = getMusicCtx();
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);
  master.connect(ctx.destination);

  // we push a fake "node" so stopMusic can fade it out cleanly
  musicNodes.push({
    stop: () => {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { try { master.disconnect(); } catch (_) {} }, 2500);
    }
  });

  if (mood === 'calm') {
    // warm detuned drone — four sine waves slightly offset for depth
    [55, 82.5, 110, 165].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type            = 'sine';
      osc.frequency.value = freq + (i * 0.3);
      vol.gain.value      = 0.15 - (i * 0.02);
      osc.connect(vol);
      vol.connect(master);
      osc.start();
      musicNodes.push(osc);
    });

    // very slow tremolo so the sound breathes
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value  = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    musicNodes.push(lfo);

  } else if (mood === 'boss') {
    // lower, slightly dissonant sawtooth rumble
    [36.7, 55, 73.4, 98].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type            = i % 2 === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      vol.gain.value      = 0.06 - (i * 0.01);
      osc.connect(vol);
      vol.connect(master);
      osc.start();
      musicNodes.push(osc);
    });

    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.6;
    lfoGain.gain.value  = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    musicNodes.push(lfo);

    // rhythmic heartbeat pulse every 2 seconds
    const pulse = setInterval(() => {
      if (currentMood !== 'boss') { clearInterval(pulse); return; }
      try {
        const p  = ctx.createOscillator();
        const pg = ctx.createGain();
        p.type = 'sine';
        p.frequency.value = 55;
        pg.gain.setValueAtTime(0.12, ctx.currentTime);
        pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
        p.connect(pg);
        pg.connect(ctx.destination);
        p.start();
        p.stop(ctx.currentTime + 0.5);
      } catch (_) {}
    }, 2000);

    musicNodes.push({ stop: () => clearInterval(pulse) });
  }
}


// ════════════════════════════════════════
//  SOUND EFFECTS
// ════════════════════════════════════════

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.15, gain = 0.25, delay = 0) {
  if (state.muted) return;
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
  start()       { playTone(110,'sine',0.3,0.2); playTone(220,'sine',0.2,0.15,0.15); },
  defeat()      { [330,440,550,660].forEach((f,i) => playTone(f,'sine',0.25,0.2,i*0.1)); },
  boss()        { [110,138,165,220].forEach((f,i) => playTone(f,'sawtooth',0.4,0.3,i*0.15)); },
  levelUp()     { [261,329,392,523].forEach((f,i) => playTone(f,'triangle',0.3,0.25,i*0.12)); },
  hpLoss()      { playTone(200,'sawtooth',0.15,0.2); playTone(140,'sawtooth',0.15,0.2,0.12); },
  death()       { [220,196,165,110].forEach((f,i) => playTone(f,'sawtooth',0.4,0.3,i*0.2)); },
  purchase()    { playTone(660,'sine',0.1,0.2); playTone(880,'sine',0.1,0.15,0.08); },
  tick()        { playTone(440,'sine',0.04,0.04); },
  ability()     { playTone(180,'square',0.2,0.15); playTone(155,'square',0.2,0.15,0.15); },
  regen()       { playTone(440,'sine',0.1,0.15); playTone(520,'sine',0.1,0.1,0.1); },
  challenge()   { [440,523,659].forEach((f,i) => playTone(f,'triangle',0.2,0.2,i*0.1)); },
  achievement() { [523,659,784,1047].forEach((f,i) => playTone(f,'triangle',0.3,0.2,i*0.1)); },
};


// ════════════════════════════════════════
//  PERSISTENCE
// ════════════════════════════════════════

function saveState() {
  localStorage.setItem('focusBattle', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('focusBattle');
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    // wipe saves that are too old to be compatible
    if (!saved.version || saved.version < STATE_VERSION) {
      console.info('Old save data found — resetting to fresh state.');
      localStorage.removeItem('focusBattle');
      return;
    }

    state = { ...DEFAULT_STATE, ...saved };
  } catch (err) {
    console.warn('Corrupted save — starting fresh.', err);
    localStorage.removeItem('focusBattle');
  }
}


// ════════════════════════════════════════
//  ENEMY & BOSS DATA
// ════════════════════════════════════════

const ENEMIES = [
  // ── original five ──
  {
    name: 'Distraction Goblin', hp: 80, xpReward: 40, tier: 'Common',
    ability: { type: 'xp_steal', label: 'XP Thief', desc: 'Steals 15 XP on quit', stealAmt: 15 },
  },
  {
    name: 'Notification Wraith', hp: 100, xpReward: 50, tier: 'Common',
    ability: { type: 'hp_drain', label: 'Soul Drain', desc: 'Drains 5 HP every 10 min', drainAmt: 5 },
  },
  {
    name: 'Procrastination Troll', hp: 130, xpReward: 65, tier: 'Uncommon',
    ability: { type: 'time_curse', label: 'Time Curse', desc: 'Adds 2 min at halfway' },
  },
  {
    name: 'Doom Scroll Demon', hp: 160, xpReward: 80, tier: 'Rare',
    ability: { type: 'xp_steal', label: 'XP Thief', desc: 'Steals 25 XP on quit', stealAmt: 25 },
  },
  {
    name: 'Brain Fog Specter', hp: 200, xpReward: 100, tier: 'Rare',
    ability: { type: 'hp_drain', label: 'Soul Drain', desc: 'Drains 8 HP every 10 min', drainAmt: 8 },
  },

  // ── four new enemies ──
  {
    name: 'Shadow Mimic', hp: 120, xpReward: 60, tier: 'Uncommon',
    ability: {
      type: 'focus_tax', label: 'Focus Tax',
      desc: 'Cuts your XP by 25% if you took damage',
    },
  },
  {
    name: 'Mind Leech', hp: 175, xpReward: 90, tier: 'Rare',
    ability: {
      type: 'hp_leech', label: 'HP Leech',
      desc: 'Drains your HP and heals itself', drainAmt: 6,
    },
  },
  {
    name: 'Void Parasite', hp: 110, xpReward: 55, tier: 'Uncommon',
    ability: {
      type: 'double_curse', label: 'Double Curse',
      desc: 'Adds 1 min at 1/3 and 2/3 mark',
    },
  },
  {
    name: 'Entropy Fiend', hp: 190, xpReward: 95, tier: 'Rare',
    ability: {
      type: 'xp_decay', label: 'XP Decay',
      desc: 'XP reward shrinks as time passes',
    },
  },
];

const BOSSES = [
  {
    name: 'The Procrastinator King', hp: 500, xpReward: 200, tier: 'Boss', isBoss: true,
    ability: { type: 'hp_drain', label: 'Royal Drain', desc: 'Drains 15 HP every 10 min', drainAmt: 15 },
  },
  {
    name: 'Lord of Infinite Scroll', hp: 700, xpReward: 300, tier: 'Boss', isBoss: true,
    ability: { type: 'xp_steal', label: 'Soul Harvest', desc: 'Steals 50 XP on quit', stealAmt: 50 },
  },
  {
    name: 'Eternal Void Sovereign', hp: 900, xpReward: 450, tier: 'Boss', isBoss: true,
    ability: { type: 'time_curse', label: 'Temporal Rift', desc: 'Adds 5 min at halfway' },
  },
];

const SHOP_ITEMS = [
  { id: 'potion',  name: 'Health Potion',     desc: 'Restore 30 HP instantly',        cost: 30, icon: '⚗', instant: true  },
  { id: 'elixir',  name: 'Elixir of Rebirth', desc: 'Restore 50 HP — even from zero', cost: 80, icon: '✦', instant: true  },
  { id: 'shield',  name: 'Iron Shield',       desc: 'Block the next HP penalty',       cost: 50, icon: '⬡', instant: false },
  { id: 'tome',    name: 'XP Tome',           desc: '+25 bonus XP on next completion', cost: 40, icon: '◈', instant: false },
  { id: 'charm',   name: 'Battle Charm',      desc: 'Negate the next XP steal',        cost: 60, icon: '⧖', instant: false },
  { id: 'crystal', name: 'Dark Crystal',      desc: '2× XP reward from next boss',     cost: 70, icon: '◇', instant: false },
];

const DAILY_CHALLENGES = [
  { id: 'complete_any',  desc: 'Complete any focus session',           target: 1, xpBonus: 40,  type: 'complete'      },
  { id: 'complete_long', desc: 'Complete a 50m or 90m session',        target: 1, xpBonus: 60,  type: 'complete_long' },
  { id: 'no_quit',       desc: 'Complete 2 sessions without quitting', target: 2, xpBonus: 70,  type: 'complete'      },
  { id: 'defeat_rare',   desc: 'Defeat a Rare enemy',                  target: 1, xpBonus: 80,  type: 'defeat_rare'   },
  { id: 'defeat_boss',   desc: 'Defeat a boss enemy',                  target: 1, xpBonus: 100, type: 'defeat_boss'   },
  { id: 'streak_focus',  desc: 'Complete a session on a 3+ day streak',target: 1, xpBonus: 90,  type: 'streak_focus'  },
];


// ════════════════════════════════════════
//  RUNTIME STATE
// ════════════════════════════════════════

let timerInterval    = null;    // the main countdown interval
let selectedMinutes  = 25;
let currentEnemy     = null;
let timeCurseAdded   = false;
let doubleCurseFirst = false;   // tracks whether the first double_curse tick fired
let regenTimer       = null;
let sessionNoDamage  = true;
let sessionXpPenalty = 0;       // accumulated penalty from xp_decay ability
let minutesElapsed   = 0;       // used for xp_decay calculation


// ════════════════════════════════════════
//  DRAWER
// ════════════════════════════════════════

document.getElementById('btn-menu').addEventListener('click', openDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

function openDrawer() {
  document.getElementById('drawer-overlay').classList.remove('hidden');
  document.getElementById('drawer-overlay').classList.add('visible');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('visible');
  document.getElementById('drawer').classList.remove('open');
  setTimeout(() => document.getElementById('drawer-overlay').classList.add('hidden'), 300);
}


// ════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════

function renderSettings() {
  document.getElementById('settings-mute-btn').textContent      = state.muted            ? 'Off' : 'On';
  document.getElementById('settings-particles-btn').textContent = state.particlesEnabled ? 'On'  : 'Off';
}

document.getElementById('settings-mute-btn').addEventListener('click', () => {
  state.muted = !state.muted;
  if (state.muted) stopMusic();
  else if (timerInterval) startMusic(currentEnemy?.isBoss ? 'boss' : 'calm');
  renderSettings();
  saveState();
});

document.getElementById('settings-particles-btn').addEventListener('click', () => {
  state.particlesEnabled = !state.particlesEnabled;
  renderSettings();
  saveState();
});

document.getElementById('settings-clear-history-btn').addEventListener('click', () => {
  if (!confirm('Clear your session history?')) return;
  state.sessionHistory = [];
  saveState();
  showMessage('Session history cleared.');
});

document.getElementById('settings-reset-btn').addEventListener('click', () => {
  if (!confirm('Reset ALL progress? This cannot be undone.')) return;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    stopMusic();
    endSession();
    hideEnemyCard();
    currentEnemy = null;
  }
  if (regenTimer) {
    clearInterval(regenTimer);
    regenTimer = null;
  }

  closeModal('death-screen');
  localStorage.removeItem('focusBattle');
  state = { ...DEFAULT_STATE };
  saveState();
  pickDailyChallenge();
  updateStats();
  resetTimer();
  renderDailyChallenge();
  showMessage('Save data reset. Starting fresh!');
});


// ════════════════════════════════════════
//  STATS UI (top bar)
// ════════════════════════════════════════

function updateStats() {
  document.getElementById('level').textContent      = state.level;
  document.getElementById('hp-val').textContent     = state.hp;
  document.getElementById('xp-val').textContent     = state.xp;
  document.getElementById('streak-val').textContent = state.streak;

  // HP bar: straight 0–100
  document.getElementById('hp-fill').style.width = `${Math.max(0, state.hp)}%`;

  // XP bar: progress within the current level range only
  const xpForCurrentLevel = (state.level - 1) * XP_PER_LEVEL;
  const xpForNextLevel    = state.level * XP_PER_LEVEL;
  const progress = (state.xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel);
  document.getElementById('xp-fill').style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;

  // show the boss warning when the next session will be a boss
  const isBossNext = state.level % 5 === 0 && !timerInterval;
  document.getElementById('boss-incoming-stat').style.display = isBossNext ? 'flex' : 'none';

  renderActiveItems();
  saveState();
}

function renderActiveItems() {
  const container = document.getElementById('active-items');
  container.innerHTML = '';

  const activeBadges = [
    [state.shieldActive,  '⬡ Shield',   ''],
    [state.xpBoostActive, '◈ XP Boost', 'xp-badge'],
    [state.charmActive,   '⧖ Charm',    ''],
    [state.crystalActive, '◇ Crystal',  'xp-badge'],
  ];

  activeBadges.forEach(([isActive, label, extraClass]) => {
    if (!isActive) return;
    const badge = document.createElement('span');
    badge.className   = `item-badge ${extraClass}`.trim();
    badge.textContent = label;
    container.appendChild(badge);
  });
}


// ════════════════════════════════════════
//  XP & HP
// ════════════════════════════════════════

function gainXP(amount) {
  state.xp          += amount;
  state.totalXpEarned += amount;

  // level up if we passed the threshold
  while (state.xp >= state.level * XP_PER_LEVEL) {
    state.level++;
    SFX.levelUp();
    showMessage(`⬆ Level Up! You are now Level ${state.level}!`);
    checkAchievements('level_up');
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

  sessionNoDamage = false;
  SFX.hpLoss();
  state.hp = Math.max(0, state.hp - amount);
  updateStats();

  if (state.hp === 0) triggerDeath();
}


// ════════════════════════════════════════
//  HP REGEN
// ════════════════════════════════════════

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
  const totalExpected = Math.min(
    Math.floor(elapsed / REGEN_INTERVAL_MS) * REGEN_HP_AMOUNT,
    REGEN_CAP
  );
  const toGive = totalExpected - (state.regenHpGiven || 0);

  if (toGive > 0) {
    state.hp           = Math.min(REGEN_CAP, (state.hp || 0) + toGive);
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
  }, 10000);
}

function updateRegenCountdown() {
  const el = document.getElementById('regen-countdown');
  if (!el || !state.lastDeathTime) return;

  if (state.hp >= REGEN_CAP) {
    el.textContent = 'Max regen reached';
    return;
  }

  const elapsed = Date.now() - state.lastDeathTime;
  const msLeft  = REGEN_INTERVAL_MS - (elapsed % REGEN_INTERVAL_MS);
  const mins    = Math.floor(msLeft / 60000);
  const secs    = Math.floor((msLeft % 60000) / 1000);
  el.textContent = `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

function showDeathScreen() {
  updateRegenCountdown();
  openModal('death-screen');
}

function hideDeathScreen() {
  closeModal('death-screen');
  if (regenTimer) {
    clearInterval(regenTimer);
    regenTimer = null;
  }
}


// ════════════════════════════════════════
//  STREAK
// ════════════════════════════════════════

function getTodayStr()     { return new Date().toISOString().split('T')[0]; }
function getYesterdayStr() { return new Date(Date.now() - 86400000).toISOString().split('T')[0]; }

function handleStreak() {
  const today = getTodayStr();
  if (state.lastSessionDate === today) return 0;  // already had a session today, no bonus

  if (state.lastSessionDate === getYesterdayStr()) {
    state.streak++;
  } else {
    state.streak = 1;
  }

  state.lastSessionDate = today;

  // keep track of the best streak ever
  if (state.streak > state.highestStreak) {
    state.highestStreak = state.streak;
  }

  checkAchievements('streak_update');
  return Math.min(state.streak * 5, 25);
}


// ════════════════════════════════════════
//  DAILY CHALLENGE
// ════════════════════════════════════════

function pickDailyChallenge() {
  const today = getTodayStr();
  if (state.dailyChallenge?.date === today) return;

  // deterministic pick based on the date so it's the same on every refresh
  const seed   = today.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const picked = DAILY_CHALLENGES[seed % DAILY_CHALLENGES.length];
  state.dailyChallenge = { ...picked, progress: 0, date: today };
  saveState();
}

function renderDailyChallenge() {
  const dc = state.dailyChallenge;
  if (!dc) return;

  document.getElementById('dc-desc').textContent     = dc.desc;
  document.getElementById('dc-progress').textContent = `${dc.progress} / ${dc.target}`;

  const statusEl    = document.getElementById('dc-status');
  const panelEl     = document.getElementById('daily-challenge');
  const isDone      = dc.progress >= dc.target;

  statusEl.textContent = isDone ? `✓ +${dc.xpBonus} XP` : `+${dc.xpBonus} XP`;
  statusEl.className   = isDone ? 'dc-done' : '';
  panelEl.classList.toggle('dc-complete', isDone);
}

function tickChallenge(event, ctx = {}) {
  const dc = state.dailyChallenge;
  if (!dc || dc.progress >= dc.target) return;

  let progress = false;

  if (dc.type === 'complete'       && event === 'session_complete')                    progress = true;
  if (dc.type === 'complete_long'  && event === 'session_complete' && ctx.mins >= 50)  progress = true;
  if (dc.type === 'defeat_rare'    && event === 'session_complete' && ctx.tier === 'Rare') progress = true;
  if (dc.type === 'defeat_boss'    && event === 'session_complete' && ctx.isBoss)      progress = true;
  if (dc.type === 'streak_focus'   && event === 'session_complete' && state.streak >= 3) progress = true;

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


// ════════════════════════════════════════
//  BOSS SYSTEM
// ════════════════════════════════════════

function isBossLevel() {
  return state.level % 5 === 0;
}

function getBoss() {
  const index = Math.floor(state.level / 5) - 1;
  const base  = BOSSES[index % BOSSES.length];
  const cycle = Math.floor(index / BOSSES.length);   // how many times we've cycled through all bosses

  return {
    ...base,
    ability:  { ...base.ability },
    hp:       Math.round(base.hp * (1 + cycle * 0.5)),
    xpReward: Math.round(base.xpReward * (1 + cycle * 0.3)),
  };
}


// ════════════════════════════════════════
//  ENEMY SYSTEM
// ════════════════════════════════════════

function spawnEnemy() {
  const template = isBossLevel()
    ? getBoss()
    : ENEMIES[Math.floor(Math.random() * ENEMIES.length)];

  currentEnemy = {
    ...template,
    ability:   { ...template.ability },
    currentHp: template.hp,
    maxHp:     template.hp,
  };

  // reset per-session flags
  timeCurseAdded   = false;
  doubleCurseFirst = false;
  sessionNoDamage  = true;
  sessionXpPenalty = 0;
  minutesElapsed   = 0;

  // update the card
  document.getElementById('enemy-name').textContent          = currentEnemy.name;
  document.getElementById('enemy-ability-label').textContent = currentEnemy.ability.label;
  document.getElementById('enemy-ability-desc').textContent  = currentEnemy.ability.desc;

  const badge       = document.getElementById('enemy-tier-badge');
  badge.textContent = currentEnemy.tier;
  badge.className   = `tier-${currentEnemy.tier.toLowerCase()}`;

  const card = document.getElementById('enemy-card');
  card.classList.toggle('boss-card', !!currentEnemy.isBoss);

  // start the right music and particle mode
  if (currentEnemy.isBoss) {
    SFX.boss();
    startMusic('boss');
    bossParticleMode = true;
  } else {
    startMusic('calm');
    bossParticleMode = false;
  }

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

function healEnemy(amount) {
  if (!currentEnemy) return;
  currentEnemy.currentHp = Math.min(currentEnemy.maxHp, currentEnemy.currentHp + amount);
  updateEnemyBar();
}

// called at relevant moments during a session
// returns an object if the timer needs to change, otherwise null
function triggerEnemyAbility(context) {
  if (!currentEnemy) return null;
  const ab = currentEnemy.ability;

  // ── XP steal on quit ──
  if (ab.type === 'xp_steal' && context === 'quit') {
    if (state.charmActive) {
      state.charmActive = false;
      SFX.ability();
      showMessage('⧖ Battle Charm deflected the XP steal!');
      updateStats();
      return null;
    }
    const amt = ab.stealAmt || 15;
    state.xp  = Math.max(0, state.xp - amt);
    SFX.ability();
    showMessage(`💀 ${currentEnemy.name} stole ${amt} XP!`);
    updateStats();
  }

  // ── HP drain every 10 minutes ──
  if (ab.type === 'hp_drain' && context === 'tick_10min') {
    loseHP(ab.drainAmt || 5);
    showMessage(`🩸 ${currentEnemy.name} drained ${ab.drainAmt} HP!`);
  }

  // ── HP leech: drains you AND heals the enemy ──
  if (ab.type === 'hp_leech' && context === 'tick_10min') {
    const drainAmt = ab.drainAmt || 6;
    loseHP(drainAmt);
    healEnemy(Math.floor(drainAmt / 2));
    showMessage(`🩸 ${currentEnemy.name} leeched ${drainAmt} HP and healed itself!`);
  }

  // ── Standard time curse at halfway ──
  if (ab.type === 'time_curse' && context === 'halfway' && !timeCurseAdded) {
    timeCurseAdded = true;
    const addMins = currentEnemy.isBoss ? 5 : 2;
    SFX.ability();
    showMessage(`⏳ Time Curse! +${addMins} minutes added!`);
    return { addSeconds: addMins * 60 };
  }

  // ── Double curse: fires at the 1/3 and 2/3 marks ──
  if (ab.type === 'double_curse') {
    const oneThird   = Math.floor(selectedMinutes / 3);
    const twoThirds  = Math.floor((selectedMinutes * 2) / 3);

    if (context === 'tick_every_min') {
      if (minutesElapsed === oneThird && !doubleCurseFirst) {
        doubleCurseFirst = true;
        SFX.ability();
        showMessage(`⏳ Double Curse! +1 minute added!`);
        return { addSeconds: 60 };
      }
      if (minutesElapsed === twoThirds && doubleCurseFirst) {
        SFX.ability();
        showMessage(`⏳ Double Curse strikes again! +1 minute!`);
        return { addSeconds: 60 };
      }
    }
  }

  // ── XP decay: accumulates a penalty per 10-minute block ──
  if (ab.type === 'xp_decay' && context === 'tick_10min') {
    sessionXpPenalty += 8;
    showMessage(`⚡ Entropy Fiend's decay grows stronger… (-${sessionXpPenalty} XP at end)`);
  }

  return null;
}

function defeatEnemy() {
  if (!currentEnemy) return;

  currentEnemy.currentHp = 0;
  updateEnemyBar();

  state.totalSessions++;
  state.totalMinutesFocused += selectedMinutes;
  if (currentEnemy.isBoss)          state.totalBossKills++;
  if (currentEnemy.tier === 'Rare') state.totalRareKills++;

  const streakBonus  = handleStreak();
  const tomeBonus    = state.xpBoostActive ? 25 : 0;
  const crystalBonus = (state.crystalActive && currentEnemy.isBoss) ? currentEnemy.xpReward : 0;

  // apply focus_tax penalty
  const taxPenalty  = (currentEnemy.ability.type === 'focus_tax' && !sessionNoDamage)
    ? Math.floor(currentEnemy.xpReward * 0.25)
    : 0;

  if (state.xpBoostActive)                            state.xpBoostActive = false;
  if (state.crystalActive && currentEnemy.isBoss)     state.crystalActive = false;

  const rawXp  = currentEnemy.xpReward;
  const earned = Math.max(0, rawXp + tomeBonus + streakBonus + crystalBonus - taxPenalty - sessionXpPenalty);

  const bonusNotes = [];
  if (tomeBonus)     bonusNotes.push(`+${tomeBonus} Tome`);
  if (streakBonus)   bonusNotes.push(`+${streakBonus} Streak`);
  if (crystalBonus)  bonusNotes.push(`+${crystalBonus} Crystal`);
  if (taxPenalty)    bonusNotes.push(`-${taxPenalty} Tax`);
  if (sessionXpPenalty > 0) bonusNotes.push(`-${sessionXpPenalty} Decay`);

  SFX.defeat();
  stopMusic();
  endSession();
  gainXP(earned);

  let msg = `⚔ ${currentEnemy.name} defeated! +${earned} XP`;
  if (bonusNotes.length) msg += ` (${bonusNotes.join(', ')})`;
  showMessage(msg);

  bossParticleMode = false;

  checkAchievements('session_complete', {
    mins:      selectedMinutes,
    tier:      currentEnemy.tier,
    isBoss:    !!currentEnemy.isBoss,
    enemyName: currentEnemy.name,
    noDamage:  sessionNoDamage,
  });

  tickChallenge('session_complete', {
    mins:   selectedMinutes,
    tier:   currentEnemy.tier,
    isBoss: !!currentEnemy.isBoss,
  });

  pushHistory({ completed: true, xpGained: earned });
  hideEnemyCard();
  currentEnemy = null;
}

function hideEnemyCard() {
  const card = document.getElementById('enemy-card');
  card.classList.remove('visible');
  setTimeout(() => {
    card.classList.add('hidden');
    card.classList.remove('boss-card');
  }, 500);
}

function endSession() {
  document.body.classList.remove('session-active');
  document.getElementById('start-btn').textContent = 'Start Focus';
}


// ════════════════════════════════════════
//  SESSION HISTORY
// ════════════════════════════════════════

function pushHistory({ completed, xpGained }) {
  const now = new Date();

  state.sessionHistory.unshift({
    date:      now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time:      now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    enemyName: currentEnemy ? currentEnemy.name     : '—',
    tier:      currentEnemy ? currentEnemy.tier      : '—',
    isBoss:    currentEnemy ? !!currentEnemy.isBoss  : false,
    duration:  selectedMinutes,
    xpGained,
    completed,
  });

  if (state.sessionHistory.length > 20) state.sessionHistory.pop();
  saveState();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (!state.sessionHistory.length) {
    list.innerHTML = '<p class="inv-empty">No sessions yet.</p>';
    return;
  }

  state.sessionHistory.forEach(entry => {
    const row = document.createElement('div');
    row.className = [
      'history-row',
      entry.isBoss    ? 'boss-row' : '',
      !entry.completed ? 'quit-row' : '',
    ].filter(Boolean).join(' ');

    row.innerHTML = `
      <div class="history-left">
        <span class="history-enemy">${entry.enemyName}</span>
        <span class="history-meta">${entry.date} · ${entry.time} · ${entry.duration}m</span>
      </div>
      <div class="history-right">
        <span class="history-xp">+${entry.xpGained} XP</span>
        <span class="history-result ${entry.completed ? 'won' : 'lost'}">${entry.completed ? 'WIN' : 'QUIT'}</span>
      </div>
    `;
    list.appendChild(row);
  });
}


// ════════════════════════════════════════
//  TIMER
// ════════════════════════════════════════

function resetTimer() {
  document.getElementById('timer').textContent = formatTimerDisplay(selectedMinutes * 60);
}

function formatTimerDisplay(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' + s : s}`;
}


// ════════════════════════════════════════
//  CUSTOM TIMER
// ════════════════════════════════════════

const customRow   = document.getElementById('custom-input-row');
const customInput = document.getElementById('custom-minutes-input');

document.getElementById('btn-custom').addEventListener('click', () => {
  if (timerInterval) return;   // can't change duration mid-session

  // toggle the input row
  const isOpen = !customRow.classList.contains('hidden');
  customRow.classList.toggle('hidden', isOpen);

  if (!isOpen) {
    customInput.focus();
    // deactivate the preset buttons
    document.querySelectorAll('.dur-btn[data-min]').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-custom').classList.add('active');
  }
});

customInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;

  const value = parseInt(customInput.value);
  if (isNaN(value) || value < 5 || value > 180) {
    showMessage('Please enter a number between 5 and 180.');
    return;
  }

  selectedMinutes = value;
  resetTimer();
  customRow.classList.add('hidden');
  customInput.value = '';
  showMessage(`Timer set to ${selectedMinutes} minutes.`);
});


// ════════════════════════════════════════
//  SESSION START / STOP
// ════════════════════════════════════════

document.getElementById('start-btn').addEventListener('click', () => {
  if (timerInterval) return;
  if (state.hp <= 0) {
    showMessage('💀 No HP. Visit the Apothecary or wait to regen.');
    showDeathScreen();
    return;
  }

  spawnEnemy();
  SFX.start();

  document.body.classList.add('session-active');
  document.getElementById('start-btn').textContent = 'Focusing…';

  let totalSeconds  = selectedMinutes * 60;
  minutesElapsed    = 0;

  const dmgPerMinute = Math.ceil(currentEnemy.maxHp / selectedMinutes);
  const timerEl      = document.getElementById('timer');

  timerInterval = setInterval(() => {
    totalSeconds--;
    timerEl.textContent = formatTimerDisplay(totalSeconds);

    // every time a full minute ticks
    if (totalSeconds > 0 && totalSeconds % 60 === 0) {
      minutesElapsed++;
      damageEnemy(dmgPerMinute);
      SFX.tick();

      // check double_curse every minute
      const dc = triggerEnemyAbility('tick_every_min');
      if (dc?.addSeconds) totalSeconds += dc.addSeconds;

      // check 10-minute abilities
      if (minutesElapsed % 10 === 0) {
        const result = triggerEnemyAbility('tick_10min');
        if (result?.addSeconds) totalSeconds += result.addSeconds;
      }

      // halfway check for standard time_curse
      const halfwayPoint = Math.floor(selectedMinutes / 2);
      if (minutesElapsed === halfwayPoint) {
        const result = triggerEnemyAbility('halfway');
        if (result?.addSeconds) totalSeconds += result.addSeconds;
      }
    }

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      defeatEnemy();
      resetTimer();
    }
  }, 1000);
});

document.getElementById('btn-stop').addEventListener('click', () => {
  if (!timerInterval) return;

  clearInterval(timerInterval);
  timerInterval = null;
  stopMusic();
  endSession();
  bossParticleMode = false;

  triggerEnemyAbility('quit');
  loseHP(HP_LOSS_ON_QUIT);

  if (state.hp > 0) showMessage(`⚠ Session abandoned! -${HP_LOSS_ON_QUIT} HP`);

  pushHistory({ completed: false, xpGained: 0 });
  hideEnemyCard();
  currentEnemy = null;
  resetTimer();
});


// ════════════════════════════════════════
//  DURATION PICKER (presets)
// ════════════════════════════════════════

document.querySelectorAll('.dur-btn[data-min]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (timerInterval) return;

    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    selectedMinutes = parseInt(btn.dataset.min);
    customRow.classList.add('hidden');
    customInput.value = '';
    resetTimer();
  });
});


// ════════════════════════════════════════
//  SHOP
// ════════════════════════════════════════

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

    const isDisabled = !canAfford || alreadyOwned || alreadyActive;
    const btnLabel   = alreadyActive ? 'Active' : alreadyOwned ? 'Owned' : `${item.cost} XP`;

    const card = document.createElement('div');
    card.className = [
      'shop-card',
      !canAfford               ? 'locked'      : '',
      alreadyActive || alreadyOwned ? 'active-item' : '',
    ].filter(Boolean).join(' ');

    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${isDisabled ? 'disabled' : ''}>${btnLabel}</button>
    `;

    if (!isDisabled) {
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
      showMessage('⚗ +30 HP');
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


// ════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════

function renderInventory() {
  const grid = document.getElementById('inv-items-grid');
  grid.innerHTML = '';

  if (!state.inventory.length) {
    grid.innerHTML = '<p class="inv-empty">Your inventory is empty.</p>';
    return;
  }

  // count duplicates so we can show "×2" etc.
  const counts = {};
  state.inventory.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  Object.entries(counts).forEach(([id, count]) => {
    const item = SHOP_ITEMS.find(s => s.id === id);
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
      card.querySelector('.shop-buy-btn').addEventListener('click', () => {
        equipItem(id);
        renderInventory();
      });
    }

    grid.appendChild(card);
  });
}

function equipItem(id) {
  const index = state.inventory.indexOf(id);
  if (index === -1) return;
  state.inventory.splice(index, 1);

  const effects = {
    shield:  ['shieldActive',  '⬡ Shield equipped.'],
    tome:    ['xpBoostActive', '◈ XP Tome activated.'],
    charm:   ['charmActive',   '⧖ Battle Charm equipped.'],
    crystal: ['crystalActive', '◇ Dark Crystal equipped.'],
  };

  if (effects[id]) {
    state[effects[id][0]] = true;
    SFX.purchase();
    showMessage(effects[id][1]);
  }

  updateStats();
}


// ════════════════════════════════════════
//  MODAL / DRAWER WIRING
// ════════════════════════════════════════

// one helper so we don't register duplicate listeners
function wire(openBtnId, modalId, closeBtnId, onOpen) {
  document.getElementById(openBtnId).addEventListener('click', () => {
    closeDrawer();
    if (onOpen) onOpen();
    openModal(modalId);
  });
  document.getElementById(closeBtnId).addEventListener('click', () => closeModal(modalId));
  document.getElementById(modalId).addEventListener('click', function (e) {
    if (e.target === this) closeModal(modalId);
  });
}

wire('btn-shop',         'shop-modal',          'shop-close',          renderShop);
wire('btn-inv',          'inv-modal',           'inv-close',           renderInventory);
wire('btn-history',      'history-modal',       'history-close',       renderHistory);
wire('btn-achievements', 'achievements-modal',  'achievements-close',  renderAchievements);
wire('btn-player-stats', 'player-stats-modal',  'player-stats-close',  renderPlayerStats);
wire('btn-settings',     'settings-modal',      'settings-close',      renderSettings);

document.getElementById('death-shop-btn').addEventListener('click', () => {
  renderShop();
  openModal('shop-modal');
});


// ════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════

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


// ════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════

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


// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════

loadState();
checkRegen();
pickDailyChallenge();
updateStats();
resetTimer();
renderDailyChallenge();
initParticles();
drawParticles();

if (state.hp <= 0) {
  showDeathScreen();
  startRegenInterval();
}