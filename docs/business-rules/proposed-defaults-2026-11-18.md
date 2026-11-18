# Proposed defaults — DR-13, DR-11, DR-03, DR-14, DR-02

**Status: PROPOSED — NOT APPROVED.** Nothing in this document is implemented. It exists so the owner can approve, amend or reject concrete values instead of abstract options. Until sign-off, the system keeps today's behaviour: liability is confirmed manually by any `transport.manage` user, no tolerance values are seeded, and trips have no closure rule.

- Prepared: 2026-11-18
- Covers: DR-13 remainder (approval thresholds), DR-11, DR-03 values, DR-14 trip closure, DR-02 method
- Companion papers: `decision-paper-dr-13-transporter-liability.md`, `decision-paper-dr-01-03-measurement-tolerances.md`
- Decision register: `decision-register.md` §4

---

## 1. What already works, and what is missing

| Area | Implemented today | Missing |
|---|---|---|
| Liability | Manual confirmation at landed cost, optional partial recovery by invoice deduction or debit note, audited | Value thresholds; nothing stops a junior user confirming a ₦5m liability |
| Transporter charges | Optional fixed categories (haulage, loading, waiting, demurrage, other) | Nothing |
| Tolerance | Optional `tolerance_rules` per product or organisation-wide; `percentage`, `absolute`, `greater_of`; two-band result (`within_tolerance` / `flagged`) computed on insert | Values; per-boundary rules; three-band classification |
| Trip closure | Trips carry a status; no close action | Closure rule, guard and override |
| Temperature correction | Optional recording of temperature, density, method, factor and corrected quantity | A named approved method |

The `tolerance_rules` table is unique on `(organisation_id, product_id)` and the trigger computes tolerance from `loaded_quantity` only. Per-boundary values therefore need a schema change, which is called out in §3.

---

## 2. DR-13 and DR-11 — liability authority and recovery

### 2.1 Proposed approval thresholds

| Confirmed liability | Who may confirm | Rationale |
|---|---|---|
| Up to **₦500,000** | `transport.manage` | A supervisor can settle routine shortages without escalating every 50 L. |
| Above **₦500,000** | `organisation.manage` | Material money; the same permission that already governs organisation settings and the demo reset. |
| Any value, **write-off** (no recovery) | `organisation.manage` plus a typed reason | Accepting a loss is a policy decision, not an operational one. |

- Threshold is checked against the **confirmed liability amount**, not the invoice total.
- A user without the required permission sees the confirm form disabled with the reason, and the server rejects the action if attempted directly.
- Denials are audited with the amount and the permission that was missing.
- Values are configuration, not code: one row per threshold in a new `approval_thresholds` table (or equivalent `business_settings` keys), seeded with the values above but editable later.
- No threshold applies to **recovery**, because recovery can never exceed the confirmed liability.

### 2.2 Proposed recovery defaults

| Question | Proposal |
|---|---|
| Default recovery method | Deduction against the transporter invoice when one exists; debit note otherwise. |
| Partial recovery | Allowed, as today, up to the outstanding balance. |
| Invoice already paid | Do not mutate the payment; record a debit note. |
| Employee deduction | Never. |
| Automatic recovery | Never; each recovery is an explicit action. |

### 2.3 Remaining DR-13 answers carried forward

These are already implemented, and this draft proposes no change:

- D13-1 human confirmation only
- D13-2 landed cost, manual unit cost only when the trip has no posted issue
- D13-3 transporter liability only
- D13-4 deduction or debit note, invoice total untouched
- D13-5 optional fixed charge categories
- D13-7 recognition when the investigation is completed

---

## 3. DR-03 — proposed tolerance values

### 3.1 Basis

Proposed: **`greater_of`** for every rule — the greater of a percentage of loaded quantity and an absolute floor. This protects small loads from an unreasonable percentage and large loads from an unreasonable floor.

Classification stays **two-band** for this release: `within_tolerance` or `flagged`. A third "confirmed loss" band overlaps DR-13 and is deferred; the existing `investigated` / `resolved` statuses already cover the human workflow.

### 3.2 Values

| Product | Percentage | Absolute floor | Example at 10,000 L | Example at 33,000 L | Example at 45,000 L |
|---|---|---|---|---|---|
| PMS (petrol) | 0.25 % | 50 L | 50 L (floor) | 82.5 L | 112.5 L |
| AGO (diesel) | 0.20 % | 50 L | 50 L (floor) | 66 L | 90 L |
| DPK (kerosene) | 0.25 % | 40 L | 40 L (floor) | 82.5 L | 112.5 L |
| Organisation-wide fallback (any other product) | 0.25 % | 50 L | 50 L (floor) | 82.5 L | 112.5 L |

