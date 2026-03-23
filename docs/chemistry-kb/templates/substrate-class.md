---
title: "Heteroaryl Halides"
icon: "🧬"
tags:
  - substrate-class
experiment_count: 31
---

# Heteroaryl Halides

> One-liner: Aromatic heterocyclic compounds bearing halide leaving groups; our most commonly used substrate class with 31 experiments, requiring careful optimization due to nitrogen coordination effects.

## Common Challenges

- **Nitrogen Coordination to Catalyst**: The lone pair on ring nitrogen atoms (pyridine, pyrimidine) can coordinate to palladium, deactivating the catalyst. Mitigate by using excess phosphine ligand or higher catalyst loading (3-5 mol%)
- **Regioselectivity**: Polyhalogenated heterocycles react preferentially at C-Br over C-Cl, and at positions distant from nitrogen. Plan reaction sequence accordingly
- **Solubility**: Many heteroaryl halides have limited solubility in organic solvents. THF/water mixtures or DMF often provide the best results
- **Stability**: Some heteroaryl halides (especially 2-halopyridines) are moisture-sensitive. Store under nitrogen at -20 °C

## What Worked

### Successful Strategies
- Using Pd(PPh3)4 at 3-5 mol% with K2CO3 base in THF/H2O consistently gives good results for pyridyl bromides
- Pre-stirring catalyst in solvent for 10 minutes before adding substrate improves conversion
- Slow addition of boronic acid coupling partner reduces homocoupling side reactions
- Microwave conditions (100 °C, 30 min) are effective for unreactive substrates

### Reaction-Specific Advice
- **[[Suzuki Coupling]]**: Standard conditions work well for 3- and 4-halopyridines. 2-Halopyridines need higher catalyst loading (5 mol%) and longer reaction times
- **[[Heck Reaction]]**: Use triethylamine as base instead of K2CO3 for better selectivity with heteroaryl iodides
- **[[Buchwald-Hartwig Amination]]**: XPhos or BrettPhos ligands are preferred over PPh3 for amination of heteroaryl chlorides

## Who Has Experience

- **[[Dr. Anna Mueller]]**: Expert on pyridine and pyrimidine substrates, developed optimized Suzuki coupling protocol
- **[[Dr. James Chen]]**: Scaled up heteroaryl coupling reactions to pilot scale (>100 mmol)
- **[[Dr. Sarah Kim]]**: Experience with sterically hindered heteroaryl substrates and bulky ligand systems

## Representative Experiments

- [[EXP-2026-0042]]: 4-Bromopyridine Suzuki coupling, 82% yield (standard protocol)
- [[EXP-2026-0036]]: 2-Chloropyrimidine Buchwald-Hartwig amination, 88% yield
- [[EXP-2026-0022]]: 3-Bromothiophene Suzuki coupling, 90% yield
- [[EXP-2026-0015]]: 2,6-Dibromopyridine selective mono-coupling, 61% yield

## Related Pages

- Related Substrate Classes: [[Electron-Deficient Arenes]], [[Alkyl Boronic Acids]]
- Common Reactions: [[Suzuki Coupling]], [[Heck Reaction]], [[Buchwald-Hartwig Amination]]
