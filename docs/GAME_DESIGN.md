# LAST STOP — Game Design Document

## Overview

**Title:** Last Stop
**Genre:** Multiplayer co-op escape room thriller
**Platform:** Web browser (Three.js)
**Players:** 2-4 (co-op)
**Target Session Length:** 25-35 minutes
**Competition:** 2026 Vibe Jam (Deadline: 1 May 2026 @ 13:37 UTC)

## Premise

A bomber has hijacked a New York subway train and is driving it toward a station rigged to explode. 2-4 players start in the last car and must solve their way forward, car by car, to reach the driver's cabin and stop the train before it arrives at the final station.

## Core Loop

1. Enter a car
2. Explore the environment for clues and interactive objects
3. Solve a multi-step puzzle (3-5 steps per car)
4. Door to the next car unlocks
5. Move forward
6. Repeat until reaching Car 8 (the driver's cabin)

The train progress bar shows stations ticking by — this is the countdown timer. Players can see the train getting closer to the final station. When the train is close, platform lights become visible through the windows and the braking sounds begin.

## Scoring and Leaderboard

- **Time taken** — total seconds from game start to bomb disarm (or failure)
- **Hints used** — each hint adds a penalty (see Hint System below)
- **Final score** = Time + (hints × penalty seconds)
- **Lower score is better**
- **Global leaderboard** — stored server-side, displayed at game end and on the main menu

## Hint System

Each car has an emergency intercom styled "help" button.

- **Press 1:** Vague nudge (e.g., "Look more carefully at the ads") — +30 second penalty
- **Press 2:** Direct clue (e.g., "The third ad's phone number contains a digit you need") — +60 second penalty
- **Press 3:** Full answer revealed — +120 second penalty

Hints are per-car. The hint button has a visual cooldown and an audio cue (intercom crackle) so it feels diegetic.

## Setting and Art Direction

- **Location:** New York City subway, night time
- **Aesthetic:** Low-poly gritty. Dark, atmospheric. The lighting does the heavy lifting.
- **Lighting:** Flickering fluorescent tubes inside cars, darkness between cars, dim emergency lighting, volumetric fog/haze, light from tunnel rushing past windows
- **Sound:** Constant train rumble and rattle, metal squeaking, distant intercom crackle, heartbeat-like pulse that increases as timer gets low
- **Color palette:** Muted greens, yellows, grays. Occasional harsh white from fluorescents. Red emergency lighting in later cars.
- **Ad panels:** Rectangular panels on car walls above windows, matching real NYC subway ad placement. These are initially placeholder/fictional but designed to accept real ad content for future monetization. Ads should look realistic and add to immersion.
- **Window view:** Tunnel walls rushing past with occasional lights. Speed visually increases as the game progresses. Near the end, station platform lights become visible.

## Technical Architecture

### Stack
- **Client:** Three.js, vanilla JS (ES modules)
- **Server:** Node.js, Express, Socket.io
- **Database:** Supabase (PostgreSQL) — leaderboard scores, post-jam analytics/ads
- **Hosting:** Vercel (frontend), separate server for WebSocket (Railway/Fly.io/Render)
- **No login required.** Username prompt only on load.

### Multiplayer Model
- **Server authoritative.** All puzzle state lives on the server.
- **Clients are renderers.** Player inputs are sent to the server. Server validates, updates state, broadcasts to all clients.
- **Room system:** Players create or join a room via a code. Max 4 players per room.
- **State sync:** Player positions, puzzle states, interactive object states, timer, all synced via WebSocket.

### Puzzle Generation
- **Procedural from templates.** Each car uses the same puzzle mechanic every run, but the specific values (codes, colors, sequences, positions) are randomized at session start by the server.
- **Seed-based.** Each session gets a random seed. All procedural generation derives from this seed. This means the server can validate any answer without storing full puzzle state per-object.

### Performance Requirements (Vibe Jam Rules)
- Must load almost instantly. No loading screens.
- No heavy texture downloads. Low-poly geometry with flat/simple materials.
- Total initial bundle should be under 5MB ideally.
- Lazy-load car interiors as players approach them (only current car + next car loaded).

## Player Controls

- **Movement:** WASD + mouse look (first-person, pointer lock)
- **Interact:** E key or click on highlighted objects
- **Hint:** H key or click the intercom button in each car
- **Chat:** T key opens text chat (for co-op communication)
- **Interactable objects** glow/highlight when the player's crosshair is over them (subtle outline or brightness increase)

## Train Layout

```
[Car 1] → [Car 2] → [Car 3] → [Car 4] → [Car 5] → [Car 6] → [Car 7] → [Car 8/Driver Cabin]
 (back)                                                                      (front)
```

Players start in Car 1. Each car is connected by a door that is locked until that car's puzzle is solved. Cars get progressively darker, more damaged, and more tense as players move forward.

## Car-by-Car Puzzle Design

---

### CAR 1 — "The Dead Phone" (Tutorial, 3-4 min target)

**Theme:** Introduction. Teaches players to explore, interact with objects, and work together.

**Step 1 — Find the phone:**
A phone is buzzing somewhere in the car. It has slid under a seat. Players hear the buzzing sound and must locate it by following the audio (proximity-based audio, gets louder as you approach). One player must interact with the seat to lift/move it while another grabs the phone from underneath.

**Step 2 — Unlock the phone:**
The phone screen shows a lock pattern (connect-the-dots style). The unlock pattern is hinted by scratch marks on the window behind the seat where the phone was found — a shape scratched into the glass that matches the swipe pattern. One player needs to look at the window from the correct angle while another traces the pattern on the phone.

**Step 3 — Read the message:**
Phone unlocks, revealing a text conversation. The texts contain a partial numeric code and a photo of an overhead luggage compartment in this car. Players must find the matching compartment and enter the partial code. The remaining digits are visible on a sticker on the compartment itself.

**Step 4 — Open the compartment:**
Full code entered into the compartment lock. Inside is a key card. One player takes it to the door at the front of the car and swipes it. Door unlocks.

**Procedural elements:** Phone location (which seat), lock pattern shape, code digits, which compartment.

**Co-op requirement:** Lifting the seat needs one player. Window pattern only visible from the far side of the car (another player describes it). Compartment code needs info from two locations.

---

### CAR 2 — "The Route" (3-4 min target)

**Theme:** Environment as cipher. Teaches players that the subway setting IS the puzzle.

**Step 1 — Find the clue sources:**
The door keypad needs a 6-digit code. Three clue sources are scattered around the car: a subway map on the wall with stations circled in red marker, a discarded newspaper on a seat with a half-completed crossword, and a torn ticket stub on the floor.

**Step 2 — Cross-reference the map and crossword:**
The crossword's filled-in answers are all station names. Some stations on the map are circled in red, but some are decoys. Only stations that appear in BOTH the crossword AND on the map (circled) are real clues. Players must compare the two.

**Step 3 — Determine the order:**
The correct stations sit on numbered subway lines. The torn ticket stub shows a route sequence (start → transfer → transfer → end), which tells players the ORDER to read the line numbers.

**Step 4 — Enter the code:**
Line numbers in the route order form the 6-digit code. Enter it in the keypad. Wrong code = 30 second lockout, lights flicker ominously, buzzer sound.

**Procedural elements:** Which stations are circled, which crossword answers are filled in, which route is on the ticket stub, all line numbers.

**Co-op requirement:** Map is on one wall, newspaper on a seat on the other side, ticket stub on the floor near the door. Three players can work three clue sources simultaneously. They must communicate findings to whoever is at the keypad.

---

### CAR 3 — "The Passengers" (4-5 min target)

**Theme:** Spatial reasoning and physical manipulation.

**Step 1 — Read the sequence:**
Six NPC passengers sit in the car, each wearing distinctly colored clothing (red hat, blue jacket, green scarf, yellow shoes, purple bag, orange vest). The overhead LED sign (like a real next-stop display) scrolls a color sequence.

**Step 2 — Rearrange the passengers:**
Players must move passengers into the order shown on the LED. Passengers only swap with adjacent passengers when a player interacts with them. This is a sorting puzzle requiring 8-15 moves minimum depending on the randomized starting arrangement.

**Step 3 — Discover the hidden clue:**
Once passengers are correctly arranged, a CLICK sound is heard. But the door doesn't open. Underneath where one specific passenger was ORIGINALLY sitting (before being moved), something is scratched into the seat — a symbol.

**Step 4 — Use the symbol:**
That symbol matches one of the emergency instruction placards on the car wall. Players pull the placard off the wall (interact) to reveal a hidden lever behind it. Pull the lever. Door opens.

**Procedural elements:** Passenger starting positions, color assignments, LED sequence, which seat has the symbol, which placard matches.

**Co-op requirement:** Two players can move passengers from opposite ends simultaneously to speed up sorting, BUT if they move conflicting passengers at the same time, all passengers reset to random positions. Requires coordination and verbal planning. Finding the scratched seat requires someone to remember or note where the key passenger started.

---

### CAR 4 — "The Blackout" (4-5 min target)

**Theme:** Memory, observation, teamwork under pressure.

**Step 1 — Map the symbols:**
The car is pitch black. Flickering lights strobe ON for 2 seconds every 12 seconds. During those 2 seconds, symbols are visible scratched/painted on surfaces throughout the car — ceiling, floor, under seats, on poles, on walls. There are 8 symbols total, scattered across the entire car.

**Step 2 — Record positions:**
A 4×2 grid is faintly drawn on the door panel (visible using a lighter or phone flashlight from Car 1 if a player kept it — or visible during light flashes if they look at the door). Each cell of the grid corresponds to a position in the car. Players must figure out which symbol goes in which grid position based on where they found it in the car.

**Step 3 — Determine the order:**
The symbols are sequential — they tell a micro-story or form a visual sequence when arranged correctly (e.g., phases of the moon, a countdown, a simple pictographic narrative). Players must figure out the correct reading order.

**Step 4 — Enter the sequence and open the door:**
Input symbols into the grid in the correct order via the door panel interface. Once correct, the door mechanism requires physical force — two handles on either side of the door must be pulled simultaneously while a third player presses the panel confirm button.

**Procedural elements:** Which 8 symbols from a larger pool are used, their positions in the car, the correct sequence order.

**Co-op requirement:** ESSENTIAL. No single player can see all 8 symbols during a 2-second flash. Each player memorizes symbols near their position, then they share information during the dark periods. The door opening requires 2-3 players minimum at different positions simultaneously.

---

### CAR 5 — "The Wire Room" (4-5 min target)

**Theme:** Environmental decoding, risk/reward, classic bomb-defusal tension.

**Step 1 — Assess the situation:**
An emergency panel by the door is ripped open, exposing 6 colored wires. A handwritten note is taped to a pole: "I tried. Got 3 right. Don't make my mistakes. Check the ads." Marks on the wires show which 3 were already cut correctly by this previous (fictional) person. 3 wires remain.

**Step 2 — Decode the ads:**
Three remaining wires each have their clue hidden in a different ad panel on the car walls. The connections are NOT simple color matching — they require interpretation:
- Ad 1: A phone number where one digit is circled. That digit corresponds to a wire position.
- Ad 2: A slogan where the first letter of each word spells a color name. That color = one wire.
- Ad 3: An image/illustration where one specific color is conspicuously ABSENT from an otherwise colorful scene. The missing color = one wire.

**Step 3 — Cut the wires:**
Players decode all three ad clues, determine the correct wire and order, and cut them one at a time. WRONG WIRE = alarm blares, 30-second time penalty, the train visibly speeds up (tunnel view through windows accelerates — terrifying). Players get two wrong attempts before the third wrong cut triggers a larger penalty.

**Step 4 — Open the secondary lock:**
All wires cut correctly. Panel reveals a secondary bolt lock that's rusted/jammed shut. Players find a metal pipe/tool under a seat. Two players brace against the wall while one uses the pipe as leverage to force the bolt. Door opens.

**Procedural elements:** Which 3 wires are pre-cut, which 3 remain, all ad content (phone numbers, slogans, images), wire-to-ad mappings.

**Co-op requirement:** Three ad clues = three players can work simultaneously. Wrong wire creates intense group debate ("I'm TELLING you it's blue!" "NO, look at the ad again—"). Physical door opening needs 2-3 players.

---

### CAR 6 — "The Frequency" (4-5 min target)

**Theme:** Audio puzzle, exploration, following physical instructions.

**Step 1 — Hear the static:**
The intercom is crackling with a garbled voice that loops every 20 seconds. First listen is almost unintelligible. A maintenance toolbox is found on the floor.

**Step 2 — Fix the intercom:**
The toolbox contains a screwdriver. Players can unscrew panels throughout the car to find intercom wiring junction boxes. There are 4 connections to fix, each behind a different panel in different locations in the car. Each connection fixed makes a different PORTION of the message clearer. Players must find and fix all 4.

**Step 3 — Follow the instructions:**
Full message revealed. It's a set of 4 physical instructions spoken by a previous passenger who tried to escape:
- "Stand on the third seat from the back. Look up. Read the number on the ceiling panel. That's your first digit."
- "The second digit is the number of doors on the left side."
- "The third digit — check the fire extinguisher. It's on the label."
- "The fourth... I left it in the vent. You'll know which one."
Players must physically follow each instruction in the 3D space to find each digit.

**Step 4 — Open the vent and the door:**
4-digit code entered in the door keypad. The voice also mentions "Don't forget what I left in the vent." A ceiling vent can be pried open — inside is a master key card needed for the NEXT car (Car 7). If players miss this, they'll have to backtrack. Door opens.

**Procedural elements:** Which panels hide the 4 junction boxes, the specific physical instructions (which seat number, which side, which numbers are on labels), the vent location, the code digits.

**Co-op requirement:** Proximity audio — each player hears different audio quality based on their position in the car. One near the speaker hears the voice clearly but with gaps. One near the wiring hears words but with heavy static. They must combine perspectives. Fixing wiring requires one player to hold wires while another screws the connection.

---

### CAR 7 — "The Divide" (4-5 min target)

**Theme:** Communication under constraint. The co-op climax.

**Step 1 — Get separated:**
As players enter, a security gate drops down the middle of the car, splitting the team. Some players are on the LEFT side, some on the RIGHT. They can see each other through the gate but cannot pass objects or reach the other side.

**Step 2 — Share information across the barrier:**
LEFT side has: a series of symbols on the wall, a colored sequence on the floor tiles, and a lever.
RIGHT side has: a decoder ring/chart taped to a seat, a numbered grid on the wall, and their own lever.
Neither side has enough information alone.

**Step 3 — Multi-round decode:**
Left side describes their symbols verbally (text chat). Right side uses the decoder ring to translate symbols to numbers. Right side reads their grid positions to left side. Left side uses those positions to identify which floor tiles to step on in the correct sequence. This takes multiple rounds of careful back-and-forth communication.

**Step 4 — Synchronized activation:**
Both levers must be pulled simultaneously while the correct floor tiles are pressed. The security gate lifts. But the door to Car 8 has one final lock — buttons on BOTH sides of the former barrier must be pressed in alternating rhythm (left-right-left-right timed sequence). Like a two-player rhythm game.

**Procedural elements:** All symbols, decoder mappings, grid numbers, floor tile sequence, rhythm pattern.

**Co-op requirement:** The ENTIRE car is a communication puzzle. Literally unsolvable without coordinated information sharing between the separated groups. This is the car that makes or breaks a team.

---

### CAR 8 — "The Driver's Door" (3-4 min target)

**Theme:** Cumulative knowledge test + the climax.

**Step 1 — Three locks:**
The driver's cabin has a reinforced door with three locks:
- A key card slot
- A keypad requiring a 7-digit code
- A physical deadbolt

**Step 2 — Key card:**
Players should have the key card from Car 6's vent. If they missed it, they must either backtrack (huge time cost) or request a hint (huge score penalty).

**Step 3 — The 7-digit code (the hidden layer):**
EVERY previous car (1-7) contained a single hidden number somewhere in the environment that was NOT part of that car's main puzzle. These were subtle environmental details:
- Car 1: A number scratched into the underside of a seat
- Car 2: A circled digit in one of the ad phone numbers
- Car 3: A number on the back of one passenger's jacket
- Car 4: A number that briefly appears on the ceiling during one specific light flash
- Car 5: A number hidden in one of the ads that wasn't part of the wire clues
- Car 6: A number spoken very quietly at the end of the intercom loop, easy to miss
- Car 7: A number written on the decoder ring's back side

A panel by the door shows symbols/icons matching each car (in order), indicating which digit goes in which position. Observant teams who caught these details throughout the game enter the code quickly. Teams who missed them are stuck and must backtrack or use hints.

**Step 4 — Deadbolt:**
Physical teamwork. Three players turn handles at different points on the door simultaneously while a fourth (or one of the three in a tight window) throws the bolt.

**Step 5 — The final disarm:**
Door opens. The "driver" is a mannequin with a bomb timer strapped to it. Players can see the destination station RIGHT THERE through the front windshield, getting closer. Under the driver's console is the disarm mechanism — a final 15-second mini-puzzle (a simple wire pull or switch sequence) while the station platform is visible and approaching through the glass.

**Success:** Train brakes screech. Stops just short of the station. Timer freezes. Victory screen with score breakdown.

**Failure (time runs out at any point):** Screen flashes white. Sound cuts. "MISSION FAILED" with score and option to retry.

**Procedural elements:** Hidden number values and their positions in each car, deadbolt handle positions, final disarm sequence.

**Co-op requirement:** Key card retrieval (may require backtracking team split), deadbolt needs 3+ players, observational recall rewards the entire team's collective awareness across the whole game.

---

## Hidden Number Layer (Cross-Car Meta-Puzzle)

Every car has ONE hidden number that is not part of the main puzzle. These are environmental details that observant players might notice on their first playthrough and will actively hunt on subsequent runs.

Placement guidelines:
- Must be visible but not obvious
- Must not interfere with or be confused for the main puzzle's clues
- Should feel like natural environmental details (graffiti, labels, stickers, scratches)
- Their discovery should feel rewarding, like finding an Easter egg

This layer is critical for:
- Replay value (first run: miss them, second run: hunt them)
- Score differentiation (observant teams vs hint-dependent teams on Car 8)
- The satisfying "aha" moment when players realize the whole train was the puzzle

## Difficulty Progression

| Car | Target Time | Difficulty | Primary Skill |
|-----|------------|------------|---------------|
| 1   | 3-4 min    | Easy       | Exploration, basic interaction |
| 2   | 3-4 min    | Easy-Med   | Cross-referencing, deduction |
| 3   | 4-5 min    | Medium     | Spatial reasoning, coordination |
| 4   | 4-5 min    | Medium     | Memory, observation under pressure |
| 5   | 4-5 min    | Med-Hard   | Environmental decoding, risk |
| 6   | 4-5 min    | Hard       | Audio, exploration, physical |
| 7   | 4-5 min    | Hard       | Communication, teamwork |
| 8   | 3-4 min    | Variable   | Cumulative recall, climax |

**Total: ~28-37 minutes for average team. Elite: 18-20 min. First-timers: 40+ min.**

## Atmosphere Escalation

The train should feel progressively more tense as players advance:

- **Cars 1-2:** Normal subway lighting. Relatively clean. Train sounds are steady.
- **Cars 3-4:** Lights start flickering more. Some graffiti. Slightly dirtier.
- **Cars 5-6:** Emergency lighting kicks in (red tinge). Train sounds louder, more metallic. Windows show the train going faster.
- **Car 7:** Partial darkness. Sparks visible outside windows. Sound design gets oppressive.
- **Car 8:** Near-dark except emergency lights. The front windshield shows the station approaching. Heartbeat-like bass pulse. Maximum tension.

## UI/HUD

- **Timer/Progress Bar:** Top of screen. Shows the subway line with stations. A train icon moves along it in real-time. Current station name displayed. Final station (destination) marked in red. This is always visible.
- **Hint Button:** Bottom-right corner. Styled as an emergency intercom icon. Shows hint count used for current car.
- **Interaction Prompt:** Center-bottom. Shows "Press E to interact" when looking at an interactable object.
- **Text Chat:** Bottom-left. Toggle with T key. For co-op communication.
- **Player Indicators:** Small name tags above other players' heads (visible through walls at short range so you can find teammates).

## Multiplayer Flow

1. **Main Menu:** Title screen with train animation in background. Options: "Create Room" or "Join Room" + username input.
2. **Lobby:** Room code displayed. Player list shown. Host can start when 2-4 players have joined.
3. **Game Start:** Brief cinematic — exterior shot of the train speeding through tunnels, then camera moves inside to Car 1 where players spawn.
4. **Gameplay:** Cars 1-8 as designed above.
5. **End Screen:** Score breakdown — time, hints per car, total score. Leaderboard position. Option to play again (new room) or return to menu.

## Monetization (Post-Jam)

- **Ad panels on subway walls.** Real ads displayed on the in-game ad panels that are already part of the environment. This is diegetic advertising — it adds realism rather than detracting from it. Ad content should be styled to look like real subway ads (correct dimensions, placement, typography).
- **Premium car packs.** Additional puzzle cars beyond the initial 8, sold as DLC/expansion.
- **Cosmetic player skins.** Different character appearances.
- **Seasonal events.** Holiday-themed cars, special timed challenges.

## Vibe Jam Submission Requirements

- [ ] Game accessible on web, free-to-play, no login/signup required
- [ ] Loads almost instantly (no loading screens, no heavy downloads)
- [ ] At least 90% of code AI-generated
- [ ] New game created during jam period (after 24 March 2026)
- [ ] Own domain or subdomain preferred
- [ ] Add entrant widget: `<script async src="https://jam.pieter.com/2026/widget.js"></script>`
- [ ] Multiplayer preferred (YES — co-op 2-4 players)
- [ ] One entry per person

## Build Order

### Phase 1 — The Shell
- Train exterior/interior geometry (one reusable car template)
- First-person camera + WASD movement + pointer lock
- Lighting system (flickering fluorescents, fog, emergency lights)
- Window view (tunnel parallax rushing past)
- Door system (locked/unlocked states, animation)
- Car-to-car transition

### Phase 2 — Multiplayer
- Socket.io server setup
- Room creation/joining
- Player position sync + broadcasting
- Shared game state (puzzle states, timer)
- Username + lobby system

### Phase 3 — Puzzles (one car at a time, in order)
- PuzzleBase class (shared interface for all puzzles)
- Car 1 through Car 8, built sequentially
- Each car tested with multiplayer before moving to next
- Procedural generation for each car's variables

### Phase 4 — Polish
- Sound design (train rumble, brakes, intercom, alarms, heartbeat)
- Timer/progress bar UI
- Hint system with penalties
- Leaderboard (server-side storage)
- Score breakdown end screen
- Ad panel placeholder system
- Vibe Jam widget
- Performance optimization and load testing
- Cross-browser testing

## Database (Supabase)

Supabase is used ONLY for persistent data. All real-time game state lives in-memory on the WebSocket server.

### Tables

**leaderboard**
| Column       | Type        | Notes                              |
|-------------|-------------|-------------------------------------|
| id          | uuid (PK)   | Auto-generated                     |
| team_name   | text        | Comma-separated player usernames    |
| player_count| int         | 2-4                                |
| total_time  | int         | Seconds from start to disarm       |
| hints_used  | int         | Total hints across all cars        |
| final_score | int         | total_time + (hints × penalty)     |
| car_times   | jsonb       | Per-car breakdown: {car1: 45, ...} |
| car_hints   | jsonb       | Per-car hints: {car1: 0, car2: 1}  |
| completed   | boolean     | true = won, false = time ran out   |
| created_at  | timestamptz | Auto-generated                     |

**Future tables (post-jam):**
- `ad_impressions` — tracking which ads were seen and for how long
- `sessions` — full game session analytics
- `players` — optional accounts for persistent stats

### Access Pattern
- Server-side only. The Supabase client is initialized in `server/supabase.js` using the service role key.
- Browser clients NEVER talk to Supabase directly. They send scores to the WebSocket server, which validates and writes to Supabase.
- Leaderboard reads can go through a simple Express REST endpoint (`GET /api/leaderboard`) that queries Supabase and returns the top 100 scores.

## File Structure

```
last-stop/
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.js              # Three.js scene init, game loop
│   │   ├── train.js             # Train car geometry, interior props
│   │   ├── lighting.js          # Fluorescent flicker, fog, emergency lights
│   │   ├── player.js            # First-person camera, movement, interaction
│   │   ├── doors.js             # Door lock/unlock, animation, keycard system
│   │   ├── windows.js           # Tunnel parallax, speed changes
│   │   ├── atmosphere.js        # Progressive tension (sound, lighting, speed)
│   │   ├── interactable.js      # Base class for clickable/hoverable objects
│   │   ├── puzzles/
│   │   │   ├── PuzzleBase.js    # Shared puzzle interface
│   │   │   ├── car1.js          # The Dead Phone
│   │   │   ├── car2.js          # The Route
│   │   │   ├── car3.js          # The Passengers
│   │   │   ├── car4.js          # The Blackout
│   │   │   ├── car5.js          # The Wire Room
│   │   │   ├── car6.js          # The Frequency
│   │   │   ├── car7.js          # The Divide
│   │   │   └── car8.js          # The Driver's Door
│   │   ├── ui/
│   │   │   ├── hud.js           # Timer, progress bar, hint button
│   │   │   ├── chat.js          # Text chat for co-op
│   │   │   ├── menu.js          # Main menu, lobby, room system
│   │   │   └── leaderboard.js   # Score display, global rankings
│   │   ├── audio/
│   │   │   └── soundManager.js  # All sound loading and playback
│   │   └── network/
│   │       └── socket.js        # Client-side Socket.io handling
│   └── assets/
│       ├── sounds/              # Train rumble, doors, alarms, etc.
│       └── textures/            # Minimal low-poly textures
├── server/
│   ├── index.js                 # Express + Socket.io server
│   ├── gameState.js             # Authoritative game state management
│   ├── rooms.js                 # Room creation, joining, player management
│   ├── puzzleGenerator.js       # Procedural puzzle generation (seed-based)
│   ├── timer.js                 # Server-side countdown timer
│   ├── leaderboard.js           # Supabase leaderboard read/write
│   ├── supabase.js              # Supabase client init (server-side only)
│   └── validation.js            # Puzzle answer validation
├── docs/
│   └── GAME_DESIGN.md           # This file
├── CLAUDE.md                    # Claude Code project instructions
├── package.json
├── vercel.json                  # Vercel deployment config
└── README.md
```
