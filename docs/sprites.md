# Homebase sprites

How creature sprites are made and added. Ramtarug, Scuffinch and Thrummet have real sprites so far; the other seven use code-drawn placeholders (`src/creatures/placeholderArt.js`) until theirs are made.

## The format (match Ramtarug)

- **Frame:** 96×96 PNG with a transparent background. Pixel art, crisp edges, no anti-aliased blur. The creature is drawn side-on / three-quarter, standing on the bottom third of the frame with room above for horns, wings and tails.
- **Directions (8):** `north`, `north-east`, `east`, `south-east`, `south`, `south-west`, `west`, `north-west`.
- **Life stages:** `baby`, `adolescent`, `adult`, `elder` (one set of 8 for each). The game also draws younger stages smaller on the map, so a baby sprite can fill its frame.
- **Files:** `public/sprites/<species>/<stage>/<direction>.png`, e.g. `public/sprites/scuffinch/adult/south-east.png`. Species folder names are the lowercase ids in `src/creatures/species.jsx` (`kudzoon`, `thrummet`, `scuffinch`, `flintback`, `shoalclaw`, `glimmerwick`, `possumbra`, `clattershell`, `duskhowl`).
- **Look:** Heroes of Might and Magic III–style pixel art, readable at small size on a top-down map and big in battle. Look at `public/sprites/ramtarug/` before starting a new species.

## Flying sets (later)

Make the **standing** set for every species now (walking, battle, menus). Flyers will later also need a **flying/perched** set in 8 directions, but only for the stages that fly (adolescent and adult; babies can't fly, elders fly less). These are made when the Behavior stage is built, from the same PixelLab character so they match. Don't make them yet.

## Art first, genes to match

- Each species is designed by hand, so its **art comes first** and its appearance genes (the part slots: head, eyes, ears, crown, mouth, ridge, tail, covering, pattern, feet, build, colours) are **written to match the finished art**. Hidden copies can carry other parts, so offspring can still surprise.
- **Keep each species to two or three standout features.** Fewer details read better as pixel sprites, especially at map size.
- Colours should sit in a few clean ramps (main, accent, pattern/markings) so the game can later recolour a creature from its colour genes.

## Switching a species from placeholder to sprites

In `src/creatures/species.jsx`, the species entry has `art:"<id>"` (draw the placeholder). Replace it with `path:"sprites/<id>"` (load files), the way Ramtarug's entry does. Check Ramtarug's entry for the exact form before changing it. Every stage and direction file must exist, or that view shows nothing.

Also update the species' `palette` in `species.jsx` to match the new sprite's colour ramps (main body colour and accent, as a centre hue in degrees, a band width, a minimum saturation, and how far creatures may turn it; see Ramtarug's), so colour genes recolour the right pixels. And when the final sprite is picked, write its founder part genes in `src/creatures/parts.js` (`FOUNDERS`) to match what's drawn; add new part options to `LOCI` if the species needs them (a bird's bill, wings, crest).

Then run the game locally (`npm install`, `npm run dev`, open the printed address with `?debug`), look at the creature on the map (walk around it: all 8 directions) and in a battle, then commit and push to `main`. GitHub Pages publishes about a minute later; check with `gh api repos/corbanirby/homebase/actions/runs`.

## Species notes (what to draw)

Each species' full concept and moves are in `docs/design.md`. The sprites should show what its moves describe.

- **Kudzoon** (Plant; kudzu, "the vine that ate the South"). Stages: **seedling** (baby: small sprout, three-part leaves, two eyes) → **runner** (adolescent: long sprawling vine, reaching tendrils) → **flowering mound** (adult: big leafy heap with spikes of purple, grape-scented flowers) → **woody crown** (elder: thick twisted brown root-crown, fewer, tougher leaves).
- **Thrummet** (Bug/Air; Georgia dog-day cicada). **Done November 20.** **No adolescent stage** — only `baby`, `adult`, `elder` are used; `adolescent/` is a copy of `baby` so nothing is missing. Three standout features: big bulging red eyes set wide; clear wings with orange-gold veins folded like a roof; and the Air touch, a faint pale-blue shimmer along the wing edges. Colours: dark olive body (about 50°) with black markings; accent red eyes and orange veins (about 350°–30°); the blue shimmer sits outside both bands. Baby is the **underground nymph** (Bug/Earth): hunched, tan-brown and armoured, big digging forelegs, smaller dull-red eyes, soil specks, small wing pads, no wings. Adult is the full winged cicada. Elder keeps the olive and red but faded (not grey), dark grey-olive markings, ragged torn wings, cloudy eyes, weaker shimmer. No flying set yet.
- **Scuffinch** (Air; brown thrasher, Georgia's state bird). Rust-brown songbird, long tail, cream breast streaked dark brown, bright yellow eye, long slightly curved dark bill. Baby: fluffy nestling, stubby tail. Adolescent: sleeker, streaks coming in. Adult: full colour, long tail. Elder: greyer, duller eye, ragged tail feathers.
- **Flintback** (Earth/Fire; eastern fence lizard on hot granite). Grey-brown spiny scales like flint, sparks/ember glow along the back, blue belly patches on adults; it bobs push-ups and drops its tail. Baby small and plain; elder darker, coal-like.
- **Shoalclaw** (Water/Earth; Chattahoochee crayfish). Red-brown armoured crayfish, one oversized crushing claw, long antennae, fan tail. Baby translucent and tiny; elder huge scarred claw.
- **Glimmerwick** (Electric/Bug; firefly). Tiny dark beetle with a red-and-yellow head shield and a glowing yellow-green tail lantern. Baby could be a glowworm larva; elder's light dimmer and flickering.
- **Possumbra** (Spirit/Normal; opossum that plays dead). Grey-white opossum, pale face, pink nose and bare pink tail, dark ears, a faint ghostly purple aura (Spirit). Baby rides small and fuzzy; elder grizzled and thinner.
- **Clattershell** (Metal/Earth; nine-banded armadillo). Metal-plated armadillo with banded shell, long snout, digging claws. (Georgia's armadillos can't roll into a ball.) Elder: scratched, heavier plates.
- **Duskhowl** (Normal/Spirit; coyote, rare apex hunter). Tawny-grey coyote, lean and long-legged, with a faint dusk-purple shadow around it (Spirit). Elder: grey muzzle, the old pack leader.
