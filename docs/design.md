# Homebase Game Design

Started Nov 2, 2026 by Corban Irby. **This file is the main copy of the design** (moved here from a Claude doc on Nov 17, 2026); edit it here and commit it with the code.

The decisions made so far, topic by topic. Current progress and what's next are in the status notes (Homebase project in Claude) and the git log.

## Already built

- Playable at https://corbanirby.github.io/homebase/ (GitHub Pages; the old Netlify site is no longer the main one).
- **Ramtarug is species #1**, with hand-made pixel sprites for baby, adolescent, adult and elder, in 8 directions each. Creatures face the way they walk, and younger stages are drawn smaller.

## 1. Core game loop

- **The story:** you start in the modern real world. Someone gives you an ultra-rare pod; picking your starter means picking which pod, and which biome, you get.
- **Your homebase is inside that pod:** a private world in your starter's biome, where you raise creatures, grow plants and build. Only you can change it.
- **Starting kit:** two creatures of one species, plus seeds of the plant they eat.
- **Starters:** pick one of three random species from anywhere in the world, excluding local species, so it feels rare.
- **The shared world is a giant pod grown over the real Earth.** A door in your homebase leads there, and you come out wherever you are by GPS. The door appears at that spot, and you walk back to it to go home.
- **The shared world** starts with a base layer generated from real map data (parks become grassland, rivers become water), drawn with pixel tiles. Players build on top of it over time.
- **Main goal:** a strong ecosystem, which gives you a strong battle team. Alongside that: building your homebase, adding art to the game and leaving your mark on the shared world.
- **Build order:** finish the homebase first (no server needed). Then a single-player test version of the shared world. Then move it onto servers for sharing.

## 2. Time

- **Real time.** The game saves when you leave and works out what happened when you return, like Animal Crossing. No limit on how long you can be away.
- **Lifespan varies by species** and is a trade-off: short-lived species grow up, breed and level fast; long-lived ones are slow but end up stronger. Roughly a week for insects, about 4 weeks for Ramtarug, months for rare long-lived species. Each creature's lifespan gene shifts it a bit.
- **Everything keeps running while you're away:** plants grow, creatures eat, heal, age, breed, lay eggs, and eggs hatch. You get a short report when you return. Very long absences are reported as highlights.
- **Living ecosystem:** creatures feed themselves from the plants you've grown. A balanced homebase runs fine without you; an overcrowded one loses its weakest. Imbalance is punished, not absence.
- **One clock for every creature,** including those you carry. Pods slow aging but don't stop it.
- **Day and night follow your real local time.**

## 3. Environments and regions

- **Habitat and type are separate.** Habitat is where a creature lives, what it eats and what it needs at home. Type is its battle element. They often match but don't have to.
- **Biomes:** grassland, forest, rainforest, swamp, lake and river, coast and ocean, desert, mountain, tundra, volcano, cave and city, each with its own food plants.
- **Creatures shape their environment,** each type helping and harming something. Poison kills most plants but lets toxic ones grow; fire burns plants but enriches the soil; water feeds nearby plants but can flood dry-land ones.
- **Every region should feel like a different game:** real climate (latitude, elevation, season, weather), native species lists per region, a regional look for the terrain, and migration with the seasons. Ice creatures in Atlanta would be rare; you'd go north in winter to find them.
- **Your homebase climate is yours to choose,** so an Atlanta player can raise ice creatures in a snow homebase.
- **Shared-world creatures have limited influence:** a released creature that fits the local climate can spread; one that doesn't stays rare or dies out there.
- **Ramtarug** is a poison creature native to the coastal-plain swamps of south Georgia and Florida (around the Okefenokee), so it is not local to Atlanta. It eats moss and reeds.

## 4. Life cycle

**Breeding and eggs**

- Mainly two sexes. Every species lays eggs.
- Incubation time and clutch size depend on species. Eggs need the right climate to hatch, can be eaten by other creatures, and can be carried, traded or gifted. Hidden traits are a surprise at hatching.

**Death**

- Carcasses stay for a day or two: they fertilize nearby plants, feed scavenger species, and leave materials like bones and horns for building. One generic remains sprite per body size.
- A family tree records every creature that lived in your homebase.

**Fainting**

- A fainted creature doesn't recover on its own. It has a timer (around 24 hours, varying by species) to be nursed back at your homebase with healing plants, or at a healer in the shared world. Healers are both game-placed and player-built.
- **Risk zones:** dangerous parts of the shared world where losing carries a real risk of death.

**Pods**

- Pods are **miniature worlds**, grown from plants at your homebase. Baseball-sized on the outside, roomy inside. Creatures feel safe in them, like a dog in a crate.
- **Your homebase pod is the mother plant.** You carry a living vine grown from it across your chest, and awake pods root into it.
- **Inside space** depends on the plant and how well it was grown: small, medium, large or huge. Any creature fits any pod, but **size fit and biome fit affect the catch rate.**
- A pod that catches a creature becomes its own. It **grows with its creature**, so there's nothing to manage.
- **Pods are reusable.** Only a pod attacked during a catch is destroyed. When a creature dies or is released, its pod returns to a dormant seed and can be given to another creature.
- **Empty pods don't dry out.**
- **The vine holds 6 equipped pods, always.** Only those creatures can battle; choosing your 6 is the strategy.
- **Backpack pods** stay sealed and asleep: safe, unable to battle, aging slowed. New catches beyond 6 go here. **Backpack capacity is what you upgrade.**
- **Swapping between backpack and vine** only happens at healing places, including your homebase.
- **At your homebase,** creatures come out and live in the ecosystem; their pods become dens planted around the mother plant.
- A fainted creature can rest in its pod, which slows the timer but doesn't heal it.

**Pod doorways**

- A pod **unfolds into an arched doorway**, and creatures walk in and out through it. Nobody shrinks or transforms.
- **The doorway's size shows the pod's inner space**, so the size fit is visible at a glance: a dragon stooping at a small arch is a poor fit.
- When catching, the doorway opens in front of the wild creature, and it walks in, hesitates at the threshold, attacks the doorway, or runs off.
- **The mother plant unfolds the same way** into a doorway for you, to enter the shared world and return.
- Art needed: one unfolding-doorway animation, scaled for each size, with color variants per biome. Creatures walking in reuse their existing sprites.

**Catching**

You open a pod in front of the wild creature, and it decides. The catch chance is hidden; you read its mood from hints like "it eyes the pod curiously".

| Creature's choice | Its turn |
| --- | --- |
| Goes in | Caught, and the battle ends |
| Hesitates | Then attacks your creature |
| Attacks the pod | Pod destroyed, then it also attacks your creature |
| Flees | The battle ends with no catch |

What sways it: low HP, temperament (the aggression gene), a pod from its biome, a lure of its favorite food, being a baby, your lead being the same species, and later your karma.

## 5. Progress across generations

- **Inherited genes:** babies inherit their parents' stat genes, so a well-bred line is born stronger.
- **Mentoring:** young creatures living near experienced adults and elders gain experience every day, up to **70% of the best mentor's level**. Elders make the best mentors, which gives them a real role.
- **Daily life:** a safe, balanced homebase lets creatures grow on their own up to the mentor limit. The same rule applies in the shared world: creatures left alone in quiet areas grow strong.
- **Battles are the only way past the limit.** Each generation can climb a bit higher than the last.
- **Generations work like ranked seasons:** you climb, your champion ages and passes on, and the next generation starts at 70% rather than zero. A lineage rank could track how high a family line has ever reached, with leaderboards later.

**Moves**

- Creatures can know many moves but bring **4 into battle**, chosen from everything they know. Nothing is forgotten. The 4 can only be changed at healing places.
- Each move has **3 mastery levels**, earned by using it in battle; each adds a little power and accuracy.
- **Only fully mastered moves can be taught.** Mentors teach their mastered moves to the young, which is how move choices carry into the next generation.

**Life stage and level**

- Level and life stage are separate. Stage scales stats, in roughly these amounts, varying by species:

| Stage | Stats | Gains experience |
| --- | --- | --- |
| Baby | About 50% | Slowly |
| Adolescent | About 80% | Fastest |
| Adult | 100% | Normal |
| Elder | Strength and speed fade to about 85% | Slowly; best mentor |

- **No level cap.** Babies level slowly and have halved stats, so very high-level babies don't happen in practice.
- **Leveling doesn't affect aging.** Lifespan follows real time only.

## Battle

**Six stats:** HP, Attack (physical moves), Defense (against physical), Elemental (type moves), Resistance (against type moves) and Speed (turn order and a small dodge chance).

**Each stat** = species base × genes × level × life stage × condition.

- **Condition:** a well-fed, healthy, happy creature fights up to about 10% better; a hungry or stressed one about 10% worse. A good homebase makes a stronger team.
- **Habitat advantage:** a small bonus when battling in its own habitat.
- **A move's type decides damage.** A creature's own type decides what it's weak to when defending, plus a bonus for using moves of its own type.
- **Water habitats:** freshwater, saltwater and brackish water are separate habitats but one Water type in battle.

