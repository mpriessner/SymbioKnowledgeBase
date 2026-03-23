---
title: "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine with Phenylboronic Acid"
icon: "🧪"
tags:
  - eln:EXP-2026-0042
  - reaction:suzuki-coupling
  - researcher:mueller
  - substrate-class:heteroaryl-halides
  - scale:medium
  - challenge:protodeboronation
  - quality:4
eln_id: "EXP-2026-0042"
researcher: "Dr. Anna Mueller"
date: "2026-03-15"
status: "completed"
reaction_type: "Suzuki Coupling"
substrate_class: "Heteroaryl Halides"
scale_category: "medium"
quality_score: 4
---

# EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine with Phenylboronic Acid

> One-liner summary: Successful Suzuki coupling of 4-bromopyridine with phenylboronic acid achieving 82% yield using Pd(PPh3)4 catalyst under optimized aqueous conditions.

## Metadata

| Field | Value |
|-------|-------|
| **Researcher** | [[Dr. Anna Mueller]] |
| **Date** | 2026-03-15 |
| **Reaction Type** | [[Suzuki Coupling]] |
| **Substrate Class** | [[Heteroaryl Halides]] |
| **Scale** | 5.0 mmol |
| **Status** | Completed |
| **Quality Score** | 4/5 |

## Reaction Conditions

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Temperature** | 80 °C | Reflux, oil bath |
| **Solvent** | [[Tetrahydrofuran]] / Water (3:1) | 20 mL total |
| **Atmosphere** | Nitrogen | Schlenk line, three vacuum-N2 cycles |
| **Duration** | 4 hours | Monitored by TLC until completion |
| **Catalyst** | [[Pd(PPh3)4]] | 3 mol% loading |
| **Base** | [[Potassium Carbonate]] | 2.0 equiv, aqueous solution |

## Reagents

| Reagent | Amount | Equivalents | CAS | Notes |
|---------|--------|-------------|-----|-------|
| [[4-Bromopyridine]] | 790 mg | 1.0 eq | 1120-87-2 | Stored at -20 °C |
| [[Phenylboronic Acid]] | 731 mg | 1.2 eq | 98-80-6 | Fresh batch, white powder |
| [[Pd(PPh3)4]] | 173 mg | 3 mol% | 14221-01-3 | Stored under argon |
| [[Potassium Carbonate]] | 1.38 g | 2.0 eq | 584-08-7 | Dissolved in 5 mL water |
| [[Tetrahydrofuran]] | 15 mL | - | 109-99-9 | Anhydrous, freshly distilled |

## Procedure

### Setup
1. Flame-dried 100 mL round-bottom flask equipped with magnetic stir bar
2. Applied three vacuum-nitrogen cycles via Schlenk line
3. Added [[4-Bromopyridine]] (790 mg, 5.0 mmol, 1.0 equiv)
4. Dissolved in anhydrous [[Tetrahydrofuran]] (15 mL)

### Reaction
1. Added [[Pd(PPh3)4]] (173 mg, 0.15 mmol, 3 mol%) under nitrogen counterflow
2. Added [[Phenylboronic Acid]] (731 mg, 6.0 mmol, 1.2 equiv)
3. Added degassed aqueous [[Potassium Carbonate]] solution (1.38 g in 5 mL water)
4. Heated to 80 °C with stirring (500 rpm)
5. Monitored by TLC (EtOAc/hexanes 1:3, UV visualization)
6. Reaction complete after 4 hours (no starting material remaining)

### Workup
1. Cooled to room temperature over 30 minutes
2. Diluted with ethyl acetate (30 mL)
3. Washed with water (2 x 20 mL) and brine (1 x 20 mL)
4. Dried over anhydrous Na2SO4
5. Filtered and concentrated under reduced pressure (rotary evaporator, 40 °C, 200 mbar)

### Purification
1. Purified by column chromatography (silica gel, EtOAc/hexanes 1:4 to 1:2 gradient)
2. Product fractions identified by TLC (Rf = 0.35 in EtOAc/hexanes 1:3)
3. Concentrated to give product as a white solid

## Results

| Metric | Value |
|--------|-------|
| **Yield** | 82% (636 mg) |
| **Purity** | >97% (NMR) |
| **Characterization** | 1H NMR, 13C NMR, HRMS |

### Product Characterization

**Appearance:** White crystalline solid, mp 68-70 °C

**1H NMR (400 MHz, CDCl3):** d 8.65 (dd, J = 4.5, 1.6 Hz, 2H), 7.62 (dd, J = 7.8, 1.3 Hz, 2H), 7.50-7.40 (m, 5H)

**13C NMR (100 MHz, CDCl3):** d 150.2, 148.5, 137.8, 129.1, 128.9, 127.0, 121.5

**HRMS (ESI):** m/z calculated for C11H10N [M+H]+: 156.0808, found: 156.0810

## Practical Notes

### What Worked Well
- Using freshly distilled THF was critical for reproducibility
- Degassing the aqueous K2CO3 solution prevented foaming and improved yield by approximately 10%
- 3 mol% catalyst loading was optimal; lower loadings (1 mol%) gave incomplete conversion

### Challenges Encountered
- **[[Protodeboronation]]**: Initial attempts with higher temperature (100 °C) led to significant protodeboronation of the boronic acid, reducing yield to 55%
- Moisture sensitivity required careful Schlenk technique throughout

### Recommendations for Next Time
- Consider using [[Phenylboronic Acid Pinacol Ester]] for better stability if boronic acid quality is inconsistent
- Scale-up to 20 mmol should use mechanical stirring instead of magnetic
- Pre-activate catalyst by stirring in THF for 10 min before adding substrates

### Substrate-Specific Insights
- 4-Bromopyridine is more reactive than 2-bromopyridine due to reduced steric hindrance
- The nitrogen in the pyridine ring can coordinate to palladium; excess ligand helps prevent catalyst poisoning

## Related Experiments

- [[EXP-2026-0038]]: Same substrate with Pd(dppf)Cl2 catalyst, lower yield (68%)
- [[EXP-2026-0045]]: Scale-up to 20 mmol using these optimized conditions
- [[EXP-2026-0029]]: Suzuki coupling of 2-bromopyridine for comparison

## Related Pages

- Reaction Type: [[Suzuki Coupling]]
- Substrate Class: [[Heteroaryl Halides]]
- Key Chemicals: [[4-Bromopyridine]], [[Phenylboronic Acid]], [[Pd(PPh3)4]]
- Researcher: [[Dr. Anna Mueller]]
