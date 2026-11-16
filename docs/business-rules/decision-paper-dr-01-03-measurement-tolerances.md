# Decision paper — DR-01, DR-02 and DR-03 Measurement and tolerances

**Status:** Awaiting owner decision. Nothing in this paper is approved.
**Owner:** Product owner (Tunde Oladeji).
**Prepared:** 16 November 2026.
**Related:** decision register DR-01 (measurement basis), DR-02 (temperature/density correction), DR-03 (tolerance thresholds), DR-14 (reconciliation tolerances), DR-17 (quantity model); migrations `20261115001100`–`20261115001300`.

## 1. Why this decision is needed

Three connected questions decide whether a number in the system is "a measurement", "a tolerated difference" or "a loss":

1. **Where and how** is a quantity measured, and to what precision? (DR-01)
2. **Is the volume corrected** for temperature and density before it is recorded, and by which method? (DR-02)
3. **How large** may a difference be before it becomes a discrepancy that needs investigation? (DR-03)

Today the system records what the operator supplies and never classifies it:

- `numeric(18,3)` columns hold litres to three decimals.
- `trip_reconciliation_items.variance_quantity` is generated as loaded minus delivered.
- `tolerance_quantity` exists but is never populated, so no variance is within or outside tolerance.
- `reconciliation_status` is stored but chosen by the user, not computed.
- No product has a tolerance rule, and no temperature or density correction is applied.

## 2. What already exists

| Capability | Behaviour today |
|---|---|
| Loading quantities | Per compartment; capacity and product-match checks |
| Delivery quantities | Customer-confirmed quantity optional; cumulative checks against the order line |
| Procurement quantities | Supplier, loaded and received quantities with generated total variance |
| Reconciliation | Loaded, delivered and generated variance per product |
| Cost | Landed cost per unit, preserved per batch through FIFO |

## 3. DR-01 — Measurement basis and precision

### D01-1 Where is the authoritative quantity measured?

| Option | Consequences |
|---|---|
| **(a) Supplier depot dip only** | Trusts the supplier; disputes are hard to resolve. |
| **(b) Supplier dip, loading meter and delivery dip** (three points) | Full traceability of where a loss occurred; requires disciplined data entry at three moments. |
| **(c) Loading meter and delivery dip** | Simpler, but cannot separate supplier shortage from transit loss. |
| **(d) Customer tank reading is authoritative at delivery** | Matches how customers argue; conflicts with the physical loaded quantity. |

Note: the system currently records supplier, loaded and received quantities for procurement, and loaded and delivered quantities per trip. Option (b) is therefore the closest fit to the existing model.

### D01-2 Quantity precision

| Option | Consequences |
|---|---|
| **(a) Three decimals (today)** | Maximum detail; encourages false precision on dip readings. |
| **(b) Two decimals** | Cleaner reporting; requires a rounding rule at every entry point. |
| **(c) Whole litres** | Simple and credible for road tankers; loses meter detail. |
| **(d) Precision per measurement point** (dips to whole litres, meters to one decimal) | Most realistic, more rules to document. |

### D01-3 Is the recorded quantity interpreted as volume at the observed temperature or at 15 °C?

This is the hinge between DR-01 and DR-02: a quantity is ambiguous unless its reference temperature is known.

## 4. DR-02 — Temperature and density correction

### D02-1 Is correction required?

| Option | Consequences |
|---|---|
| **(a) Not applied** (today) | Simple; volumes vary with temperature, so two trips can disagree without anyone being at fault. |
| **(b) Applied at loading and delivery** | Consistent, comparable volumes; needs density and temperature at both points and a calculation method. |
| **(c) Applied only when a dispute is raised** | Less data entry; introduces two kinds of numbers in one ledger. |
| **(d) Applied only to supplier and customer documents** | Matches commercial documents; internal transfers stay observed. |

### D02-2 Approved correction method

| Option | Consequences |
|---|---|
| **(a) ASTM/API petroleum measurement tables** | Industry standard, auditable, needs a vetted implementation or a trusted library. |
| **(b) Supplier-provided conversion factor** | Simple, but shifts authority to the supplier. |
| **(c) Customer-agreed factor** | Good for contracts, inconsistent across customers. |
| **(d) Density at 15 °C plus coefficient per product** | Transparent, needs a coefficient table per product. |

### D02-3 If correction is adopted

- Which temperature source is trusted (tank gauge, thermometer, supplier ticket)?
- Is density recorded per batch, per compartment or per delivery?
- Are historic quantities restated, or only new ones corrected? (Recommendation: only new records; restating posted history breaks append-only evidence.)

## 5. DR-03 — Tolerance thresholds

### D03-1 Tolerance basis