**13 types:** Normal, Fire, Water, Plant, Electric, Ice, Earth, Air, Bug, Poison, Metal, Spirit and Fungus. Spirit covers ghosts, curses, dark and mystical creatures. Air is creatures of the sky (birds, bats, flyers) plus wind powers. Dragon is a rarity or lineage, not a type. Matchups don't have to mirror: each attack is judged on its own logic.

| Type | Strong against (2×) | Weak against (½) | No effect on | Hit hard by | Resists | Immune to |
| --- | --- | --- | --- | --- | --- | --- |
| Normal | None | Metal | Spirit | Spirit | None | None |
| Fire | Plant, Bug, Ice, Metal, Fungus | Water, Earth, Fire | None | Water, Earth | Plant, Bug, Ice, Metal, Fire, Fungus | None |
| Water | Fire, Earth, Metal, Poison | Plant, Water, Fungus, Ice | None | Electric, Plant, Poison | Fire, Earth, Water, Ice | None |
| Plant | Water, Earth | Fire, Metal, Plant, Air, Bug | None | Fire, Poison, Bug, Ice, Air, Fungus | Water, Earth, Electric, Plant, Spirit | None |
| Electric | Water, Air, Metal | Plant, Electric | Earth | Earth | Air, Metal, Electric | None |
| Ice | Plant, Air, Earth | Fire, Metal, Water, Ice | None | Fire, Metal | Ice, Water, Air | None |
| Earth | Fire, Electric, Poison | Water, Plant, Fungus, Bug | Air | Water, Plant, Ice | Fire, Poison | Electric |
| Air | Bug, Plant | Electric, Ice, Earth, Metal | None | Electric, Ice | Bug, Plant, Fungus | Earth |
| Bug | Plant, Fungus | Fire, Air, Poison, Metal | None | Fire, Air, Poison, Fungus | Spirit, Earth, Plant | None |
| Poison | Plant, Bug, Water, Fungus | Earth, Poison, Spirit | Metal | Earth, Water | Bug, Poison | None |
| Metal | Ice | Fire, Electric, Metal | None | Fire, Water, Electric | Ice, Plant, Bug, Air, Spirit, Metal, Normal | Poison |
| Spirit | Normal, Spirit | Metal, Bug, Fungus, Plant | None | Spirit | Poison | Normal |
| Fungus | Plant, Bug | Fire, Fungus, Air | None | Fire, Poison, Bug | Water, Earth, Fungus, Spirit | None |

**Balance notes:** Fire hits many types hard, balanced by fragile fire species and the damage fire does to plants in the homebase. Plant has 6 weaknesses; its upside may come later from the pod side of the game. Metal is a fortress with one strength, balanced by heavy, slow species.

**Still open:** can a creature have two types (for example a lichen-like Plant and Fungus)?

## 6a. Building your homebase

- **Biomes emerge from creatures and plants, through succession.** Each patch has three core conditions: **temperature, wetness and soil** (rich, poor, sandy, rocky or mineral-rich), plus **salt** near water (fresh, brackish, salt). These shift with what lives there: water creatures and wetland plants make it wetter, fire creatures warm and dry it, ice creatures cool it, trees shade it and hold moisture, poison creatures turn it boggy. The mother plant only hosts.
- **Disturbance is an event, not a condition:** fire, floods, overgrazing and trampling push a patch back in succession.
- **To add a biome,** plant that biome's plants and bring its creatures; they slowly convert the area. Patches grow, shrink and compete at their edges.
- **Light land shaping by hand:** dig a pond, clear a patch, move rocks. Large changes happen naturally.
- **Paths form where you walk**, like real desire paths, and make movement faster. Creatures make their own game trails.
- **Materials are wood and ore.**
  - **Wood** regrows if managed. Cutting too many trees dries the area, erodes soil, destroys habitat and pushes it toward scrub or grassland.
  - **Ore** is finite at home; new deposits form only very slowly through geology (volcanic patches, long-lived Earth creatures). The best deposits are in remote parts of the shared world, and a mined-out site there slowly refills if left alone. Mining scars land, and runoff pollutes water downhill for a while.
- **Metal creatures eat ore, and when one dies its remains slowly break down into a small new deposit where it fell, so ore cycles instead of disappearing. Fungus creatures speed this up. Mining is the only true drain, and the homebase's ore limits how many Metal creatures it can support.**
- **Structures:** built from wood and ore (fences, pens, nests, huts, bridges, gates, tools), or grown from seed as living structures like hedges.
- **Fences are simple:** one fence, built from wood or grown as a hedge, keeps creatures apart. Contented creatures stay home; unhappy ones wander off.
- **Economy:** earn cash by selling eggs, creatures, pods, produce, seeds and ore; spend it at stores on seeds, backpack upgrades and later decorations.
- **No player crafting skills.** Progress lives in your creatures and ecosystem.
- **Later:** shed feathers, scales and antlers as decorations; visitors to your homebase.
- **Shared world only:** elevation comes from real map data.

**No wild visitors in the homebase (for now).** It stays a closed, safe world, and every new creature comes from the shared world. Training at home is **sparring** between your own creatures. Pressure and surprise come from **natural events:** drought, storms, disease spreading through a species, hard winters, an overgrown plant taking over. Visitors could return later as a reward for a rich ecosystem.

**Similar games to learn from:** Viva Piñata (gardens that attract and support creatures), Niche (genetics and generations), Equilinox and Terra Nil (succession and biomes from conditions), Slime Rancher (home ranch plus expeditions), Eco (shared-world consequences of overharvesting), Pikmin Bloom (gentle real-world walking).

## How wild creatures are found

- **Homebase:** every creature is a real individual, visible, with its own genes, age and life.
- **Shared world:** each area remembers **population numbers, not individuals** (for example "about 40 Ramtarug, average level 12, growing"). That's what lets the world be endless.
- **The world is mostly quiet and empty-looking,** like real nature. **Most encounters are hidden:** walking through cover draws an encounter from that area's real population. Rare creatures are rare because there are only a few.
- **Occasionally a creature steps out into view,** then reacts by temperament: runs away (shy), attacks you (aggressive, starting a battle), or hides again. If a rare one hides again, you know roughly where, and searching that patch raises your odds.
- **Catching or defeating lowers an area's numbers;** releasing raises them; areas left alone grow and strengthen.
- **Ways to influence what you find:** habitat (species live in certain cover), signs (tracks, rustling, ripples), lures of favorite food, and time of day (nocturnal species at night). Unwanted encounters can be fled.

## Prototype build plan

Built in stages, each one playable and tested before the next. Placeholder art (simple shapes drawn in code) is used wherever a sprite isn't ready yet.

**View: low top-down** (the classic Pokémon and Stardew Valley angle) replaces the current isometric map, in stage 0. It matches how PixelLab draws the creature sprites, makes hiding in reeds and tall grass simple, and suits a D-pad.

**Early sprites to make:** the player character (8 directions, walking), swamp terrain tiles (marsh grass, mud, shallow water, tall reeds), two food plants for Ramtarug in 3 growth stages, and the mother plant. Later: egg and nest, pods (empty, sleeping, fainted), the door unfolding, remains, tracks and rustling grass.

**Temporary shared world: Atlanta (decided November 8).** Until GPS placement exists, the shared world is a generated Atlanta: the Chattahoochee and its rocky shoals, creeks with hardwood forest, loblolly pine stands, red clay, granite outcrops (Stone Mountain, Arabia Mountain), kudzu fields and powerline-cut meadows. Your starting creatures are not local.

| Creature | Type | Based on | Lives in | Eats |
| --- | --- | --- | --- | --- |
| Kudzoon | Plant | Kudzu | Kudzu fields, forest edges | Sunlight and soil; spreads fast |
| Thrummet | Bug / Air | Cicada | Hardwood forest | Tree sap; babies live underground |
| Scuffinch | Air | Brown thrasher | Undergrowth, meadows | Bugs from leaf litter |
| Flintback | Earth / Fire | Fence lizard on granite | Granite outcrops | Bugs |
| Shoalclaw | Water / Earth | Chattahoochee crayfish | River shoals, creeks | Algae and debris |
| Glimmerwick | Electric / Bug | Firefly | Meadows, creek edges at dusk | Nectar and dew |
| Possumbra | Spirit / Normal | Opossum | Everywhere | Almost anything |
| Clattershell | Metal / Earth | Armadillo | Pine stands, red clay | Grubs and roots |
| Duskhowl | Normal / Spirit | Coyote | Wide-ranging | Hunts smaller creatures |

- All nine start with placeholder art.
- A caught creature goes onto the vine until it is full, then into the bag. The bag holds 6 creatures (12 carried at most); with a full bag you can't catch.
- Bag and vine swaps happen only at certain places: springs and shoals in the world, and at your door.
- If your whole vine is beaten you're sent home, and the creatures recover over time (for now).
- Babies and adolescents can fight, weaker by the life-stage percentages.
- Creatures you carry still get hungry. You harvest food at home, carry it in the bag and feed them from their card. Stocking a pod with food comes with pods (stage 7).

