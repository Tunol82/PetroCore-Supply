# Decision paper — DR-13 Transporter liability and charges

**Status:** Awaiting owner decision. Nothing in this paper is approved.
**Owner:** Product owner (Tunde Oladeji).
**Prepared:** 16 November 2026.
**Related:** decision register DR-11 (approval thresholds), DR-14 (reconciliation tolerances); migrations `20261115001300`, `20261115002300`, `20261115002400`; pages `/workspace/reconciliation`, `/workspace/transport-invoices`.

## 1. Why this decision is needed

The system can already record a shortage, a discrepancy, an investigation and a transporter invoice. What it cannot do is answer the commercial question:

> When a truck delivers less than it loaded, **who owes what, on what basis, and what may be deducted?**

That is DR-13. Until it is answered, the system deliberately records evidence and stops:

- `delivery_discrepancies.provisional_financial_impact` is stored as evidence only.
- `discrepancy_investigations.responsibility_status` can be `undetermined`, `confirmed` or `cleared`, but confirmation changes nothing financially.
- `transporter_invoices.liability_status` is fixed at `not_assessed`.
- No payable, deduction, debit note or driver debt exists anywhere.

## 2. What already exists

| Capability | Where | Behaviour today |
|---|---|---|
| Loaded vs delivered quantity | `trip_reconciliation_items` | Variance generated, `tolerance_quantity` column exists but is not applied |
| Discrepancy types | `delivery_discrepancies` | supplier, loading, transport, customer measurement, other |
| Investigation | `discrepancy_investigations` | Append-only findings, party type, responsibility status |
| Transporter invoices | `transporter_invoices` / `_lines` | Recorded as supplied, totals generated, liability `not_assessed` |
| Payments | `payments` | Records money out to a transporter, optional invoice link, no allocation logic |
| Cost of sales | `fifo_allocations` | Landed cost per unit preserved, net of reversals |

## 3. The questions

### D13-1 — When does a variance become a liability?

| Option | Meaning | Consequences |
|---|---|---|
| **(a) Human confirmation only** | A user with authority marks responsibility `confirmed` and enters an amount. Nothing is automatic. | Safest, auditable, scales badly if volumes grow. Every liability has a named approver. |
| **(b) Automatic beyond tolerance** | Once DR-03 tolerance is exceeded and the transporter is named responsible, a liability is computed at approval time. | Consistent, but the computation basis still needs D13-2 and D13-3, and errors become financial records. |
| **(c) Automatic at any shortfall** | Any shortage above the recording precision is a liability. | Simple, but creates disputes over measurement noise and would require robust tolerances first. |

### D13-2 — What is the liability valued at?

| Option | Basis | Consequences |
|---|---|---|
| **(a) Landed cost** | The FIFO cost of the missing litres. | Matches inventory truth; does not compensate for lost margin. |
| **(b) Selling price** | The price the customer would have paid. | Compensates margin; needs an agreed price source and can over-recover. |
| **(c) Supplier invoice price** | The purchase price of the batch. | Simple for direct-load trips; ignores landed costs. |
| **(d) Contract rate** | A rate per litre or per trip agreed with each transporter. | Predictable and easy to defend; needs a contract-rate table and per-transporter data. |

### D13-3 — Who bears the loss?

| Option | Consequences |
|---|---|
| **(a) Transporter alone** | Simple. Ignores driver conduct and insurance. |
| **(b) Transporter and driver split** | Needs an employee-deduction policy and employment-law review; the system currently has no employee debt entity. |
| **(c) Insurer first, transporter excess** | Needs insurer and policy data; slower settlement. |
| **(d) Percentage split by responsibility** | Most realistic, most complex: needs a split field and two approval paths. |

### D13-4 — How is the money recovered?

| Option | Mechanism | Consequences |
|---|---|---|
| **(a) Deduct from the transporter invoice** | The invoice is matched, then reduced by an approved deduction. | Natural fit for existing invoices; needs invoice matching and a deduction line that does not distort the invoice's own total. |
| **(b) Debit note to the transporter** | A separate debit note creates a receivable. | Clean paper trail; adds a new document type and a receivable ledger. |
| **(c) Hold payment pending investigation** | Invoice remains unpaid until the investigation closes. | Operationally simple, commercially confrontational; needs a hold flag and ageing. |
| **(d) Write off with approval** | No recovery; approved loss. | Required for genuine losses; needs an approval threshold (DR-11). |

