# Homebase sprites

How creature sprites are made and added. Ramtarug is the only species with real sprites so far; the other nine use code-drawn placeholders (`src/creatures/placeholderArt.js`) until theirs are made.

## The format (match Ramtarug)

- **Frame:** 96×96 PNG with a transparent background. Pixel art, crisp edges, no anti-aliased blur. The creature is drawn side-on / three-quarter, standing on the bottom third of the frame with room above for horns, wings and tails.
- **Directions (8):** `north`, `north-east`, `east`, `south-east`, `south`, `south-west`, `west`, `north-west`.
- **Life stages:** `baby`, `adolescent`, `adult`, `elder` (one set of 8 for each). The game also draws younger stages smaller on the map, so a baby sprite can fill its frame.
- **Files:** `public/sprites/<species>/<stage>/<direction>.png`, e.g. `public/sprites/scuffinch/adult/south-east.png`. Species folder names are the lowercase ids in `src/creatures/species.jsx` (`kudzoon`, `thrummet`, `scuffinch`, `flintback`, `shoalclaw`, `glimmerwick`, `possumbra`, `clattershell`, `duskhowl`).
- **Look:** Heroes of Might and Magic III–style pixel art, readable at small size on a top-down map and big in battle. Look at `public/sprites/ramtarug/` before starting a new species.

## Switching a species from placeholder to sprites

In `src/creatures/species.jsx`, the species entry has `art:"<id>"` (draw the placeholder). Replace it with `path:"sprites/<id>"` (load files), the way Ramtarug's entry does. Check Ramtarug's entry for the exact form before changing it. Every stage and direction file must exist, or that view shows nothing.

Then run the game locally (`npm install`, `npm run dev`, open the printed address with `?debug`), look at the creature on the map (walk around it: all 8 directions) and in a battle, then commit and push to `main`. GitHub Pages publishes about a minute later; check with `gh api repos/corbanirby/homebase/actions/runs`.

## Species notes (what to draw)

Each species' full concept and moves are in `docs/design.md`. The sprites should show what its moves describe.

- **Kudzoon** (Plant; kudzu, "the vine that ate the South"). Stages: **seedling** (baby: small sprout, three-part leaves, two eyes) → **runner** (adolescent: long sprawling vine, reaching tendrils) → **flowering mound** (adult: big leafy heap with spikes of purple, grape-scented flowers) → **woody crown** (elder: thick twisted brown root-crown, fewer, tougher leaves).
- **Thrummet** (Bug/Air; cicada). **No adolescent stage** — only `baby`, `adult`, `elder` are used (still make the `adolescent` folder as a copy of `baby` so nothing is missing). Baby is the **underground nymph** (brown, digging forelegs, Bug/Earth); adult is the **winged cicada** (dark body, red eyes, clear veined wings); elder greyer, ragged wings.
- **Scuffinch** (Air; brown thrasher, Georgia's state bird). Rust-brown songbird, long tail, cream breast streaked dark brown, bright yellow eye, long slightly curved dark bill. Baby: fluffy nestling, stubby tail. Adolescent: sleeker, streaks coming in. Adult: full colour, long tail. Elder: greyer, duller eye, ragged tail feathers.
- **Flintback** (Earth/Fire; eastern fence lizard on hot granite). Grey-brown spiny scales like flint, sparks/ember glow along the back, blue belly patches on adults; it bobs push-ups and drops its tail. Baby small and plain; elder darker, coal-like.
- **Shoalclaw** (Water/Earth; Chattahoochee crayfish). Red-brown armoured crayfish, one oversized crushing claw, long antennae, fan tail. Baby translucent and tiny; elder huge scarred claw.
- **Glimmerwick** (Electric/Bug; firefly). Tiny dark beetle with a red-and-yellow head shield and a glowing yellow-green tail lantern. Baby could be a glowworm larva; elder's light dimmer and flickering.
- **Possumbra** (Spirit/Normal; opossum that plays dead). Grey-white opossum, pale face, pink nose and bare pink tail, dark ears, a faint ghostly purple aura (Spirit). Baby rides small and fuzzy; elder grizzled and thinner.
- **Clattershell** (Metal/Earth; nine-banded armadillo). Metal-plated armadillo with banded shell, long snout, digging claws. (Georgia's armadillos can't roll into a ball.) Elder: scratched, heavier plates.
- **Duskhowl** (Normal/Spirit; coyote, rare apex hunter). Tawny-grey coyote, lean and long-legged, with a faint dusk-purple shadow around it (Spirit). Elder: grey muzzle, the old pack leader.
