const STATE_VERSION     = 6;
const XP_PER_LEVEL      = 100;
const HP_LOSS_ON_QUIT   = 20;
const REGEN_HP_AMOUNT   = 5;
const REGEN_INTERVAL_MS = 15 * 60 * 1000;
const REGEN_CAP         = 50;

const DEFAULT_STATE = {
  version:             STATE_VERSION,
  hp:                  100,
  xp:                  0,
  level:               1,
  shieldActive:        false,
  xpBoostActive:       false,
  charmActive:         false,
  crystalActive:       false,
  inventory:           [],
  streak:              0,
  highestStreak:       0,
  lastSessionDate:     null,
  lastDeathTime:       null,
  regenHpGiven:        0,
  sessionHistory:      [],
  dailyChallenge:      null,
  achievements:        {},
  totalSessions:       0,
  totalBossKills:      0,
  totalRareKills:      0,
  totalMinutesFocused: 0,
  totalXpEarned:       0,
  muted:               false,
  particlesEnabled:    true,
};

let state = { ...DEFAULT_STATE };


// ════════════════════════════════════════
//  INTRO SCREEN
// ════════════════════════════════════════

function initIntro() {
  const intro = document.getElementById('intro');

  const dismiss = () => {
    intro.classList.add('fading');
    // wait for the CSS transition to finish before removing
    setTimeout(() => intro.remove(), 900);
  };

  // auto-dismiss after 3 seconds, or whenever the user clicks
  setTimeout(dismiss, 3000);
  intro.addEventListener('click', dismiss);
}


// ════════════════════════════════════════
//  ATTACK ANIMATIONS
// ════════════════════════════════════════

// shakes the big timer number — called when a time curse hits or any big ability fires
function shakeTimer() {
  const el = document.getElementById('timer');
  el.classList.remove('shake');
  // force a reflow so removing + re-adding the class actually restarts the animation
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// flashes the whole screen a color — 'hp' for red, 'xp' for gold
function flashScreen(type) {
  const el = document.getElementById('flash-overlay');
  el.className = '';
  void el.offsetWidth;
  el.classList.add(`flash-${type}`);
  setTimeout(() => { el.className = ''; }, 450);
}


// ════════════════════════════════════════
//  PARTICLES
// ════════════════════════════════════════

const bgCanvas = document.getElementById('bg-canvas');
const pCtx     = bgCanvas.getContext('2d');
let particles        = [];
let bossParticleMode = false;

function resizeCanvas() {
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

function makeParticle() {
  return {
    x:       Math.random() * bgCanvas.width,
    y:       Math.random() * bgCanvas.height,
    size:    Math.random() * 1.4 + 0.4,
    speedX:  (Math.random() - 0.5) * 0.25,
    speedY:  -(Math.random() * 0.35 + 0.08),
    opacity: Math.random() * 0.25 + 0.04,
    phase:   Math.random() * Math.PI * 2,
  };
}

function initParticles() {
  resizeCanvas();
  particles = Array.from({ length: 65 }, makeParticle);
}

function drawParticles() {
  if (!state.particlesEnabled) {
    pCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    requestAnimationFrame(drawParticles);
    return;
  }

  pCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

  const now   = Date.now() / 1000;
  const speed = bossParticleMode ? 2.8 : 1;
  const color = bossParticleMode ? '255, 195, 70' : '255, 255, 255';

  particles.forEach(p => {
    const pulse = Math.sin(now * 0.7 + p.phase) * 0.07;
    const alpha = Math.min(0.45, Math.max(0, p.opacity + pulse));

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fillStyle = `rgba(${color}, ${alpha})`;
    pCtx.fill();

    p.x += p.speedX * speed;
    p.y += p.speedY * speed;

    if (p.y < -5)                  { p.y = bgCanvas.height + 5; p.x = Math.random() * bgCanvas.width; }
    if (p.x < -5)                   p.x = bgCanvas.width + 5;
    if (p.x > bgCanvas.width + 5)   p.x = -5;
  });

  requestAnimationFrame(drawParticles);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  particles.forEach(p => {
    p.x = Math.random() * bgCanvas.width;
    p.y = Math.random() * bgCanvas.height;
  });
});


// ════════════════════════════════════════
//  SOUND VISUALIZER
// ════════════════════════════════════════

const vizCanvas = document.getElementById('viz-canvas');
const vizCtx    = vizCanvas.getContext('2d');

// we tap off the music master gain node with this
let analyser = null;

function getAnalyser() {
  if (analyser) return analyser;
  const ctx = getMusicCtx();
  analyser = ctx.createAnalyser();
  analyser.fftSize             = 64;   // 32 usable frequency bins
  analyser.smoothingTimeConstant = 0.82; // smooth out the movement a bit
  analyser.connect(ctx.destination);
  return analyser;
}

function drawVisualizer() {
  requestAnimationFrame(drawVisualizer);

  vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);

  // don't draw anything if music isn't playing
  if (!analyser || !currentMood) return;

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  const barCount = 16;
  const barW     = 3;
  const gap      = 4;
  const totalW   = barCount * (barW + gap) - gap;
  const startX   = (vizCanvas.width - totalW) / 2;
  const color    = bossParticleMode ? '255, 195, 70' : '255, 255, 255';

  for (let i = 0; i < barCount; i++) {
    // sample from the lower half of the spectrum since bass is more visible
    const val   = data[Math.floor(i * (data.length * 0.6) / barCount)];
    const h     = Math.max(2, (val / 255) * vizCanvas.height * 0.88);
    const x     = startX + i * (barW + gap);
    const y     = (vizCanvas.height - h) / 2;
    const alpha = 0.1 + (val / 255) * 0.65;

    vizCtx.fillStyle = `rgba(${color}, ${alpha})`;
    vizCtx.fillRect(x, y, barW, h);
  }
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
  musicNodes.forEach(n => { try { n.stop(); } catch (_) {} });
  musicNodes  = [];
  currentMood = null;
}