**Breeding decisions (November 9).**

- No nests for now: eggs are laid on the ground in a sheltered spot that suits the species. Built nests can come with structures later (faster hatching, safety from egg-eaters).
- Every species' egg looks the same, so what's inside is a surprise. Eggs laid at home show their parents.
- You choose pairs with Choose mate on a creature's card; a bonded pair breeds only with each other. Unpaired adults can pair up on their own unless Don't breed is on. Fences can separate groups later.
- The card shows family: parents, mate, children and generation.
- Each gene has two copies, one from each parent. At birth one is picked at random to show; the other stays hidden and can be passed on. Each copy has a small chance (5%) to mutate.
- Same species only; no cross-species breeding or breeding groups for now.
- Siblings and parents can pair, with no penalty for now.
- Eggs can be carried out (each takes a creature slot in the bag) and keep developing while carried.
- Newborns start at level 1; only the starting pair begins at level 5.
- Population limits wait until after stage 6.

**Death decisions (November 10).**

- Old age comes in a window near the end of life that condition can influence: from 95% of lifespan the chance rises, about half are gone by 100%, none live past 112%.
- How long a creature survives on an empty stomach depends on its species (about half a day for small insects, a day for Ramtarug, up to about 4 days for Kudzoon).
- Creatures on the vine are in a light hibernation: they age normally but get hungry at a quarter of the speed.
- Remains lie about two days, help nearby plants, leave richer ground and feed scavengers (Possumbra, Duskhowl). Bones for building wait until building exists.
- Eggs on ground that doesn't suit them fail after about three times their hatching time.
- Every creature that dies is kept in a Remembered list, with its family links.
- Population is capped by food: a new homebase feeds about 6 Ramtarugs, rising as plants spread or are planted; hungry creatures don't breed, since breeding needs Good condition (crowding and smaller clutches for hungry mothers are ideas for later). Predation (in Atlanta's numbers and, with fences, at home) comes later.

**Pod decisions (November 10).**

- Pod size is a seed type, not a growing condition: a wetland homebase grows small, medium and large marsh pods. Pods are their own seeds: plant an empty pod to grow a pod plant of that size. A plant that grows well gives more pods each time you pick it (1 to 3).
- Pods carry the biome they grew in; marsh pods suit creek and shoal creatures best.
- Empty pods are kept separately and take no bag space.
- Vine creatures are awake: they age normally and get hungry at a quarter of the speed. Bag creatures sleep fully in their pods: no hunger, aging at half speed.
- Until the full catching scene (stage 8), a refused catch sometimes (1 in 4) means the creature attacks the pod and breaks it.
- You can pack up to 3 food items in a creature's pod; on the vine it eats them by itself when hungry.
- Creatures can be released in the wild (they join the local numbers) but not at home.

**Progress:** stage 0 is done (November 5) and stages 1 and 2 are done (November 6) and stages 3 and 4 are done (November 8), with Atlanta as the temporary shared world, stage 5 is done (November 9) and stages 6 and 7 are done (November 10) and stage 8 is done (November 11). The door and placeholder shared world moved up to stage 4, so battles keep working once the homebase holds only your own creatures.

| # | Stage | What it adds |
| --- | --- | --- |
| 0 | **Foundations** (done) | Split the game's single code file into parts (world, creatures, plants, battle, saving) so it can grow. New save format built around real-world timestamps. Low top-down map. |
| 1 | **Homebase land** | A small homebase map with the three conditions (temperature, wetness, soil) per patch, a simple succession rule that slowly changes the ground, the mother plant at the center, and the player walking around. Walking speed raised by about 50%. |
| 2 | **Plants and seeds** | Start with seeds of Ramtarug's food plants. Plant them, watch them grow through stages, spread and get eaten. Plants push the land's conditions. Soft collision: creatures step aside when you walk into them, you slow slightly but are never blocked, and creatures keep a little space from each other. |
| 3 | **Creatures at home** | Start with a male and a female Ramtarug; no wild creatures at home. They eat, get hungry, age through the four life stages in real days, and have a condition score. Time keeps running while the game is closed, with a "while you were away" report on return. **New homebase controls:** joystick, an Act button (plant, harvest, inspect, enter the door), a Creatures menu to choose which 6 go on your vine, and a Bag for seeds, items and spare pods. FIGHT and CATCH leave the homebase. |
| 4 | **The door and a placeholder shared world** (moved up so battles keep working) | The door unfolds from the mother plant into an endless, quiet, generated world (grass, reeds, trees, water). Areas track population numbers; hidden encounters are drawn from them; creatures occasionally step out and run, attack or hide. |
| 5 | **Breeding and eggs** | Adults pair up and lay eggs in nests; eggs incubate and hatch. Babies inherit stat genes and one move from each parent. |
| 6 | **Death and remains** | Old age and hunger cause death. Remains fertilize nearby plants for a day or two. A simple family tree records every creature. |
| 7 | **Pods and the vine** | Each creature has its own pod. The vine holds 6; the rest go in the backpack. Swapping happens at the homebase. Pod size and biome fit matter for catching. |
| 8 | **Battle stats** | Six stats (HP, Attack, Defense, Elemental, Resistance, Speed) from species base × genes × level × life stage × condition. Species base stats; two new genes for Elemental and Resistance; genes multiply per-level growth. Habitat advantage. Springs heal a little (once an hour) instead of fully. Roaming wild creatures no longer show level or sex. |
| 9 | **Moves** | A full original move list with names, types, power and effects, each physical or elemental. Species learn moves at set levels. Know many, bring 4, changed at healing places. Three mastery levels from use. |
| 10 | **Bond** | Each creature's bond with you: what builds it and what it changes, including whether a fainted creature stays with you or runs off into the wild. |
| 11 | **Catching and fainting** | The pod scene: it walks in, hesitates, attacks the pod or flees, with a hidden chance and mood hints. Fainting: a fainted creature with a weak bond runs off and hides in the wild until it recovers (you can try to find it, others might catch it); a well-bonded one stays and you take it home. Nursing: feed it healing leaves from a healing plant and let it rest in its pod at home within about a day, or it dies (the hard option, for now). |
| 12 | **Mentoring and sparring** | Young creatures gain experience at home up to 70% of the best mentor's level. Sparring between your own creatures. Mastered moves can be taught. |
| 13 | **Economy** | Cash from selling eggs, creatures, pods and produce. A store selling seeds and backpack upgrades. |

**Later:** wood and ore, fences and structures, natural events (drought, storms, disease), real-time day and night, more species, real map data, servers.

## Still to discuss

6. Building your homebase and the shared world
7. Player-made sprites and in-game currency, with admin approval
8. Shared-world maps: generated from real map data or hand-designed for real places like Piedmont Park
9. Movement: real GPS walking like Pokémon Go, or enter once and explore with the D-pad, with places like Piedmont Park as dungeon-like areas
10. Busy versus empty places: partly settled by topic 5 (creatures left alone grow strong); still to decide how player-released creatures fit in

## Later list

- Karma (good and evil) and finishing creatures in battle, allowed only in risk zones or by agreement
- Opening story and intro dialogue, like a Pokémon intro
- Looking inside pods
- Traps: leave a lured trap and come back for it; other players could steal it
- Genes changing appearance (on hold). Colors and sizes can vary for free in code; shape changes need new PixelLab art.

## Related

- The creature gene catalog is in the separate doc "Homebase Creature Genes".

## Status effects (decided November 14)

Not built as one system. Each status goes in when the first species that uses it gets its moves (stage 9, species by species).

### Time

- One clock for battle and world: **1 turn = 5 minutes**. After battle, turns left become time; entering a battle turns time left back into turns (rounded up).
- Time runs for every carried creature, in or out of the fight: on the vine at normal speed, in the bag at half, at home at double. Benched creatures keep ticking.
- Statuses carry into the next battle.
- Lingering damage **can kill while you're away**. A creature in its pod at the mother plant is safe (taking it home stops the dying). May soften later if too harsh.
- Each status gets its own real-world cure later (plant cures, later stage). Washing does not cure everything; springs don't cure statuses. For now: time, and home rest at double speed.

### Stacking

- Unlimited different statuses at once.
- **Same status again = a new copy with its own clock.** All copies count down together; the level is how many are running (max 3; a 4th replaces the oldest). Example: poison at turn 0 and turn 1 → level 2 until turn 24, then level 1 for one more turn.
- Statuses without levels add their turns to the end instead: **Wet, Mute, Festering**. A second **Disable** locks another move. **Knocked down, Leech, Berserk**: a second hit does nothing.
- Poison creatures can't be poisoned (other type immunities decided as we go). Poison stays at 2% a turn for 24 turns per copy (one \~48%, two \~96%, three \~144%): several poisonings means go home and heal.

### Losing turns

