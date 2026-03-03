# Focus Battle

A gamified focus timer that turns study sessions into battles. ⚔️⏱️

---

## Features

**Core Loop**
- Set a focus timer (25 / 50 / 90 minutes, or any custom duration) and stay locked in
- Gain XP for completing sessions — quit early and lose HP
- Level up as your XP grows

**Enemy Battles**
- A random enemy spawns on session start — defeat it by finishing
- 9 enemies across Common, Uncommon, and Rare tiers
- Enemy HP drains proportionally as you focus

**Boss Battles**
- Every 5 levels a boss spawns with scaled HP and XP
- 3 rotating bosses — The Procrastinator King, Lord of Infinite Scroll, Eternal Void Sovereign
- Boss sessions trigger a gold card, tense ambient music, and gold particle mode

**Enemy Special Abilities**
- **XP Thief** — steals XP if you quit early
- **Soul Drain** — drains HP every 10 minutes
- **HP Leech** — drains your HP and heals the enemy simultaneously
- **Time Curse** — adds extra minutes at halfway (5 min for bosses)
- **Double Curse** — adds 1 min at both the 1/3 and 2/3 marks
- **Focus Tax** — cuts your XP reward by 25% if you took any damage
- **XP Decay** — XP reward shrinks by 8 for every 10 minutes elapsed

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

**Stats Page**
- Total sessions completed
- Total time focused (hours + minutes)
- Bosses defeated and Rare kills
- Total XP ever earned
- Current level, highest streak, feats unlocked

**Animated Particles**
- Canvas-based floating particle background — no libraries
- Normal sessions: slow white drift
- Boss sessions: faster gold particles
- Toggle off in Settings if you prefer clean

**Custom Timer**
- Hit Custom in the duration row and type any value from 5 to 180 minutes
- Press Enter to confirm, then start as normal

**Ambient Music**
- Procedural music via Web Audio API — no external files
- Calm drone during normal sessions
- Deep tense rumble with rhythmic pulse during boss fights
- Toggle sound from Settings

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

**Settings Panel**
- Toggle sound on/off
- Toggle particle background on/off
- Clear session history
- Reset all save data

**Session History** — Last 20 sessions with enemy, result, XP, and time

**Persistence** — All progress saved to `localStorage`

---

## Tech Stack

- Python (Flask) — reserved for future backend features
- HTML / CSS / JavaScript (vanilla)
- Web Audio API — music and sound effects
- Canvas API — particle background

---

## Roadmap

- [ ] More boss variants
- [ ] Multiplayer streak challenge