Reasoning: 0.20–0.25 % sits inside the usual 0.1–0.5 % industry band, and the floors cover meter and dip noise on small loads. These are commercial starting points, not measurements of your operations.

### 3.3 Per-boundary values — deferred

The current table cannot store different values for supplier→loaded and loaded→delivered. Two options:

- **v1 (proposed):** one rule per product, applied to both boundaries, no migration.
- **v1.1 (optional):** add a `measurement_boundary` column (`supplier_loading`, `loading_delivery`, `any`) with uniqueness per product and boundary. This would let delivery tolerances be tighter than loading tolerances.

If you want the split now, say so before seeding; otherwise the single-rule model is what this draft assumes.

### 3.4 Effective date

Rules apply to reconciliation items created after the rule is saved. Historic items are not reclassified and no recorded quantity is restated.

---

## 4. DR-14 — proposed trip closure

### 4.1 Proposed rule

| Condition | Behaviour |
|---|---|
| Trip has no reconciliation item, or every item is `within_tolerance` / `investigated` / `resolved` | Trip may be closed by `transport.manage` |
| Any item is `flagged` or `open` | Closing is blocked; the reason is shown with a link to the reconciliation |
| Closing anyway | Allowed only with `transport.manage` **and** a typed override reason, recorded in the audit log |
| Automatic closure | None |
| Aging | A report lists trips older than **7 days** with unresolved items; they are never auto-closed |

### 4.2 Why not auto-close

Auto-closure would either hide an open discrepancy or close a trip whose evidence is still arriving. A visible aging report puts the decision in front of a person without stopping the truck from working.

### 4.3 Implementation cost

A close action, a guard in the database and a status transition: one small migration plus one server action and a button on dispatch. The aging report is a filtered view, no new table.

---

## 5. DR-02 — proposed correction method

### 5.1 Proposal

| Question | Proposal |
|---|---|
| Is correction applied automatically? | No. Recording temperature, density at 15 °C, a method and a factor stays optional. |
| Approved method when a factor is used | **Supplier-provided conversion factor**, recorded per delivery with the method named in the record. |
| Where density comes from | Recorded per batch where known; per delivery override allowed. |
| Corrected quantity | Stored and displayed beside the observed quantity; it never replaces the delivered figure. |
| Historic quantities | Never restated. |
| ASTM/API tables | Deferred to a new decision; it needs a vetted implementation and a coefficient source. |

This is deliberately the smallest step: it makes the existing fields meaningful without introducing a calculation the business has not validated.

---

## 6. Implementation plan if approved

| Step | Change | Migration | Effort |
|---|---|---|---|
| 1. Approval thresholds | `approval_thresholds` table, seeded with the two tiers; permission check inside the liability RPC; disabled-state copy in the UI; audit on denial | 1 | Medium |
| 2. Tolerance values | Seed three product rules plus fallback through the settings UI or the demo seed; no schema change | 0 | Small |
| 3. Trip closure | Close action, guard and override reason; aging list on dispatch | 1 | Small–medium |
| 4. Correction method | Default the method field to "Supplier factor" when a factor is entered; no calculation change | 0 | Small |
| 5. Tests | DB checks for each tier and closure guard; unit tests for threshold selection; live check script | — | Medium |

Recommended order: 2, then 1, then 3, then 4 — the tolerance values are configuration only and deliver reporting value immediately, while thresholds and closure change behaviour.

---

## 7. What is explicitly not proposed

- No change to liability valuation, recovery caps or the append-only rules.
- No employee deduction, payroll integration or insurer workflow.
- No statutory accounting, journal postings or tax treatment.
- No retroactive restatement of quantities, reconciliations or liabilities.
- No automatic liability, automatic recovery or automatic trip closure.
- No per-compartment tolerance.

---

## 8. Owner sign-off

Tick or amend each line. Any line left blank keeps today's behaviour.

| Item | Proposed | Your answer |
|---|---|---|
| Tier 1 threshold | ₦500,000, `transport.manage` | |
| Tier 2 threshold | Above ₦500,000, `organisation.manage` | |
| Write-off authority | `organisation.manage` + reason | |
| Recovery default | Invoice deduction, else debit note | |
| PMS tolerance | 0.25 % / 50 L greater-of | |
| AGO tolerance | 0.20 % / 50 L greater-of | |
| DPK tolerance | 0.25 % / 40 L greater-of | |
| Fallback tolerance | 0.25 % / 50 L greater-of | |
| Per-boundary tolerances | Deferred; single rule per product | |
| Trip closure | Block on `flagged`/`open`; override with reason | |
| Unresolved aging report | 7 days | |
| Correction method | Optional; supplier factor; no automatic calculation | |
| Effective date | New items only; no restatement | |

Once signed off, the answers move into `decision-register.md` as approved records and the plan in §6 is implemented in order.
