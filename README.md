# Focus Battle

A gamified focus timer that turns study sessions into battles. ⚔️⏱️

---

## Features

**Core Loop**
- Set a focus timer (25 / 50 / 90 minutes) and stay locked in
- Gain XP for completing sessions — quit early and lose HP
- Level up as your XP grows

**Enemy Battles**
- A random enemy spawns on session start — defeat it by finishing
- 5 regular enemies across Common, Uncommon, Rare tiers
- Enemy HP drains proportionally as you focus

**Boss Battles**
- Every 5 levels a boss spawns with scaled HP and XP
- 3 rotating bosses — The Procrastinator King, Lord of Infinite Scroll, Eternal Void Sovereign
- Bosses trigger a distinct ambient music shift and gold card treatment

**Enemy Special Abilities**
- **XP Thief** — steals XP if you quit early
- **Soul Drain** — drains HP every 10 minutes
- **Time Curse** — adds extra minutes at halfway (5 min for bosses)

**Achievements (12 total)**
| Category | Achievement | Condition |
|---|---|---|
| Session | First Blood | Complete your first session |
| Session | Veteran | Complete 10 sessions |
| Session | Long Haul | Complete a 90-minute session |
| Session | Untouchable | Finish a session without losing HP |
| Combat | Rare Hunter | Defeat a Rare enemy |
| Combat | Boss Slayer | Defeat your first boss |
| Combat | Warlord | Defeat 3 bosses |
| Combat | Void Walker | Defeat the Eternal Void Sovereign |
| Streak | On Fire | Reach a 3-day streak |
| Streak | Unstoppable | Reach a 7-day streak |
| Progression | Rising | Reach Level 5 |
| Progression | Ascendant | Reach Level 10 |

**Ambient Music**
- Procedural music via Web Audio API — no external files
- Calm drone during normal sessions
- Deep tense rumble with rhythmic pulse during boss fights
- Music shifts automatically when a boss spawns
- Mute button in the top bar

**Daily Challenge**
- One challenge per day, deterministic by date
- 6 challenge types with bonus XP on completion
- Shown in a fixed bottom-left panel

**Streak System**
- Consecutive daily sessions build a streak 🔥
- Bonus XP: +5 per streak day, capped at +25

**Death Screen + HP Regen**
- HP hitting 0 triggers a death screen with live regen countdown
- +5 HP every 15 minutes passively, capped at 50
- Calculated from time of death — works across page refreshes

**Shop (Apothecary)**
| Item | Cost | Effect |
|---|---|---|
| Health Potion | 30 XP | +30 HP instantly |
| Elixir of Rebirth | 80 XP | Restore to 50 HP, even from 0 |
| Iron Shield | 50 XP | Block next HP penalty |
| XP Tome | 40 XP | +25 bonus XP on next completion |
| Battle Charm | 60 XP | Negate next XP steal |
| Dark Crystal | 70 XP | 2× XP from next boss |

**Session History** — Last 20 sessions with enemy, result, XP, and time

**Persistence** — All progress saved to `localStorage`

---

## Tech Stack

- Python (Flask) — reserved for future backend features
- HTML / CSS / JavaScript (vanilla)

---

## Roadmap

- [ ] More enemy types and boss variants
- [ ] Settings panel (custom timer, reset save)
- [ ] Multiplayer streak challenge
