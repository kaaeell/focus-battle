
let interval   = null;
let hp         = 100;
let xp         = 0;
let level      = 1;
const XP_PER_LEVEL = 100;
let selectedMinutes = 25;


function updateStats() {
  document.getElementById('level').textContent = level;
  document.getElementById('hp-val').textContent = hp;
  document.getElementById('xp-val').textContent = xp;
  document.getElementById('hp-fill').style.width = `${hp}%`;
  document.getElementById('xp-fill').style.width = `${(xp % XP_PER_LEVEL)}%`;
}

function gainXP(amount) {
  xp += amount;
  if (xp >= level * XP_PER_LEVEL) {
    level++;
    alert(`⬆️ Level Up! You're now Level ${level}!`);
  }
  updateStats();
}

function loseHP(amount) {
  hp = Math.max(0, hp - amount);
  if (hp === 0) alert('💀 You ran out of HP! Rest and come back.');
  updateStats();
}

function resetTimer() {
  document.getElementById('timer').textContent =
    `${selectedMinutes}:00`;
}


document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    if (interval) return;  // don't change mid-session
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedMinutes = parseInt(this.dataset.min);
    resetTimer();
  });
});

// START
document.getElementById('start-btn').addEventListener('click', function () {
  if (interval) return;  // prevent double-start

  let totalSeconds = selectedMinutes * 60;
  const timerEl = document.getElementById('timer');

  interval = setInterval(function () {
    let minutes = Math.floor(totalSeconds / 60);
    let seconds = totalSeconds % 60;
    timerEl.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
    totalSeconds--;

    if (totalSeconds < 0) {
      clearInterval(interval);
      interval = null;
      gainXP(50);
      alert('✅ Session Complete! +50 XP gained!');
      resetTimer();
    }
  }, 1000);
});

//STOP
document.getElementById('btn-stop').addEventListener('click', function () {
  if (!interval) return;  // nothing running, do nothing
  clearInterval(interval);
  interval = null;
  loseHP(20);
  alert('⚠️ Session abandoned! -20 HP');
  resetTimer();
});

//SHOP / INVENTORY
document.getElementById('btn-shop').addEventListener('click', function () {
  alert('🛒 Shop coming soon!');
});

document.getElementById('btn-inv').addEventListener('click', function () {
  alert('🎒 Inventory coming soon!');
});


updateStats();