Action-stealers roll **in succession**, in this order, and the first that triggers stops the action: Knocked down → Asleep → Paralysis → Fear → Confusion (acts, but may hit itself). **Every active status ticks down each turn** whether it triggered or not. No cap; counters to come with moves. Berserk isn't a turn-stealer: it takes the choice of move, but the creature always acts.

### The list (draft numbers)

| Status | In battle | Turns | Mainly from |
| --- | --- | --- | --- |
| Burn | 2/3/4% damage a turn, Attack −25/35/45% | 12 | Fire |
| Poison | 2% a turn per copy (2/4/6%) | 24 | Poison, Fungus |
| Bleed | 4/6/8% each turn it acts; outside battle only bleeds on the vine | 8 | Normal, Metal, Bug |
| Paralysis | 25/35/45% to lose its action | 6 | Electric |
| Fear | hesitates 20/30%, Elemental −25%; level 3 **Panic**: wild flees, yours tries to swap out or cowers | 4 | Spirit |
| Tangle | can't flee or swap, Speed −20/35%; level 3 **Bound**: can't dodge or use physical moves | 4 | Plant, Bug |
| Frost | Speed −40/60%, can't dodge; level 3 **Frozen**: loses 1 action, then back to Frost 1 | 6 | Ice |
| Wet | its Fire moves −25%; Paralysis and Frost twice as likely to land | 6 | Water (later also creeks, rain) |
| Leech | loses 3% a turn to the leecher while it's still fighting | ends with battle | Plant, Bug |
| Knocked down | loses next action, +25% damage taken until up; can't be knocked down again for 2 turns | 1 | Earth, Normal, Metal |
| Confusion | 33/45/55% to hit itself | 4 | Air, Spirit |
| Mute | no elemental moves | 3 | Normal, Air |
| Disable | locks one move **you choose from moves you've seen it use**; a wild creature disables your strongest | 3 | Metal, Electric |
| Festering | no healing of any kind | 12 | Bug, Fungus, Poison |
| Berserk | uses its strongest physical move automatically, Attack +30%, Defense −20%; also triggers on its own from a high **Temper** gene when badly hurt | 3 | Fire, Normal |
| Blind | physical accuracy −30/40/50% | 4 | Earth, Air |
| Drowsy | Speed −20%; falls asleep after 2 / 1 turns / at once (level 3), loses 1–2 actions, wakes early if hit | 4 | Fungus |
| Fatigued | from running out of stamina (below) | until stamina is back to \~30% | — |

### Stamina (instead of PP)

- A **stamina bar that starts full and goes down**. Maximum and refill rate by species (Clattershell and Duskhowl high, Glimmerwick and Thrummet low), plus a new **Stamina** gene (Winded / Average / Tireless, about ±10%).
- **One shared pool** for physical and elemental moves: light moves 0–5, normal about 10, heavy about 25. A separate Focus pool for elemental moves may be discussed later.
- **Hidden in battle.** Messages instead: "…is tiring" (about 25% left), "…is exhausted!" (0, now Fatigued), "…got its second wind" (recovered). The card shows a word outside battle: Fresh, Winded, Exhausted.
- No penalties until empty. **Fatigued**: only light moves; Attack, Elemental and Speed −20%; much easier to catch.
- Recovers a little each turn it doesn't attack, faster on the bench, and after battle on the same clock (vine normal, bag half, home double); slower when hungry.

### Catching

Only the best helpful status counts; every harmful one applies.

| Effect | Statuses |
| --- | --- |
| ×2 | Fatigued, Asleep, Frozen, Bound |
| ×1.5 | Drowsy, Paralysis, Tangle, Knocked down |
| ×1.2 | Confusion, Blind |
| Harder | Fear ×0.7, Panic ×0.4 (may flee), Berserk ×0.6 (may break the pod) |
| None | Burn, Poison, Bleed, Frost 1–2, Wet, Leech, Mute, Disable, Festering |

Damage statuses help only by lowering health, and they come home with the creature. Stage 11's pod scene shows them as mood hints.

### Later

Helpful lingering statuses (Well-fed, Rested, Warmed up); plant cures per status; Marked (with predation); a Focus pool.

## Moves (stage 9, decided November 16)

### Rules for every species

- Moves are designed **species by species**. Each move has a type, a kind (physical, elemental or support), power, accuracy, stamina cost, and any effect.
- **Each type can have both physical and elemental moves**; a species' moves should suit its stats.
- **Learnsets:** each species learns moves at set levels; some also need a life stage. A move is learned on the first level-up where both are met (a level-25 baby learns a level-23 adolescent move at its first level-up after growing up).
- Creatures remember every move they learn and **bring 4** into battle, swapped at home, your door, springs and shoals.
- **Newborns** know the species' level-1 moves plus one move inherited from each parent (nothing is replaced).
- **Mastery:** Novice → Practiced → Mastered with use; each step adds about 10% power and accuracy. Mentors teach only mastered moves (stage 12); mastered moves are likelier to pass to eggs.
- **Status chance and length are set by the move**, not the status: the status decides what happens each turn, the move decides how likely and for how many turns.
- **Status moves should be fairly rare:** each species has one signature status plus one or two others, with low chances on side effects. Most damage moves are clean hits.
- **Stat ups and downs last the battle, and stay with a creature when it's switched out and back in**; statuses run on their own clocks.
- **Stat stages (to try):** ±4 cap; up = (4 + n) ÷ 4, down = 4 ÷ (4 + n). +1 = 1.25×, +2 = 1.5×, +4 = 2×; −1 = 0.8×, −2 = 0.67×, −4 = 0.5×. Opposite stages cancel. Moves can change one or two stages, or several stats at once, and trade-off moves can raise some stats while lowering others. Gentler than Pokémon's ±6 (×4 / ×0.25) because ours survive switching.
- **Critical hits:** 5% base chance, ×1.5 damage. Message: "A critical hit!" Precise moves (claws, fangs, stingers) can have a higher crit chance, set per move (none of Ramtarug's). Hitting a knocked-down creature doubles the crit chance. Not yet: armoured species taking fewer crits. A crit ignores the target's Defense or Resistance boosts and the attacker's own drops (changes in the attacker's favour still count).
- **Elders vary by species:** elder-only moves (none, one, or several), when the elder stage starts and how long it lasts, and which stats rise or fall (instead of the current flat −15% Attack and Speed).
- No turn bar (speed = turn order and dodge only). Existing creatures get moves from their species list.
- Leveling is flat 100 XP a level for now; a rising curve may come once a few species have moves.

### Ramtarug (Poison)

A pink swamp ram with warning spots; horns nubs as a baby, curled by adolescence, full spirals as an adult; elders fade pale with a white beard. Signature status: Poison. Even stats, so a mix of physical and elemental. **Elder stats:** Defense and Resistance +10%, Attack and Speed −15%. Starters (level 5) know only Bump, so they can't hurt Possumbra or Duskhowl until Sour Spit at level 7 (kept on purpose).

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Bump | Normal | Physical | 35 | 100% | 3 | — |
| 7 | — | Sour Spit | Poison | Elemental | 30 | 100% | 4 | 30% Poison, 4 turns |
| 10 | — | Warning Spots | Poison | Support | — | 90% | 6 | Foe's Attack down; 10% Fear, 3 turns |
| 17 | — | Mud Kick | Earth | Physical | 50 | 95% | 8 | 10% Blind, 3 turns |
| 23 | Adolescent | Ram | Normal | Physical | 65 | 95% | 10 | 5% Knocked down |
| 29 | Adolescent | Foul Bite | Poison | Physical | 60 | 100% | 10 | 30% Festering, 8 turns |
| 36 | Adult | Swamp Gas | Poison | Elemental | 60 | 90% | 12 | 40% Poison, 16 turns |
| 40 | Adult | Toxic Hide | Poison | Support | — | — | 12 | Defense up for the battle; anything that hits it has a 30% chance of Poison for 6 turns, for 10 turns |
| 46 | Adult | Skullcrack | Normal | Physical | 100 | 85% | 25 | 30% Knocked down |
| 52 | Elder | Old Ram's Stand | Normal | Support | — | — | 15 | Clears one of its own statuses; Defense and Resistance up |

### Scuffinch (Air) — built November 16

