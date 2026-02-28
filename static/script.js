// ════════════════════════════════════════
//  FOCUS BATTLE  —  script.js
// ════════════════════════════════════════

// ── CONSTANTS ──────────────────────────

const XP_PER_LEVEL = 100;
const HP_LOSS_ON_QUIT = 20;

const ENEMIES = [
  { name: 'Distraction Goblin',    hp: 80,  xpReward: 40, tier: 'Common'   },
  { name: 'Notification Wraith',   hp: 100, xpReward: 50, tier: 'Common'   },
  { name: 'Procrastination Troll', hp: 130, xpReward: 65, tier: 'Uncommon' },
  { name: 'Doom Scroll Demon',     hp: 160, xpReward: 80, tier: 'Rare'     },
  { name: 'Brain Fog Specter',     hp: 200, xpReward: 100,tier: 'Rare'     },
];

const SHOP_ITEMS = [
  {
    id:   'potion',
    name: 'Health Potion',
    desc: 'Restore 30 HP instantly',
    cost: 30,
    icon: '⚗',
  },
  {
    id:   'shield',
    name: 'Iron Shield',
    desc: 'Block the next HP penalty',
    cost: 50,
    icon: '⬡',
  },
  {
    id:   'tome',
    name: 'XP Tome',
    desc: '+25 bonus XP on next session complete',
    cost: 40,
    icon: '◈',
  },
];

// ── STATE ──────────────────────────────

let interval        = null;
let selectedMinutes = 25;
let currentEnemy    = null;   // { ...ENEMY, currentHp, maxHp }
let minutesPassed   = 0;

// Persistent state (loaded from localStorage)
let state = {
  hp:           100,
  xp:           0,
  level:        1,
  shieldActive: false,
  xpBoostActive: false,
};

// ── PERSISTENCE ────────────────────────

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

// ── STATS UI ───────────────────────────

function updateStats() {
  document.getElementById('level').textContent   = state.level;
  document.getElementById('hp-val').textContent  = state.hp;
  document.getElementById('xp-val').textContent  = state.xp;

  // HP bar: percent of max 100
  document.getElementById('hp-fill').style.width  = `${Math.max(0, state.hp)}%`;

  // XP bar: progress within current level
  const xpIntoLevel   = state.xp % XP_PER_LEVEL;
  const xpNeededLevel = XP_PER_LEVEL;          // each level needs 100 XP
  document.getElementById('xp-fill').style.width  =
    `${(xpIntoLevel / xpNeededLevel) * 100}%`;

  renderActiveItems();
  saveState();
}

function renderActiveItems() {
  const el = document.getElementById('active-items');
  el.innerHTML = '';
  if (state.shieldActive) {
    const b = document.createElement('span');
    b.className = 'item-badge';
    b.textContent = '⬡ Shield';
    el.appendChild(b);
  }
  if (state.xpBoostActive) {
    const b = document.createElement('span');
    b.className = 'item-badge xp-badge';
    b.textContent = '◈ XP Boost';
    el.appendChild(b);
  }
}

// ── XP & HP LOGIC ──────────────────────