function startMusic(mood = 'calm') {
  if (state.muted)          return;
  if (currentMood === mood) return;

  stopMusic();
  currentMood = mood;

  const ctx     = getMusicCtx();
  const master  = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 3);

  // route through the analyser so the visualizer can read it
  master.connect(getAnalyser());

  musicNodes.push({
    stop: () => {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => { try { master.disconnect(); } catch (_) {} }, 2500);
    }
  });

  if (mood === 'calm') {
    // warm detuned drone — four sines sitting slightly apart for depth
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

    // very slow LFO so the whole thing breathes
    const lfo     = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.12;
    lfoGain.gain.value  = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();
    musicNodes.push(lfo);

  } else if (mood === 'boss') {
    // lower, slightly dissonant sawtooth rumble for tension
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

    // the heartbeat thud every 2 seconds
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
    if (!saved.version || saved.version < STATE_VERSION) {
      console.info('Old save — starting fresh.');
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
  {
    name: 'Shadow Mimic', hp: 120, xpReward: 60, tier: 'Uncommon',
    ability: { type: 'focus_tax', label: 'Focus Tax', desc: 'Cuts XP by 25% if you took damage' },
  },
  {
    name: 'Mind Leech', hp: 175, xpReward: 90, tier: 'Rare',
    ability: { type: 'hp_leech', label: 'HP Leech', desc: 'Drains your HP and heals itself', drainAmt: 6 },
  },
  {
    name: 'Void Parasite', hp: 110, xpReward: 55, tier: 'Uncommon',
    ability: { type: 'double_curse', label: 'Double Curse', desc: 'Adds 1 min at 1/3 and 2/3 mark' },
  },
  {
    name: 'Entropy Fiend', hp: 190, xpReward: 95, tier: 'Rare',
    ability: { type: 'xp_decay', label: 'XP Decay', desc: 'XP reward shrinks as time passes' },
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
  { id: 'potion',  name: 'Health Potion',     desc: 'Restore 30 HP instantly',        cost: 30,  icon: '⚗', instant: true  },
  { id: 'elixir',  name: 'Elixir of Rebirth', desc: 'Restore 50 HP — even from zero', cost: 80,  icon: '✦', instant: true  },
  { id: 'shield',  name: 'Iron Shield',       desc: 'Block the next HP penalty',       cost: 50,  icon: '⬡', instant: false },
  { id: 'tome',    name: 'XP Tome',           desc: '+25 bonus XP on next completion', cost: 40,  icon: '◈', instant: false },
  { id: 'charm',   name: 'Battle Charm',      desc: 'Negate the next XP steal',        cost: 60,  icon: '⧖', instant: false },
  { id: 'crystal', name: 'Dark Crystal',      desc: '2× XP reward from next boss',     cost: 70,  icon: '◇', instant: false },
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

let timerInterval    = null;
let selectedMinutes  = 25;
let currentEnemy     = null;
let timeCurseAdded   = false;
let doubleCurseFirst = false;
let regenTimer       = null;
let sessionNoDamage  = true;
let sessionXpPenalty = 0;
let minutesElapsed   = 0;


// ════════════════════════════════════════
//  ACHIEVEMENTS
// ════════════════════════════════════════

const ACHIEVEMENTS = [
  { id: 'first_blood',  icon: '⚔', name: 'First Blood',  desc: 'Complete your first session',        category: 'Session'     },
  { id: 'ten_sessions', icon: '📜', name: 'Veteran',      desc: 'Complete 10 sessions',               category: 'Session'     },
  { id: 'long_haul',    icon: '⏳', name: 'Long Haul',    desc: 'Complete a 90-minute session',       category: 'Session'     },
  { id: 'no_damage',    icon: '🛡', name: 'Untouchable',  desc: 'Finish a session without losing HP', category: 'Session'     },
  { id: 'rare_hunter',  icon: '💀', name: 'Rare Hunter',  desc: 'Defeat a Rare enemy',                category: 'Combat'      },
  { id: 'boss_slayer',  icon: '👑', name: 'Boss Slayer',  desc: 'Defeat your first boss',             category: 'Combat'      },
  { id: 'three_bosses', icon: '🔱', name: 'Warlord',      desc: 'Defeat 3 bosses',                    category: 'Combat'      },
  { id: 'void_slayer',  icon: '🌑', name: 'Void Walker',  desc: 'Defeat the Eternal Void Sovereign',  category: 'Combat'      },
  { id: 'streak_3',     icon: '🔥', name: 'On Fire',      desc: 'Reach a 3-day streak',               category: 'Streak'      },
  { id: 'streak_7',     icon: '⚡', name: 'Unstoppable',  desc: 'Reach a 7-day streak',               category: 'Streak'      },
  { id: 'level_5',      icon: '⬆', name: 'Rising',       desc: 'Reach Level 5',                      category: 'Progression' },
  { id: 'level_10',     icon: '✦', name: 'Ascendant',    desc: 'Reach Level 10',                     category: 'Progression' },
];

function checkAchievements(event, ctx = {}) {
  const newUnlocks = [];

  const check = (id, condition) => {
    if (!state.achievements[id] && condition) {
      state.achievements[id] = true;
      const found = ACHIEVEMENTS.find(a => a.id === id);
      if (found) newUnlocks.push(found);
    }
  };

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

  newUnlocks.forEach((a, i) => {
    setTimeout(() => { showAchievementToast(a); SFX.achievement(); }, i * 1300);
  });

  if (newUnlocks.length) saveState();
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
    ACHIEVEMENTS.filter(a => a.category === cat).forEach(a => {
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
//  PLAYER STATS
// ════════════════════════════════════════

function formatTime(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function renderPlayerStats() {
  const grid = document.getElementById('player-stats-grid');

  const rows = [
    { icon: '⚔', label: 'Sessions Completed', value: state.totalSessions },
    { icon: '⏱', label: 'Time Focused',        value: formatTime(state.totalMinutesFocused) },
    { icon: '👑', label: 'Bosses Defeated',     value: state.totalBossKills },
    { icon: '💀', label: 'Rare Kills',          value: state.totalRareKills },
    { icon: '✦', label: 'Total XP Earned',     value: state.totalXpEarned },
    { icon: '⬆', label: 'Current Level',       value: state.level },
    { icon: '🔥', label: 'Highest Streak',      value: `${state.highestStreak} days` },
    { icon: '🏆', label: 'Feats Unlocked',      value: `${Object.keys(state.achievements).length} / ${ACHIEVEMENTS.length}` },
  ];

  grid.innerHTML = rows.map(r => `
    <div class="stat-row">
      <span class="stat-row-icon">${r.icon}</span>
      <span class="stat-row-label">${r.label}</span>
      <span class="stat-row-value">${r.value}</span>
    </div>
  `).join('');
}


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
  document.getElementById('settings-particles-btn').textContent = state.particlesEnabled  ? 'On'  : 'Off';
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
  if (regenTimer) { clearInterval(regenTimer); regenTimer = null; }

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
//  STATS BAR (top)
// ════════════════════════════════════════

function updateStats() {
  document.getElementById('level').textContent      = state.level;
  document.getElementById('hp-val').textContent     = state.hp;
  document.getElementById('xp-val').textContent     = state.xp;
  document.getElementById('streak-val').textContent = state.streak;

  document.getElementById('hp-fill').style.width = `${Math.max(0, state.hp)}%`;

  const xpPrev     = (state.level - 1) * XP_PER_LEVEL;
  const xpNext     = state.level * XP_PER_LEVEL;
  const xpProgress = (state.xp - xpPrev) / (xpNext - xpPrev);
  document.getElementById('xp-fill').style.width = `${Math.min(100, Math.max(0, xpProgress * 100))}%`;

  const bossNext = state.level % 5 === 0 && !timerInterval;
  document.getElementById('boss-incoming-stat').style.display = bossNext ? 'flex' : 'none';

  renderActiveItems();
  saveState();
}

function renderActiveItems() {
  const container = document.getElementById('active-items');
  container.innerHTML = '';

  [
    [state.shieldActive,  '⬡ Shield',   ''],
    [state.xpBoostActive, '◈ XP Boost', 'xp-badge'],
    [state.charmActive,   '⧖ Charm',    ''],
    [state.crystalActive, '◇ Crystal',  'xp-badge'],
  ].forEach(([active, label, cls]) => {
    if (!active) return;
    const badge = document.createElement('span');
    badge.className   = `item-badge ${cls}`.trim();
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
  flashScreen('hp');
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
  const totalExpected = Math.min(Math.floor(elapsed / REGEN_INTERVAL_MS) * REGEN_HP_AMOUNT, REGEN_CAP);
  const toGive        = totalExpected - (state.regenHpGiven || 0);

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
  regenTimer = setInterval(() => { checkRegen(); updateRegenCountdown(); }, 10000);
}

function updateRegenCountdown() {
  const el = document.getElementById('regen-countdown');
  if (!el || !state.lastDeathTime) return;
  if (state.hp >= REGEN_CAP) { el.textContent = 'Max regen reached'; return; }
  const elapsed = Date.now() - state.lastDeathTime;
  const msLeft  = REGEN_INTERVAL_MS - (elapsed % REGEN_INTERVAL_MS);
  const mins    = Math.floor(msLeft / 60000);
  const secs    = Math.floor((msLeft % 60000) / 1000);
  el.textContent = `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

function showDeathScreen() { updateRegenCountdown(); openModal('death-screen'); }
function hideDeathScreen() {
  closeModal('death-screen');
  if (regenTimer) { clearInterval(regenTimer); regenTimer = null; }
}


// ════════════════════════════════════════
//  STREAK
// ════════════════════════════════════════

function getTodayStr()     { return new Date().toISOString().split('T')[0]; }
function getYesterdayStr() { return new Date(Date.now() - 86400000).toISOString().split('T')[0]; }

function handleStreak() {
  const today = getTodayStr();
  if (state.lastSessionDate === today) return 0;

  state.streak = (state.lastSessionDate === getYesterdayStr()) ? state.streak + 1 : 1;
  state.lastSessionDate = today;

  if (state.streak > state.highestStreak) state.highestStreak = state.streak;

  checkAchievements('streak_update');
  return Math.min(state.streak * 5, 25);
}


// ════════════════════════════════════════
//  DAILY CHALLENGE
// ════════════════════════════════════════

function pickDailyChallenge() {
  const today = getTodayStr();
  if (state.dailyChallenge?.date === today) return;
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

  const statusEl = document.getElementById('dc-status');
  const done     = dc.progress >= dc.target;
  statusEl.textContent = done ? `✓ +${dc.xpBonus} XP` : `+${dc.xpBonus} XP`;
  statusEl.className   = done ? 'dc-done' : '';
  document.getElementById('daily-challenge').classList.toggle('dc-complete', done);
}

function tickChallenge(event, ctx = {}) {
  const dc = state.dailyChallenge;
  if (!dc || dc.progress >= dc.target) return;

  let hit = false;
  if (dc.type === 'complete'      && event === 'session_complete')                      hit = true;
  if (dc.type === 'complete_long' && event === 'session_complete' && ctx.mins >= 50)    hit = true;
  if (dc.type === 'defeat_rare'   && event === 'session_complete' && ctx.tier === 'Rare') hit = true;
  if (dc.type === 'defeat_boss'   && event === 'session_complete' && ctx.isBoss)        hit = true;
  if (dc.type === 'streak_focus'  && event === 'session_complete' && state.streak >= 3) hit = true;

  if (hit) {
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
//  BOSS & ENEMY SYSTEMS
// ════════════════════════════════════════

function isBossLevel() { return state.level % 5 === 0; }

function getBoss() {
  const index = Math.floor(state.level / 5) - 1;
  const base  = BOSSES[index % BOSSES.length];
  const cycle = Math.floor(index / BOSSES.length);
  return {
    ...base,
    ability:  { ...base.ability },
    hp:       Math.round(base.hp * (1 + cycle * 0.5)),
    xpReward: Math.round(base.xpReward * (1 + cycle * 0.3)),
  };
}

function spawnEnemy() {
  const template = isBossLevel() ? getBoss() : ENEMIES[Math.floor(Math.random() * ENEMIES.length)];

  currentEnemy = {
    ...template,
    ability:   { ...template.ability },
    currentHp: template.hp,
    maxHp:     template.hp,
  };

  timeCurseAdded   = false;
  doubleCurseFirst = false;
  sessionNoDamage  = true;
  sessionXpPenalty = 0;
  minutesElapsed   = 0;

  document.getElementById('enemy-name').textContent          = currentEnemy.name;
  document.getElementById('enemy-ability-label').textContent = currentEnemy.ability.label;
  document.getElementById('enemy-ability-desc').textContent  = currentEnemy.ability.desc;

  const badge       = document.getElementById('enemy-tier-badge');
  badge.textContent = currentEnemy.tier;
  badge.className   = `tier-${currentEnemy.tier.toLowerCase()}`;

  const card = document.getElementById('enemy-card');
  card.classList.toggle('boss-card', !!currentEnemy.isBoss);

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
    const amt = ab.stealAmt || 15;
    state.xp  = Math.max(0, state.xp - amt);
    SFX.ability();
    flashScreen('xp');
    showMessage(`💀 ${currentEnemy.name} stole ${amt} XP!`);
    updateStats();
  }

  if (ab.type === 'hp_drain' && context === 'tick_10min') {
    loseHP(ab.drainAmt || 5);
    showMessage(`🩸 ${currentEnemy.name} drained ${ab.drainAmt} HP!`);
  }

  if (ab.type === 'hp_leech' && context === 'tick_10min') {
    const drain = ab.drainAmt || 6;
    loseHP(drain);
    healEnemy(Math.floor(drain / 2));
    showMessage(`🩸 ${currentEnemy.name} leeched ${drain} HP and healed itself!`);
  }

  if (ab.type === 'time_curse' && context === 'halfway' && !timeCurseAdded) {
    timeCurseAdded = true;
    const addMins  = currentEnemy.isBoss ? 5 : 2;
    SFX.ability();
    shakeTimer();
    showMessage(`⏳ Time Curse! +${addMins} minutes added!`);
    return { addSeconds: addMins * 60 };
  }

  if (ab.type === 'double_curse' && context === 'tick_every_min') {
    const oneThird  = Math.floor(selectedMinutes / 3);
    const twoThirds = Math.floor((selectedMinutes * 2) / 3);

    if (minutesElapsed === oneThird && !doubleCurseFirst) {
      doubleCurseFirst = true;
      SFX.ability();
      shakeTimer();
      showMessage(`⏳ Double Curse! +1 minute added!`);
      return { addSeconds: 60 };
    }
    if (minutesElapsed === twoThirds && doubleCurseFirst) {
      SFX.ability();
      shakeTimer();
      showMessage(`⏳ Double Curse strikes again! +1 minute!`);
      return { addSeconds: 60 };
    }
  }

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
  const taxPenalty   = (currentEnemy.ability.type === 'focus_tax' && !sessionNoDamage)
    ? Math.floor(currentEnemy.xpReward * 0.25) : 0;

  if (state.xpBoostActive)                        state.xpBoostActive = false;
  if (state.crystalActive && currentEnemy.isBoss) state.crystalActive = false;

  const earned = Math.max(0, currentEnemy.xpReward + tomeBonus + streakBonus + crystalBonus - taxPenalty - sessionXpPenalty);

  const notes = [];
  if (tomeBonus)         notes.push(`+${tomeBonus} Tome`);
  if (streakBonus)       notes.push(`+${streakBonus} Streak`);
  if (crystalBonus)      notes.push(`+${crystalBonus} Crystal`);
  if (taxPenalty)        notes.push(`-${taxPenalty} Tax`);
  if (sessionXpPenalty)  notes.push(`-${sessionXpPenalty} Decay`);

  SFX.defeat();
  stopMusic();
  endSession();
  gainXP(earned);

  let msg = `⚔ ${currentEnemy.name} defeated! +${earned} XP`;
  if (notes.length) msg += ` (${notes.join(', ')})`;
  showMessage(msg);

  bossParticleMode = false;

  checkAchievements('session_complete', {
    mins: selectedMinutes, tier: currentEnemy.tier,
    isBoss: !!currentEnemy.isBoss, enemyName: currentEnemy.name,
    noDamage: sessionNoDamage,
  });

  tickChallenge('session_complete', {
    mins: selectedMinutes, tier: currentEnemy.tier, isBoss: !!currentEnemy.isBoss,
  });

  pushHistory({ completed: true, xpGained: earned });
  hideEnemyCard();
  currentEnemy = null;
}

function hideEnemyCard() {
  const card = document.getElementById('enemy-card');
  card.classList.remove('visible');
  setTimeout(() => { card.classList.add('hidden'); card.classList.remove('boss-card'); }, 500);
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
    enemyName: currentEnemy?.name    ?? '—',
    tier:      currentEnemy?.tier    ?? '—',
    isBoss:    !!currentEnemy?.isBoss,
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
    row.className = ['history-row', entry.isBoss ? 'boss-row' : '', !entry.completed ? 'quit-row' : ''].filter(Boolean).join(' ');
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

function formatTimerDisplay(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' + s : s}`;
}


// ════════════════════════════════════════
//  CUSTOM TIMER
// ════════════════════════════════════════

const customRow   = document.getElementById('custom-input-row');
const customInput = document.getElementById('custom-minutes-input');

document.getElementById('btn-custom').addEventListener('click', () => {
  if (timerInterval) return;
  const isOpen = !customRow.classList.contains('hidden');
  customRow.classList.toggle('hidden', isOpen);
  if (!isOpen) {
    customInput.focus();
    document.querySelectorAll('.dur-btn[data-min]').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-custom').classList.add('active');
  }
});

customInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const val = parseInt(customInput.value);
  if (isNaN(val) || val < 5 || val > 180) {
    showMessage('Enter a number between 5 and 180.');
    return;
  }
  selectedMinutes = val;
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

  let totalSeconds = selectedMinutes * 60;
  minutesElapsed   = 0;

  const dmgPerMinute = Math.ceil(currentEnemy.maxHp / selectedMinutes);
  const timerEl      = document.getElementById('timer');

  timerInterval = setInterval(() => {
    totalSeconds--;
    timerEl.textContent = formatTimerDisplay(totalSeconds);

    if (totalSeconds > 0 && totalSeconds % 60 === 0) {
      minutesElapsed++;
      damageEnemy(dmgPerMinute);
      SFX.tick();

      const dcResult = triggerEnemyAbility('tick_every_min');
      if (dcResult?.addSeconds) totalSeconds += dcResult.addSeconds;

      if (minutesElapsed % 10 === 0) {
        const result = triggerEnemyAbility('tick_10min');
        if (result?.addSeconds) totalSeconds += result.addSeconds;
      }

      const halfway = Math.floor(selectedMinutes / 2);
      if (minutesElapsed === halfway) {
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

    const disabled = !canAfford || alreadyOwned || alreadyActive;
    const label    = alreadyActive ? 'Active' : alreadyOwned ? 'Owned' : `${item.cost} XP`;

    const card = document.createElement('div');
    card.className = ['shop-card', !canAfford ? 'locked' : '', alreadyActive || alreadyOwned ? 'active-item' : ''].filter(Boolean).join(' ');
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${disabled ? 'disabled' : ''}>${label}</button>
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
    if (item.id === 'potion') { state.hp = Math.min(100, state.hp + 30); showMessage('⚗ +30 HP'); }
    if (item.id === 'elixir') {
      state.hp = 50; state.lastDeathTime = null; state.regenHpGiven = 0;
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

  const counts = {};
  state.inventory.forEach(id => { counts[id] = (counts[id] || 0) + 1; });

  Object.entries(counts).forEach(([id, count]) => {
    const item = SHOP_ITEMS.find(s => s.id === id);
    if (!item) return;

    const active =
      (id === 'shield'  && state.shieldActive)  ||
      (id === 'tome'    && state.xpBoostActive)  ||
      (id === 'charm'   && state.charmActive)    ||
      (id === 'crystal' && state.crystalActive);

    const card = document.createElement('div');
    card.className = `shop-card${active ? ' active-item' : ''}`;
    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}${count > 1 ? ` <em>×${count}</em>` : ''}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${active ? 'disabled' : ''}>${active ? 'Active' : 'Equip'}</button>
    `;

    if (!active) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => { equipItem(id); renderInventory(); });
    }
    grid.appendChild(card);
  });
}

function equipItem(id) {
  const idx = state.inventory.indexOf(id);
  if (idx === -1) return;
  state.inventory.splice(idx, 1);

  const effects = {
    shield:  ['shieldActive',  '⬡ Shield equipped.'],
    tome:    ['xpBoostActive', '◈ XP Tome activated.'],
    charm:   ['charmActive',   '⧖ Battle Charm equipped.'],
    crystal: ['crystalActive', '◇ Dark Crystal equipped.'],
  };

  if (effects[id]) { state[effects[id][0]] = true; SFX.purchase(); showMessage(effects[id][1]); }
  updateStats();
}


// ════════════════════════════════════════
//  MODAL / DRAWER WIRING
// ════════════════════════════════════════

function wire(openId, modalId, closeId, onOpen) {
  document.getElementById(openId).addEventListener('click', () => {
    closeDrawer();
    if (onOpen) onOpen();
    openModal(modalId);
  });
  document.getElementById(closeId).addEventListener('click', () => closeModal(modalId));
  document.getElementById(modalId).addEventListener('click', function (e) {
    if (e.target === this) closeModal(modalId);
  });
}

wire('btn-shop',         'shop-modal',          'shop-close',         renderShop);
wire('btn-inv',          'inv-modal',           'inv-close',          renderInventory);
wire('btn-history',      'history-modal',       'history-close',      renderHistory);
wire('btn-achievements', 'achievements-modal',  'achievements-close', renderAchievements);
wire('btn-player-stats', 'player-stats-modal',  'player-stats-close', renderPlayerStats);
wire('btn-settings',     'settings-modal',      'settings-close',     renderSettings);

document.getElementById('death-shop-btn').addEventListener('click', () => { renderShop(); openModal('shop-modal'); });

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
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
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
drawVisualizer();
initIntro();

if (state.hp <= 0) { showDeathScreen(); startRegenInterval(); }