| Option | Consequences |
|---|---|
| **(a) Absolute litres per trip** (e.g. 50 L) | Easy to explain; unfair on small loads. |
| **(b) Percentage of loaded quantity** (e.g. 0.25 %) | Scales with load; a small load tolerates almost nothing. |
| **(c) The greater of an absolute floor and a percentage** | Practical; slightly more complex to explain and test. |
| **(d) Per compartment** | Most precise; generates many small variances. |
| **(e) Per product and per measurement point** | Most realistic, most configuration. |

### D03-2 Threshold values

The owner must supply numbers. A typical industry range is 0.1 % to 0.5 % of loaded volume, but this is a commercial decision, not a technical one. Values may differ by product (PMS, AGO, DPK) and by whether the comparison is supplier-to-loading or loading-to-delivery.

### D03-3 Classification and authority

| Option | Consequences |
|---|---|
| **(a) Two bands:** within tolerance / investigate | Simple; every outside-tolerance case gets human attention. |
| **(b) Three bands:** within tolerance / investigate / confirmed loss | Matches the existing `reconciliation_status` values (`within_tolerance`, `flagged`, `investigated`, `resolved`). |
| **(c) Four bands with an escalation threshold** | Adds approval routing (DR-11); more rules to test. |

### D03-4 Trip closure

| Option | Consequences |
|---|---|
| **(a) A trip cannot close while any item is unresolved** | Strong control; can block operations. |
| **(b) A trip closes with an open variance and a follow-up task** | Operationally realistic; needs a task concept that does not exist yet. |
| **(c) A trip auto-closes after N days** | Prevents stale records; needs a background job and a stated N. |

### D03-5 Effect on money

Tolerance itself moves no money. It only decides whether a variance becomes a discrepancy. Any financial consequence still depends on DR-13.

## 6. Data-model impact

| Decision | Change |
|---|---|
| D01-1 | Optionally `measurement_events` (DR-17) if every reading must be kept; otherwise current columns remain |
| D01-2 | Column precision change or entry-level rounding; no structural change |
| D01-3, D02 | `reference_temperature`, `observed_temperature`, `density_15c`, `corrected_volume`, `correction_method` on loading and delivery records |
| D03-1/2 | Tolerance rules per organisation, product and measurement point (new table) |
| D03-3 | `tolerance_quantity` and `reconciliation_status` become computed, not typed |
| D03-4 | Trip closure guard or a follow-up record |

All changes are additive. No posted quantity needs rewriting if the rule applies only to new records.

## 7. Sub-questions that need a one-line answer each

1. Is a litre on a supplier ticket the same litre as on our meter? If not, which one is authoritative?
2. Do customers accept our delivery figure, or do they measure independently?
3. Are dips taken before and after loading, or only after?
4. Should the system hold density per batch, and who enters it?
5. Are tolerances contractual with suppliers or customers? If yes, must they be recorded per contract?
6. What should a dispatcher do when a variance is outside tolerance but the truck must leave?

## 8. Recommendation (not a decision)

For a first release, the smallest useful rule set is:

- **D01-1 (b)** three measurement points, because the schema already captures them;
- **D01-2 (a)** keep three decimals internally and round for display;
- **D01-3** record volume at the observed temperature **and** the reference temperature used, so the answer to DR-02 can be applied later without ambiguity;
- **D02-1 (a)** no correction in the first release, with the fields present and populated where known;
- **D03-1 (c)** the greater of an absolute floor and a percentage;
- **D03-3 (b)** three bands, reusing the existing status values;
- **D03-4 (a)** no closure with unresolved items, with an explicit override permission.

This keeps every recorded number honest, applies tolerance consistently, and leaves temperature correction as a later, additive change.

## 9. Implementation plan once approved

| Step | Migration | Effort |
|---|---|---|
| Tolerance rules table and seed | 1 migration | Small |
| Compute `tolerance_quantity` and status on reconciliation items | 1 migration + trigger | Medium |
| Temperature and density fields (if adopted) | 1 migration + forms | Medium |
| Correction calculation (if adopted) | 1 migration + function + tests | Large |
| Trip closure guard | 1 migration + action | Small |
| Reporting: variance by product, tolerance breach rate | View or page section | Small |
| Tests | DB checks + live script | Medium |

## 10. Owner decision record

| Field | Answer |
|---|---|
| D01-1 authoritative measurement points | |
| D01-2 precision | |
| D01-3 reference temperature | |
| D02-1 correction applied? | |
| D02-2 method | |
| D03-1 tolerance basis | |
| D03-2 values (per product, per measurement point) | |
| D03-3 bands and approver | |
| D03-4 closure rule | |
| Answers to the six sub-questions | |
| Approved by | |
| Approved on | |
| Conditions | |

Once this table is completed, the decision is copied into the decision register as **Approved** and implemented against the plan above.
