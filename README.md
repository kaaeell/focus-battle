# Focus Battle

A fun, interactive web app that turns your study sessions into a game! 🎮⏱️

---

## Features

**Core Loop**
- Set a focus timer (25 / 50 / 90 minutes) and stay locked in
- Gain XP for completing sessions — quit early and lose HP
- Level up as your XP grows

**Enemy Battles**
- A random enemy spawns when you start a session
- Enemy HP drains gradually as you focus — defeat them by finishing
- 5 enemy types across 3 tiers: Common, Uncommon, Rare

**Enemy Special Abilities**
- **XP Thief** — steals 15–25 XP if you quit the session early
- **Soul Drain** — deals 5–8 HP damage every 10 minutes during a session
- **Time Curse** — adds 2 extra minutes to the timer at the halfway point

**Streak System**
- Complete sessions on consecutive days to build your streak 🔥
- Streak bonus: +5 XP per streak day, up to +25 XP at a 5-day streak
- Streak resets if you miss a day

**Shop (Apothecary)**
- Spend XP on items between sessions
- **Health Potion** — restore 30 HP instantly (30 XP)
- **Iron Shield** — block the next HP penalty (50 XP)
- **XP Tome** — earn +25 bonus XP on next session completion (40 XP)

**Inventory**
- Non-instant items (Shield, Tome) go to your inventory after purchase
- Equip them before starting a session from the Inventory screen

**Sound Effects**
- Session start, enemy defeat, level up, HP loss, purchase, and ability triggers
- Generated at runtime via Web Audio API — no external files

**Persistence**
- All progress (HP, XP, level, inventory, streak) saved to `localStorage`

---

## Tech Stack

- Python (Flask)
- HTML / CSS / JavaScript (vanilla)

---

## Roadmap

- [ ] Inventory UI polish + item descriptions on hover
- [ ] More enemy types and ability variants
- [ ] Daily challenge system
- [ ] Ambient background music (Web Audio API)
- [ ] Boss battles every 5 levels