Based on the brown thrasher (Georgia's state bird): rust-brown, streaked cream breast, yellow eye, long curved bill, long tail. Flicks leaf litter with its bill, sings over a thousand songs (each phrase twice), fiercely defends its nest. Fast, physical, fragile; short-lived (21 days), so its moves come earlier. Signature status: Blind. **Stamina 0.8. Elder:** Speed −20%, Attack −10%, Elemental +10%, Resistance +5%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Peck | Air | Physical | 35 | 100% | 3 | 12% crit |
| 5 | — | Leaf Flick | Normal | Physical | 25 | 100% | 4 | 20% Blind, 2 turns |
| 9 | — | Wing Attack | Air | Physical | 45 | 100% | 5 | — |
| 14 | — | Double Phrase | Air | Elemental | 25 ×2 | 95% | 8 | Hits twice; each hit can crit |
| 20 | Adolescent | Dirt Scuff | Earth | Physical | 55 | 95% | 9 | 10% Blind, 3 turns |
| 26 | Adolescent | Borrowed Song | Air | Support | — | 100% | 10 | Uses the last elemental move the foe used, with its own Elemental |
| 32 | Adult | Hedge Dive | Air | Physical | 80 | 90% | 14 | 25% crit |
| 36 | Adult | Dawn Chorus | Air | Support | — | — | 8 | Clears Drowsy, sleep and Fear from the whole team (bench too); can't get drowsy for 5 turns |
| 40 | Adult | Scolding Call | Normal | Support | — | 90% | 8 | Foe's Attack down; 20% Mute, 3 turns |
| 44 | Adult | Nest Fury | Normal | Physical | 90 | 90% | 22 | 25% crit; its own Defense drops after |
| 50 | Elder | Thousand Songs | Air | Elemental | 70 | 95% | 15 | 30% Confusion, 3 turns |

Sprite (when PixelLab is connected): baby a fluffy nestling with a stubby tail; adolescent sleeker with streaks coming in; adult full colour, long tail; elder greyer, duller eye, ragged tail.

**Notes from this session:** each species can space its levels differently; some species may change drastically between stages or skip adolescence (insects); generic move names like Peck and Wing Attack are fine.

## Life stages and wild area levels (decided November 16)

- **Life stage strength:** baby 70%, adolescent 85%, adult 100% (was 50/80/100). A same-level baby is then about 3× weaker than an adult in a fight, like Pokémon's first evolution stage against its last (was about 8×).
- **The temporary Atlanta is now 256×192 tiles** (about 2 minutes to walk across; 2–3 minutes to the far corner with detours). Still a stand-in for GPS placement.
- **Area levels:** each 16×16 area has a **potential** (about 3 near your door, up to **50** in remote wild land: forest, river, granite, pines) and a current **level**.
  - Left alone, it grows about **2 levels a day** up to its potential, then **half a level a day for the next 20**, then each further 10 takes twice as long as the last. **No cap**, everywhere.
  - Each battle won or creature caught there knocks it down (1 level + 3%).
  - Wild creatures spread around the area's level by age: babies \~60%, adolescents \~80%, adults \~100%, elders \~110%.
  - New worlds start areas at half their potential. The header shows "Around Lv N" for the area you're in.

### Kudzoon (Plant) — built November 16

"The vine that ate the South": a slow, tough smotherer that keeps growing, lulls foes with grape-scented blooms, and is hard to put down. Signature status: Tangle (with Leech and Drowsy). Stages: seedling → runner → flowering mound → woody crown. **Lives 40 days; elder from 70% of its life** (days 28–40). **Elder:** HP +10%, Defense and Resistance +15%, Speed −20%, Attack −5%. **Stamina 1.2.**

**A Foot a Day (species trait):** each round it stays in, it gains 6% of its current HP, with no cap, and can go over its max. Lost when swapped out. A hurt Kudzoon grows slower.

**Blanket the Hills (first battlefield effect):** Overgrown for 5 turns: Plant moves +25%, non-Plant creatures 20% slower, Tangle 1.5× as likely.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Vine Whip | Plant | Physical | 35 | 100% | 3 | — |
| 6 | — | Creeping Runner | Plant | Support | — | 95% | 5 | Foe's Speed down; 30% Tangle, 3 turns |
| 11 | — | Taproot | Plant | Elemental | 35 | 100% | 6 | 50% Leech, 8 turns |
| 16 | — | Leaf Fold | Plant | Support | — | — | 6 | Resistance up; heals 10% |
| 22 | Adolescent | Smother | Plant | Elemental | 60 | 95% | 10 | 30% Tangle, 4 turns |
| 30 | Adult | Grape Bloom | Plant | Support | — | 90% | 8 | 40% Drowsy, 4 turns |
| 34 | Adult | Blanket the Hills | Plant | Support | — | — | 14 | Overgrown field, 5 turns |
| 40 | Adult | Strangle | Plant | Physical | 70 | 95% | 14 | ×1.5 power vs Tangled; 30% Tangle, 4 turns |
| 44 | Adult | Topple | Normal | Physical | 85 | 85% | 20 | 15% Knocked down |
| 48 | Adult | Deep Crown | Plant | Support | — | — | 15 | 3 turns: survives one knockout at 1 HP; heals 5% a turn |
| 54 | Elder | Woody Crown | Plant | Support | — | — | 15 | Defense and Resistance up 2; heals 25% |

Statuses it brought: Tangle (can't flee or swap, Speed −20/35%; Bound at 3: no physical moves, can't dodge), Leech (the leecher drains 3% a round while it's fighting), Drowsy (Speed −20%; asleep after 2/1/0 rounds), Asleep (loses 1–2 actions; wakes when hit).

For the diet stage: at home it enriches poor soil but smothers nearby plants if unchecked.

**Damage now scales with level** (built with Kudzoon): damage × (18 + 8 × attacker's level) ÷ 58, matching how health grows, so fights take about the same number of hits at any level (about 11 Bumps between equal adults at level 5 or 50).

## Moves for the remaining seven species (drafted November 16, built November 17)

Built November 17 with the decisions below. Each has a concept, a signature status, any new mechanic, and a learnset. Statuses still to arrive: Burn (Flintback), Bleed (Shoalclaw, Duskhowl), Paralysis (Glimmerwick), Wet (Shoalclaw), Berserk (Duskhowl). Frost waits for an Ice species.

### Thrummet (Bug/Air) — the cicada

Spends most of its life as a nymph underground, then climbs out, splits its skin, and drones in the treetops for a short loud adulthood. **Stages: no adolescence** — nymph (baby, 0–70% of life) → winged adult (70–95%) → elder. Wing moves need the adult stage. Signature: **Confusion** from its deafening drone. **New mechanic: stamina drain** (its drone wears the foe out). Stamina 0.9. Elder: Speed −20%, Elemental +10%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Pierce | Bug | Physical | 35 | 100% | 3 | 12% crit |
| 6 | — | Sap Tap | Bug | Elemental | 30 | 100% | 5 | Heals half the damage it deals |
| 11 | — | Dig In | Earth | Support | — | — | 5 | Defense up (the nymph in its burrow) |
| 16 | — | Mud Burst | Earth | Physical | 50 | 95% | 8 | Bursts up through the soil |
| 22 | Adult | Molt | Bug | Support | — | — | 10 | Sheds its skin: clears all its statuses and stat drops |
| 26 | Adult | Drone | Air | Elemental | 50 | 95% | 8 | Foe loses 15 stamina; 20% Confusion, 3 turns |
| 32 | Adult | Wing Whir | Air | Physical | 60 | 100% | 9 | — |
| 38 | Adult | Chorus Swell | Bug | Support | — | — | 10 | Its Elemental up; foe loses 10 stamina |
| 44 | Adult | Seventeen Years | Bug | Elemental | 95 | 90% | 24 | 30% Confusion, 3 turns |

### Flintback (Earth/Fire) — the fence lizard on hot granite

Basks on sun-hot rock until it's fast and fiery, bobs push-ups to warn rivals, and drops its tail to escape. Signature: **Burn**. **New mechanics:** a second battlefield effect (Hot Rocks) and a decoy (Tail Drop). Stamina 1.0. Elder: Speed −15%, Elemental +10%, Resistance +5%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Flint Strike | Fire | Physical | 35 | 100% | 3 | 10% Burn, 3 turns |
| 5 | — | Push-Ups | Normal | Support | — | 95% | 5 | Its Attack up; foe's Attack down |
| 10 | — | Grit Spray | Earth | Elemental | 40 | 95% | 6 | 10% Blind, 2 turns |
| 15 | — | Bask | Fire | Support | — | — | 6 | Speed and Elemental up |
| 21 | Adolescent | Hot Stone | Earth | Physical | 60 | 95% | 10 | 20% Burn, 4 turns |
| 27 | Adolescent | Tail Drop | Normal | Support | — | — | 10 | Once a battle: its dropped tail takes the next hit for it, and it can then flee even if tangled |
| 33 | Adult | Flint Flash | Fire | Elemental | 70 | 95% | 12 | 30% Burn, 6 turns |
| 38 | Adult | Hot Rocks | Fire | Support | — | — | 14 | Field, 5 turns: Fire moves +25%, Burn 1.5× as likely, Plant creatures 20% slower |
| 44 | Adult | Granite Slam | Earth | Physical | 90 | 90% | 20 | — |
| 50 | Elder | Old Coal | Fire | Elemental | 100 | 90% | 24 | 40% Burn, 8 turns |

### Shoalclaw (Water/Earth) — the Chattahoochee crayfish

Armoured, heavy-clawed, slow; stirs up silt, digs mud chimneys, and flips backward with its tail to escape. Signature: **Bleed** from its claws. Brings **Wet**. **New mechanic: an escape move** that swaps out even when tangled. Short life (18 days). Stamina 1.0. Elder: Attack +10%, Defense +10%, Speed −20%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Pinch | Normal | Physical | 35 | 100% | 3 | 12% crit |
| 5 | — | Silt Cloud | Water | Elemental | 30 | 100% | 4 | 20% Blind, 2 turns |
| 9 | — | Riffle Splash | Water | Elemental | 45 | 100% | 6 | 50% Wet, 6 turns |
| 14 | — | Claw Clamp | Water | Physical | 55 | 95% | 9 | 30% Bleed, 4 turns |
| 19 | Adolescent | Mud Chimney | Earth | Support | — | — | 8 | Defense up 2 |
| 24 | Adolescent | Tail Flip | Water | Support | — | — | 8 | Swaps out at once, even if tangled; the next creature comes in free |
| 29 | Adult | Riverbed Rake | Earth | Physical | 70 | 95% | 12 | 10% Knocked down |
| 34 | Adult | Crushing Claw | Water | Physical | 85 | 90% | 18 | 25% crit; 30% Bleed, 5 turns |
| 40 | Elder | Old Pincer | Normal | Physical | 100 | 85% | 22 | 40% Bleed, 6 turns |

### Glimmerwick (Electric/Bug) — the firefly

Tiny, fast, fragile, all light. Flashes in patterns, and like the predatory firefly that fakes other fireflies' flashes, lures prey in. Signature: **Paralysis**. **New mechanic: a trait** — Afterglow: when it faints, the creature that beat it has a 50% chance of Paralysis. Very short life (14 days), levels fast. Stamina 0.7. Elder: Speed −20%, Elemental +5%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Glint | Electric | Elemental | 30 | 100% | 3 | 10% Paralysis, 2 turns |
| 4 | — | Flash Pattern | Electric | Support | — | 90% | 4 | 30% Blind, 2 turns |
| 8 | — | Static Touch | Electric | Elemental | 45 | 100% | 6 | 20% Paralysis, 3 turns |
| 12 | — | Night Swarm | Bug | Elemental | 20 ×3 | 90% | 8 | Hits 3 times |
| 17 | Adolescent | False Signal | Electric | Support | — | 90% | 8 | Lures it in: foe's Defense and Resistance down |
| 22 | Adult | Glowworm Drift | Bug | Support | — | — | 6 | Speed up; next hit on it 50% to miss |
| 27 | Adult | Heat Lightning | Electric | Elemental | 80 | 90% | 14 | 30% Paralysis, 4 turns |
| 33 | Elder | Last Light | Electric | Elemental | 110 | 95% | 25 | Spends itself: it loses half its current health |

### Possumbra (Spirit/Normal) — the opossum that plays dead

Calm, hardy scavenger: hisses with fifty teeth, plays dead so convincingly that foes lose interest, shrugs off snake venom, grooms off ticks. Signature: **Fear**. **New mechanics:** Play Dead (a wild Possumbra may end the battle by fooling you; yours makes the foe waste its next attack) and a trait — Venom-Proof: can't be poisoned. Stamina 1.1. Elder: HP +10%, Resistance +10%, Speed −15%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Nip | Normal | Physical | 35 | 100% | 3 | — |
| 5 | — | Fifty-Tooth Hiss | Normal | Support | — | 90% | 5 | Foe's Attack down; 30% Fear, 3 turns |
| 10 | — | Moonless Stare | Spirit | Elemental | 45 | 100% | 6 | 15% Fear, 3 turns |
| 15 | — | Tail Grip | Normal | Physical | 45 | 95% | 7 | 25% Tangle, 2 turns |
| 21 | Adolescent | Play Dead | Spirit | Support | — | — | 10 | Foe's next attack misses; a wild Possumbra may slip away (ends the battle) |
| 27 | Adolescent | Tick Groom | Normal | Support | — | — | 8 | Heals 15%; clears Leech and Bleed |
| 33 | Adult | Scavenge | Spirit | Support | — | — | 10 | Heals 30% |
| 39 | Adult | Graveyard Shift | Spirit | Elemental | 75 | 95% | 14 | 25% Fear, 4 turns |
| 46 | Elder | Death Scent | Spirit | Elemental | 90 | 95% | 20 | 30% Fear, 4 turns; 30% Festering, 6 turns |

### Clattershell (Metal/Earth) — the armadillo

Slow, heavily plated, digs for grubs, and when startled leaps straight up, three or four feet. Signature: **Knocked down**. **New mechanics: a two-turn move** (Burrow: digs in one turn, erupts the next and can't be hit meanwhile) and **a move that grows each time it's used in a row** (Clatter Roll). Stamina 1.2. Elder: Defense +10%, Speed −20%.

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Root Out | Earth | Physical | 35 | 100% | 3 | — |
| 6 | — | Ball Up | Metal | Support | — | — | 5 | Defense up 2 |
| 11 | — | Startle Leap | Normal | Physical | 45 | 95% | 7 | 30% Knocked down |
| 17 | — | Plate Bash | Metal | Physical | 55 | 100% | 8 | — |
| 23 | Adolescent | Burrow | Earth | Physical | 80 | 100% | 14 | Two turns: underground (can't be hit), then erupts |
| 29 | Adolescent | Clatter Roll | Metal | Physical | 40 | 90% | 8 | Power doubles each time in a row (up to 4 times) |
| 35 | Adult | Grub Feast | Earth | Support | — | — | 10 | Heals 25% |
| 41 | Adult | Iron Hop | Metal | Physical | 90 | 90% | 20 | 30% Knocked down |
| 48 | Elder | Ironhide | Metal | Support | — | — | 15 | Defense and Resistance up 2; heals 15% |

### Duskhowl (Normal/Spirit) — the coyote, rare

The apex hunter: strong, long-lived, rare. Runs prey down, yip-howls at dusk, and in a frenzy stops thinking. Signature: **Bleed** and **Fear**; brings **Berserk** (also from a high Temper gene when badly hurt). **New mechanic: Stalk** (its next hit is a sure critical hit). Stamina 1.3. Elder: Attack −10%, Elemental +10%, Resistance +10% (the old pack leader).

| Level | Stage | Move | Type | Kind | Power | Acc | Stamina | Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | — | Snap | Normal | Physical | 40 | 100% | 3 | 12% crit |
| 7 | — | Yip Call | Spirit | Support | — | 90% | 5 | Its Attack up; 20% Fear, 2 turns |
| 13 | — | Hamstring | Normal | Physical | 55 | 95% | 9 | Foe's Speed down; 20% Bleed, 4 turns |
| 19 | — | Stalk | Spirit | Support | — | — | 8 | Its next hit is a critical hit |
| 26 | Adolescent | Dusk Howl | Spirit | Elemental | 65 | 95% | 12 | 30% Fear, 3 turns |
| 33 | Adult | Run Down | Normal | Physical | 75 | 95% | 14 | ×1.5 power against a slower foe |
| 40 | Adult | Frenzy | Normal | Support | — | — | 12 | Goes Berserk for 3 turns; Attack up 2 |
| 47 | Adult | Shadow Lope | Spirit | Physical | 95 | 90% | 22 | 30% Bleed, 5 turns |
| 55 | Elder | Pack Leader's Call | Spirit | Support | — | — | 15 | Your whole team's Attack up (bench included) |

### Draft decisions (November 17)

- **Shared generic moves:** plain actions are reused across species (each with one small quirk); unique moves are kept for signature behaviour. Pool so far: Bump (35, plain), Bite (40, 5% Fear), Peck (Air, 35, 12% crit), Pinch (35, 10% Bleed 2 turns), Scratch (35, 10% crit, 5% Bleed), Dig (two turns: underground, can't be hit, then erupts), Splash (Water), and basic Electric moves usable by any Electric creature (names to pick, e.g. Zap and Shock).
- **Type can change by life stage:** Thrummet is Bug/Earth as a nymph and Bug/Air as an adult (type chart and own-type bonus follow the current type).
- **Life-stage strength can vary by species** (70/85/100% is the default).
- **Thrummet:** Mud Burst → **Emergence**; **Molt** becomes an Air move.
- **Flintback:** as drafted, for testing.
- **Shoalclaw:** Riffle Splash → **Splash**. Mud Chimney name still open.
- **Glimmerwick:** Glint and Static Touch become basic shared Electric moves. **Flash Pattern:** support, 85% accuracy, 100% Blind for 2 turns (no damage).
- **Clattershell:** Ball Up → **Brace** (Defense up 2); Burrow → shared **Dig**; Clatter Roll and Creek Walk removed; Startle Leap → **Pounce**; Grub Feast → **Grub**; Iron Hop → **Heavy Landing**. Root Out name still open.
- **Duskhowl:** Shadow Lope → **Moon Chase**.
- **Possumbra:** Scavenge becomes Normal. Play Dead to do more (proposed: next attack misses, full stamina back, foe's Attack down, a wild foe may wander off).

**Built November 17 (6a9cefa):** all seven drafts above with the decisions listed, for playtesting. Shoalclaw's Defense move is **Mud Fort**; Clattershell starts with shared **Bump**; Glimmerwick's basic moves are shared **Zap** (30, 10% Paralysis) and **Shock** (45, 20% Paralysis). Play Dead as proposed (next attack misses, stamina back, foe's Attack down, a wild foe may wander off; a wild Possumbra may slip away). A wild Shoalclaw's Tail Flip lets it escape. Hot temper: below 25% health, a creature with Temper above 0.75 may go Berserk (60%, once a battle). Burns and bleeding can kill on trips, like poison. Stats are untouched, pending the Stats pass.

## To work on: Stats

A dedicated pass on creature numbers, before or alongside building the remaining species:

- **Base stats per species and per life stage:** each stage gets its own six base stats instead of one strength multiplier plus elder tweaks (e.g. Thrummet's nymph tough and slow, its adult fast and fragile). This also covers type changing by stage.
- **Leveling speed by species and life stage:** e.g. short-lived species level fast, long-lived slowly; babies learn quickly, elders slowly.
- **Overall strength by species:** stat totals from weak (fast-leveling, common) to strong (slow-leveling, rare); draft placement: Glimmerwick weak and very fast, Shoalclaw/Scuffinch below average and fast, Possumbra/Flintback/Ramtarug average, Clattershell/Thrummet/Kudzoon above average and slow, Duskhowl strong and very slow.
- **Rarity by species, land type and life stage:** each species gets a rarity tier (absent, very rare, rare, uncommon, common) for each kind of land, replacing the single habitat weights; elders rarer in the wild than adults; rare species favour high-level areas.
- **XP curve:** whether each level should cost more than the last.

## Appearance genes (built November 17)

- **Art first, genes to match.** Each species' look is designed by hand (PixelLab sprites); its part genes are written from the finished sprite. Keep each species to two or three standout features. The Atlanta species stay close to their real animals with creature proportions and one invented touch tied to their type; stranger creatures come later through breeding, mutation and new species splitting off.
- **Colour from genes (live):** two genes, Main colour and Accent colour (0.6–1.4, 1 = the species' usual). Each species names its sprite's colour ramps by hue band and how far each may turn (`palette` in `species.jsx`); the game recolours those pixels per creature. Ramtarug's magenta runs between purple-pink and rose (±30°), its orange spots between red-orange and gold (±25°). Greys and whites stay put. Placeholder art uses the same rules.
- **Size from genes** already scales a creature on the map and in battle.
- **Part genes (in the background):** head, eyes, pupils, ears, crown, mouth, back, ridge, tail, covering, pattern, feet, build. Two copies each; the higher-ranked copy shows; children get one copy from each parent; 2% mutation per copy. Each species has a founder set written from its sprite. Ramtarug: wide flat head, big round eyes, bar pupils, round ears, curled horns, wide smile, plain back, dorsal plates, leaf tail, smooth skin, spots, padded paws, stocky. Scuffinch (November 18): narrow, fierce eyes, bare head, long curved bill, folded wings with white bars, long upright tail, feathers, fine streaks; it can carry a small crest tuft or spots hidden, and nothing else. Thrummet (November 20, from the adult): big bulging red eyes, clear veined wings folded like a roof, a pale-blue shimmer on the wing edges, short antennae, hard insect shell, black markings, six jointed legs; it can carry big digging forelegs (its nymph's) hidden, and nothing else. Its colour genes turn the olive body (main) and the red eyes with orange wing veins (accent, which also covers the nymph's tan shell); the blue shimmer stays put. Wild creatures and starters carry a different hidden copy about a third of the time. Bird parts (bill, crest tuft, folded wings, long upright tail, feathers, fine streaks) and insect parts (bulging red eyes, roofed wings, wing shimmer, antennae, shell, black markings, jointed legs, digging forelegs) only turn up hidden where a species lists them, so they never appear on Ramtarug. The Genes & family page lists what it shows and what it carries hidden. Parts don't change the drawing yet.
- **Later:** pick one or two parts per species worth seeing and generate sprite variants for them; use the distance from the species' founder (not a single parent) as the breeding limit and the start of speciation; rare colour morphs (e.g. leucistic, melanistic).

## Behavior stage (planned; merges with Diets and food web)

How each species moves, rests, forages, hides and reacts to you, built after the Stats pass. Includes real diets, whole-plant eating and predation (from the Diets and food web plans), plus:

- **Flying and perching (decided November 18):** flyers move between trees and perches instead of walking. Perched, they're drawn up in the tree; flying, they cast a shadow on the ground below. Water and thickets don't block them.
  - Each flyer has its own habits: **Scuffinch** forages on the ground, hides in thickets, flies low and short between cover, and sings from a high perch. **Thrummet** adults live up in the trees and drone there. **Glimmerwick** drifts through the air at dusk.
  - **Encounters:** a perched bird flushes as you approach. By temper it dives at you (Scuffinch's nest defence), flies to another tree, or stays and sings. Birds are caught on the ground, or baited down.
  - **Life stages:** babies can't fly (nestlings stay in the nest, nymphs underground), which also makes young birds the easier catch; elders fly less.
  - **At home:** birds need trees to perch in.
  - **Battle:** everyone stays standing for now; airborne effects in battle (e.g. Air creatures harder to reach with Earth moves) may come later.
- Other behaviours to cover: Possumbra playing dead outside battle, Clattershell digging, predators hunting prey.


## Playtest changes (Nov 18)

- **Statuses were too weak** (short and rarely landing), so every status move was retuned. The move tables above show the first drafts; `src/battle/movelist.js` has the current numbers. The rule:
  - Support moves (no damage): 70–100% chance, 4–6 turns.
  - Damaging moves known for their status (Sour Spit, Taproot, Hot Stone, Splash…): 40–60%, 5–8 turns.
  - Damaging moves with a status as a side effect: 25–35%, 4–6 turns.
  - Basic shared moves (Bite, Pinch, Scratch, Zap, Flint Strike): 10–15%, 3 turns.
  - Knocked down is unchanged (one turn; Ram, Skullcrack, Topple and the like keep their chances). Statuses a creature puts on itself are unchanged.
- **Peck is Air** (only birds learn it).
- **Packing creatures:** at home, a creature's card has "Take in your bag next trip". It takes its pod and a bag spot (shared with packed eggs), comes off the vine, and is in your bag when you go out: to release it somewhere, bring a spare, and so on.
- The info bar at the top while out is gone; the bag button shows the bag count.

## Levels and experience (decided and built November 20)

Compared with Pokémon first (see the chat): Homebase's flat 100 XP per level, with wins paying more as foes got stronger, made levelling *speed up* with level (about 2.6 levels per even fight at level 30).

- **Level stays a counter** that only goes up. Wild creatures still show their level in battle: learning which ones are dangerous is part of the fun.
- **XP curve:** a level costs about (2 + level ÷ 5) wins against an evenly matched foe: 3 at level 5, 4 at 10, 8 at 30, 12 at 50, 16 at 70. One tuning number (`winsPerLevel` in `src/creatures/leveling.js`) speeds it all up or down once we know how much people play.
- **Growth groups by species** multiply that: fast 0.75× (Glimmerwick, Shoalclaw, Scuffinch), medium 1× (Ramtarug, Flintback, Possumbra), slow 1.3× (Kudzoon, Thrummet, Clattershell), very slow 1.6× (Duskhowl).
- **XP for a win comes from the foe's real strength**, not its level: its stat total turned into "the level an average adult would need for these stats" (so species, life stage, genes and condition all count), split evenly among the creatures that fought. (Nov 21: the extra half-to-double scaling by your own strength was dropped; the level curve already makes weak foes pay little to strong creatures and strong foes a lot to young ones, and the scaling made a strong finisher cut everyone's share.)
- **Genes keep their ±25% range.** The XP-rate gene narrows to 0.85–1.15 (was 0.5–1.5). Size counts a quarter on HP (was half). Breeding already passes one copy of each gene from each parent (never an average).
- Older saves keep their levels and how far each creature was into its level.
- **Names are unique** among your creatures. About 1 in 5 babies is named after a parent with a number (Pip II, Pip III…); when all 36 names are taken, numbered ones carry on. Older saves with two of a name get the later ones numbered. Renaming by hand is still free.
- **Hint names:** a creature with a standout gene (top or bottom 5% of its range) has an even chance of a name that hints at it; the most extreme gene wins (about 3 in 10 wild creatures). A Dart is always fast, but not every fast one is a Dart. Lists (high / low): Speed Dart, Flick, Zip, Swift, Zephyr, Skitter, Jett / Dawdle, Plod, Mosey, Tarry, Lolly, Puddle. Size Boulder, Bulk, Moose, Bruno, Hefty, Goliath / Runt, Wee, Button, Pipsqueak, Teeny, Peanut, Smidge. Strength Knuckle, Rocco, Butch, Thump, Bash / Twig, Wisp, Noodle, Feather, Dandy. HP Oak, Hardy, Burl, Tuff, Bjorn / Petal, Dewey, Bubbles, Crumb, Tinsel. Elemental Blaze, Storm, Torrent, Sparky, Flare, Volta / Fizzle, Dudley, Puff, Sputter. Resistance Bastion, Warden, Brick, Tortuga / Patch, Tatters, Nicky. Lifespan Sage, Methuselah, Everett, Grandby / Mayfly, Blink, Comet, Flit. Temper Fury, Scrap, Rowdy, Ruckus, Spike / Mellow, Lulu, Pax, Honey, Dozy. Babies named after a parent skip this; renaming by hand overrides it.
- **Ordinary names:** 156 (plant, earth and creature-like), none of them hint names.

## Species tiers and stats by life stage (decided and built November 20)

- **Each species has its own six stats for each life stage** (`stageStats` in `species.jsx`), replacing the flat baby 70% / adolescent 85% and the separate elder changes. 1.00 = an average adult stat; genes (±25%) and condition still multiply on top. The old `base` now only sets walking speed.
- **Tiers** (multiply the whole species): Glimmerwick 0.8; Shoalclaw, Scuffinch 0.9; Ramtarug, Flintback, Possumbra 1.0; Kudzoon, Thrummet, Clattershell 1.1; Duskhowl 1.3 (1.6× from weakest to apex; Pokémon is about 2×, but our genes vary far more than IVs).
- **Shapes** were stretched 1.5× from the earlier drafts so roles read clearly (Clattershell a wall, Thrummet adults the fastest, Glimmerwick a glass cannon, Duskhowl the apex).
- **Stage totals:** baby 70%, adolescent 85%, elder 95% of the adult total; Thrummet's nymph 85% (it's a nymph for 70% of its life). Each stage leans toward its look (Kudzoon's runner is quick, its woody crown barely moves; Shoalclaw's elder has the huge claw).
- **Something like EVs** (what a creature does shaping its stats): not now. Planned as diet (Behavior stage) and training with a mentor (Mentoring stage): visible, capped around +10%.

| Species | Stage | HP | Atk | Def | Elem | Res | Spd | Total |
|---|---|---|---|---|---|---|---|---|
| Ramtarug | baby | 0.89 | 0.69 | 0.69 | 0.69 | 0.69 | 0.54 | 4.19 |
| Ramtarug | adolescent | 0.91 | 0.85 | 0.85 | 0.85 | 0.85 | 0.79 | 5.10 |
| Ramtarug | adult | 1.08 | 1.00 | 1.00 | 1.00 | 1.00 | 0.92 | 6.00 |
| Ramtarug | elder | 1.04 | 0.82 | 1.06 | 0.96 | 1.06 | 0.76 | 5.70 |
| Kudzoon | baby | 1.06 | 0.59 | 0.75 | 0.81 | 0.93 | 0.48 | 4.62 |
| Kudzoon | adolescent | 1.17 | 0.74 | 0.81 | 1.02 | 1.02 | 0.84 | 5.60 |
| Kudzoon | adult | 1.50 | 0.87 | 1.23 | 1.20 | 1.20 | 0.60 | 6.60 |
| Kudzoon | elder | 1.29 | 0.82 | 1.27 | 1.13 | 1.36 | 0.40 | 6.27 |
| Thrummet | baby | 0.88 | 0.92 | 1.14 | 1.06 | 0.84 | 0.77 | 5.61 |
| Thrummet | adult | 0.85 | 1.01 | 0.75 | 1.35 | 0.93 | 1.70 | 6.59 |
| Thrummet | elder | 0.87 | 1.03 | 0.95 | 1.32 | 0.95 | 1.16 | 6.28 |
| Scuffinch | baby | 0.60 | 0.74 | 0.40 | 0.55 | 0.55 | 0.93 | 3.77 |
| Scuffinch | adolescent | 0.64 | 0.86 | 0.58 | 0.64 | 0.64 | 1.24 | 4.60 |
| Scuffinch | adult | 0.76 | 1.08 | 0.69 | 0.76 | 0.76 | 1.36 | 5.41 |
| Scuffinch | elder | 0.75 | 1.01 | 0.68 | 0.86 | 0.82 | 1.02 | 5.14 |
| Flintback | baby | 0.52 | 0.68 | 0.58 | 0.83 | 0.62 | 0.97 | 4.20 |
| Flintback | adolescent | 0.69 | 0.82 | 0.88 | 1.01 | 0.76 | 0.94 | 5.10 |
| Flintback | adult | 0.80 | 0.94 | 1.02 | 1.28 | 0.87 | 1.09 | 6.00 |
| Flintback | elder | 0.76 | 0.90 | 1.11 | 1.10 | 0.95 | 0.88 | 5.70 |
| Shoalclaw | baby | 0.60 | 0.84 | 0.59 | 0.50 | 0.60 | 0.65 | 3.78 |
| Shoalclaw | adolescent | 0.72 | 1.02 | 0.91 | 0.61 | 0.72 | 0.61 | 4.59 |
| Shoalclaw | adult | 0.83 | 1.17 | 1.17 | 0.70 | 0.83 | 0.70 | 5.40 |
| Shoalclaw | elder | 0.77 | 1.36 | 1.09 | 0.65 | 0.77 | 0.49 | 5.13 |
| Glimmerwick | baby | 0.49 | 0.34 | 0.39 | 0.85 | 0.62 | 0.66 | 3.35 |
| Glimmerwick | adolescent | 0.42 | 0.37 | 0.42 | 1.02 | 0.67 | 1.17 | 4.07 |
| Glimmerwick | adult | 0.52 | 0.45 | 0.52 | 1.25 | 0.82 | 1.25 | 4.81 |
| Glimmerwick | elder | 0.51 | 0.45 | 0.51 | 1.05 | 0.93 | 1.11 | 4.56 |
| Possumbra | baby | 0.72 | 0.57 | 0.62 | 0.72 | 0.99 | 0.57 | 4.19 |
| Possumbra | adolescent | 0.91 | 0.72 | 0.79 | 0.91 | 1.04 | 0.72 | 5.09 |
| Possumbra | adult | 1.08 | 0.85 | 0.92 | 1.08 | 1.22 | 0.85 | 6.00 |
| Possumbra | elder | 1.10 | 0.79 | 0.86 | 1.00 | 1.26 | 0.67 | 5.68 |
| Clattershell | baby | 0.81 | 0.75 | 1.02 | 0.51 | 1.18 | 0.35 | 4.62 |
| Clattershell | adolescent | 0.95 | 0.88 | 1.43 | 0.59 | 1.38 | 0.38 | 5.61 |
| Clattershell | adult | 1.09 | 1.00 | 1.82 | 0.68 | 1.58 | 0.43 | 6.60 |
| Clattershell | elder | 1.03 | 0.86 | 1.90 | 0.64 | 1.49 | 0.35 | 6.27 |
| Duskhowl | baby | 0.98 | 0.93 | 0.85 | 0.79 | 0.79 | 1.12 | 5.46 |
| Duskhowl | adolescent | 1.15 | 1.30 | 1.00 | 0.93 | 0.93 | 1.32 | 6.63 |
| Duskhowl | adult | 1.39 | 1.57 | 1.21 | 1.12 | 1.12 | 1.39 | 7.80 |
| Duskhowl | elder | 1.31 | 1.47 | 1.14 | 1.16 | 1.22 | 1.11 | 7.41 |

## Rarity and catch difficulty (decided and built November 20)

- **Rarity by land type** (`found` in `species.jsx`; tiers 1 common, 0.5 uncommon, 0.25 rare, 0.1 very rare). Kudzoon: kudzu common; forest rare; clay, meadow very rare. Thrummet: forest common; pine rare; kudzu very rare. Scuffinch: meadow common; forest uncommon; kudzu, clay rare. Flintback: granite common; clay rare; pine very rare. Shoalclaw: shoal, creek common; river rare. Glimmerwick: meadow common; creek uncommon; forest rare. Possumbra: forest, kudzu, pine uncommon; meadow, clay, creek rare. Clattershell: pine, clay common; forest very rare. Duskhowl: meadow, forest, pine, clay, kudzu very rare. (The older `biomes` likings still set habitat and pod fit.)
- **Overall rarity** (stronger species are scarcer): Glimmerwick, Scuffinch, Shoalclaw, Possumbra ×1; Kudzoon, Thrummet, Flintback, Clattershell ×0.7; Duskhowl ×0.3, and never in areas below level 15. Measured: Duskhowl is about 1 in 140 wild creatures in level 15+ areas.
- **Elders are scarcer in the wild:** they count at 40% near home, rising to full in areas of level 40+. About 4% of wild creatures are elders in low areas, 7% in level-45 areas. The young-only zone by the door stays.
- **Catch difficulty** multiplies the catch chance: easy ×1.25 (Glimmerwick, Scuffinch, Shoalclaw), normal ×1 (Possumbra, Flintback, Kudzoon, Ramtarug), hard ×0.75 (Thrummet, Clattershell), very hard ×0.45 (Duskhowl). Babies ×1.2, elders ×0.8. Status effects on catching and the pod scene stay for stage 11.
- This finishes the Stats pass.
