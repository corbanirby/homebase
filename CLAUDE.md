# Homebase — notes for Claude

Homebase is Corban Irby's creature-ecosystem game: you raise creatures in a private real-time homebase (inside a pod) and go out through a door into a shared world (for now a generated stand-in of Atlanta) to battle, catch, forage and explore. React + Vite, no server yet; saves live in the browser.

- **Live:** https://corbanirby.github.io/homebase/ (GitHub Pages; every push to `main` publishes in about a minute)
- **Design (main copy):** `docs/design.md` — every decision so far, species by species. Read the relevant part before changing gameplay, and record new decisions there.
- **Sprites:** `docs/sprites.md` — format, file layout, how to switch a species from placeholder art to sprites, and what each species should look like.

## How we work

- Gameplay is designed with Corban first (he discusses, then says build). Don't invent new mechanics or rebalance on your own; ask, or note the idea for him.
- Commit and push straight to `main` (no branches or PRs); the live game is the playtest build. Write commit messages that say what changed in plain words.
- After pushing, check the deploy: `gh api repos/corbanirby/homebase/actions/runs --jq '.workflow_runs[0] | {head_sha:.head_sha[0:7],status,conclusion}'`.
- Never enter or handle API keys, tokens or passwords; Corban sets those up himself.
- No build/version label on screen unless Corban asks.
- Avoid distinctive Pokémon move names and any throw-to-capture mechanic; creatures are caught by opening a pod in front of them. Plain words (Peck, Bite, Dig, Splash, "critical hit") are fine.
- Keep old saves working: saves are in `localStorage` under `homebase-save-v2`; when the save shape changes, add a migration (see `withTripFields` and friends at the top of `src/App.jsx`).

## Checking your work

- `npm install`, then `npm run build` must pass; `npm run dev` to play locally.
- Add `?debug` to the address to expose `window.__hb` (stateRef, inputRef, battleRef, wildPlantSpots, moveById, engine) for scripted tests; `?speed=N` speeds up time.
- For anything visible, look at it in a browser (Playwright is handy) before pushing.

## Code map

- `src/App.jsx` — screens, game loop, Act button, door and trips, battles, catching, vine/bag, pods, feeding, harvesting, breeding, deaths, menus, creature card (Care / Moves / Genes & family)
- `src/battle/` — `engine.js` (battle rules), `movelist.js` (every move, battlefield effects), `moves.js` (learnsets, mastery), `statuses.js` (statuses, stamina, world clock), `BattleScreen.jsx`
- `src/creatures/` — `species.jsx` (species data: base stats, types, learnset, life stages, elder stats, traits, sprite path or placeholder), `placeholderArt.js`, `resident.js`, `breeding.js`, `death.js`, `pods.js`, `dna.js`
- `src/sim/` — `home.js` (homebase simulation), `outside.js` (trips, wild creatures, wild plants, area levels), `movement.js`
- `src/world/` — `land.js` (homebase land), `atlanta.js` (shared-world map), `tiles.js`, `render.js`
- `src/plants/plants.js` — plants and pod plants
- `src/engine/` — `save.js`, `time.js` (catching up while away)
- `public/sprites/<species>/<stage>/<direction>.png` — creature sprites (Ramtarug so far)