function gainXP(amount) {
  state.xp += amount;
  // Level up: check while loop in case of large XP gain
  while (state.xp >= state.level * XP_PER_LEVEL) {
    state.level++;
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
  state.hp = Math.max(0, state.hp - amount);
  if (state.hp === 0) {
    showMessage('💀 No HP remaining. Rest up and come back.');
  }
  updateStats();
}

// ── ENEMY SYSTEM ───────────────────────

function spawnEnemy() {
  const template = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
  currentEnemy = { ...template, currentHp: template.hp, maxHp: template.hp };

  document.getElementById('enemy-name').textContent    = currentEnemy.name;
  document.getElementById('enemy-tier-badge').textContent = currentEnemy.tier;
  document.getElementById('enemy-tier-badge').className =
    `tier-${currentEnemy.tier.toLowerCase()}`;
  updateEnemyBar();

  const card = document.getElementById('enemy-card');
  card.classList.remove('hidden');
  // Trigger animation
  requestAnimationFrame(() => card.classList.add('visible'));
}

function updateEnemyBar() {
  if (!currentEnemy) return;
  const pct = (currentEnemy.currentHp / currentEnemy.maxHp) * 100;
  document.getElementById('enemy-hp-fill').style.width = `${Math.max(0, pct)}%`;
  document.getElementById('enemy-hp-text').textContent =
    `${currentEnemy.currentHp} / ${currentEnemy.maxHp} HP`;
}

function damageEnemy(dmg) {
  if (!currentEnemy) return;
  currentEnemy.currentHp = Math.max(0, currentEnemy.currentHp - dmg);
  updateEnemyBar();
}

function defeatEnemy() {
  if (!currentEnemy) return;
  currentEnemy.currentHp = 0;
  updateEnemyBar();

  const bonus = state.xpBoostActive ? 25 : 0;
  if (state.xpBoostActive) {
    state.xpBoostActive = false;
    updateStats();
  }

  const total = currentEnemy.xpReward + bonus;
  const bonusText = bonus > 0 ? ` (+${bonus} XP Boost)` : '';
  gainXP(total);
  showMessage(`⚔ ${currentEnemy.name} defeated! +${total} XP${bonusText}`);
  hideEnemyCard();
  currentEnemy = null;
}

function hideEnemyCard() {
  const card = document.getElementById('enemy-card');
  card.classList.remove('visible');
  setTimeout(() => card.classList.add('hidden'), 500);
}

// ── TIMER ──────────────────────────────

function resetTimer() {
  document.getElementById('timer').textContent = `${selectedMinutes}:00`;
}

// ── SESSION START ───────────────────────

document.getElementById('start-btn').addEventListener('click', function () {
  if (interval) return;

  spawnEnemy();
  minutesPassed = 0;

  let totalSeconds  = selectedMinutes * 60;
  const dmgPerMinute = Math.ceil(currentEnemy.maxHp / selectedMinutes);
  const timerEl      = document.getElementById('timer');

  interval = setInterval(function () {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerEl.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    totalSeconds--;

    // Deal damage to enemy every 60 seconds
    if (totalSeconds > 0 && totalSeconds % 60 === 0) {
      minutesPassed++;
      damageEnemy(dmgPerMinute);
    }

    // Session complete
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

  loseHP(HP_LOSS_ON_QUIT);
  if (state.hp > 0) {
    showMessage(`⚠ Session abandoned! -${HP_LOSS_ON_QUIT} HP`);
  }
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
    const canAfford = state.xp >= item.cost;

    // Check if already active (for non-stackable buffs)
    const alreadyActive =
      (item.id === 'shield' && state.shieldActive) ||
      (item.id === 'tome'   && state.xpBoostActive);

    const card = document.createElement('div');
    card.className = `shop-card${!canAfford ? ' locked' : ''}${alreadyActive ? ' active-item' : ''}`;

    card.innerHTML = `
      <span class="shop-icon">${item.icon}</span>
      <span class="shop-name">${item.name}</span>
      <span class="shop-desc">${item.desc}</span>
      <button class="shop-buy-btn" ${(!canAfford || alreadyActive) ? 'disabled' : ''}>
        ${alreadyActive ? 'Active' : `${item.cost} XP`}
      </button>
    `;

    if (canAfford && !alreadyActive) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => {
        buyItem(item);
        renderShop();   // refresh to update affordability
      });
    }

    grid.appendChild(card);
  });
}

function buyItem(item) {
  state.xp -= item.cost;

  if (item.id === 'potion') {
    state.hp = Math.min(100, state.hp + 30);
    showMessage('⚗ Health Potion used! +30 HP');
  } else if (item.id === 'shield') {
    state.shieldActive = true;
    showMessage('⬡ Iron Shield equipped. Next penalty blocked!');
  } else if (item.id === 'tome') {
    state.xpBoostActive = true;
    showMessage('◈ XP Tome consumed. +25 XP on next completion!');
  }

  updateStats();
}

document.getElementById('btn-shop').addEventListener('click', () => {
  renderShop();
  document.getElementById('shop-modal').classList.remove('hidden');
  requestAnimationFrame(() =>
    document.getElementById('shop-modal').classList.add('open')
  );
});

document.getElementById('shop-close').addEventListener('click', closeShop);
document.getElementById('shop-modal').addEventListener('click', function (e) {
  if (e.target === this) closeShop();
});

function closeShop() {
  const modal = document.getElementById('shop-modal');
  modal.classList.remove('open');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// ── INVENTORY (stub for later) ──────────

document.getElementById('btn-inv').addEventListener('click', () => {
  showMessage('🎒 Inventory coming in a future update!');
});

// ── TOAST MESSAGE ──────────────────────

function showMessage(text) {
  // Remove any existing toast
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ── INIT ───────────────────────────────

loadState();
updateStats();
resetTimer();