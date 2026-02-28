# Focus Battle

Focus Battle is a fun, interactive web app that turns your study sessions into a game! 🎮⏱️

---

## Features

**Core Loop**
- Set a focus timer (25 / 50 / 90 minutes) and stay locked in
- Gain XP for completing sessions — quit early and lose HP
- Level up as your XP grows

**Enemy Battles**
- A random enemy spawns when you start a session (Distraction Goblin, Notification Wraith, Doom Scroll Demon, and more)
- Enemies have HP that drains as you focus — defeat them by finishing the session
- Enemies come in tiers: Common, Uncommon, Rare — each with different HP and XP rewards

**Shop (Apothecary)**
- Spend XP on items between sessions
- **Health Potion** — restore 30 HP instantly (30 XP)
- **Iron Shield** — block the next HP penalty (50 XP)
- **XP Tome** — earn +25 bonus XP on your next session completion (40 XP)

**Persistence**
- HP, XP, level, and active items are saved to `localStorage` — progress carries across page refreshes

---

## Tech Stack

- Python (Flask)
- HTML
- CSS
- JavaScript (vanilla)

---

## Roadmap

- [ ] Sound effects & ambient music (Web Audio API)
- [ ] Inventory UI to view and manage owned items
- [ ] Enemy special abilities (e.g. Distraction Goblin steals XP on early quit)
- [ ] Streak tracking and daily challenges