### D13-5 — What may a transporter invoice contain?

| Option | Consequences |
|---|---|
| **(a) Free description lines only** (today) | Maximum flexibility, minimum control; totals are whatever is supplied. |
| **(b) Fixed charge categories** (haulage, loading, waiting, demurrage, other) | Reporting and comparison become possible; needs a category list. |
| **(c) Category plus contracted rate per trip** | Best control; needs contract rates per transporter and route. |

### D13-6 — Who may confirm a liability, and up to what value?

Relates to DR-11. Needs a monetary threshold (or several) and the permission each threshold requires. Today the only stock permission is `inventory.manage` and the only transport permission is `transport.manage`.

### D13-7 — When is the liability recognised?

| Option | Consequences |
|---|---|
| **(a) On investigation completion** | Evidence-driven; invoices may already be paid. |
| **(b) When the transporter invoice is recorded** | Aligns recovery with payment; can precede the investigation. |
| **(c) On trip closure** | Forces reconciliation before closure; may delay operations. |

## 4. Data-model impact

| Decision | New or changed fields |
|---|---|
| D13-1 | `delivery_discrepancies.liability_status`, `confirmed_by`, `confirmed_at` |
| D13-2 | `liability_basis` (`landed_cost` / `selling_price` / `supplier_price` / `contract_rate`), `liability_unit_amount`, `liability_amount` |
| D13-3 | `responsible_party_type` already exists; a split needs `liability_share_percent` per party |
| D13-4 | Either `transporter_invoice_deductions` (invoice, discrepancy, amount, approved_by) or `transporter_debit_notes` |
| D13-5 | `transporter_invoice_lines.charge_category` and an optional contract-rate table |
| D13-6 | Threshold configuration, either in `business_settings` or a dedicated `approval_thresholds` table |
| D13-7 | Recognition date field and a rule in the posting function |

None of this requires rewriting posted history: liabilities would be new rows attached to existing discrepancies and invoices.

## 5. Sub-questions that need a one-line answer each

1. Is a shortage measured against **loaded** quantity or **supplier** quantity?
2. If the customer's tank reading is the disputed figure, whose measurement wins?
3. Are transporter deductions allowed when the invoice is already paid?
4. Is any deduction ever taken from an employee's pay? (If yes, employment-law review is required before implementation.)
5. Is there an insurance arrangement that must be recorded before liability?
6. Should a confirmed liability reduce the transporter's payment automatically, or only on a separate action?

## 6. Recommendation (not a decision)

For a first release, the lowest-risk combination that still delivers value is:

- **D13-1 (a)** human confirmation, with an audited approver and reason;
- **D13-2 (a)** landed cost, because the FIFO layers already hold it;
- **D13-3 (a)** transporter liability only, no employee deductions;
- **D13-4 (a)** deduction from the transporter invoice, with the invoice total left intact and deductions shown separately;
- **D13-5 (b)** fixed charge categories;
- **D13-6** one threshold, owner approval, later split by value;
- **D13-7 (a)** recognition at investigation completion.

This combination needs no new financial theory and fits the existing evidence model.

## 7. Implementation plan once approved

| Step | Migration | Effort |
|---|---|---|
| Liability fields and confirmation function | 1 migration + RPC | Small |
| Deduction lines against invoices | 1 migration + page section | Medium |
| Charge categories on invoice lines | 1 migration + form field | Small |
| Approval thresholds | 1 migration + settings UI | Medium |
| Reporting: liabilities by transporter, recovery rate | Page section or view | Small |
| Tests | DB checks + live check script | Medium |

## 8. Owner decision record

| Field | Answer |
|---|---|
| D13-1 chosen option | |
| D13-2 chosen option | |
| D13-3 chosen option | |
| D13-4 chosen option | |
| D13-5 chosen option | |
| D13-6 threshold and approver | |
| D13-7 chosen option | |
| Answers to the six sub-questions | |
| Approved by | |
| Approved on | |
| Conditions | |

Once this table is completed, the decision is copied into the decision register as **Approved** and implemented against the plan above.
