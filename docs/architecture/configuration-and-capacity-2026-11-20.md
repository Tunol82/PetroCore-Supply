# Configuration vs operations, and truck capacity

| Field | Detail |
|---|---|
| Date | 2026-11-20 |
| Trigger | Owner suggestion: truck capacity should equal the sum of compartments; one-time configuration should live in Settings/admin, editable and deletable, like stations in PetroCore.app |
| Status | **Superseded by `docs/architecture/setup-super-admin-and-dip-charts-2026-11-20.md`** |
| Current evidence | `DB-TRK-1` stores capacity 45,000 L, compartments total 61,200 L; `DB-TRK-2` stores 33,000 L with no compartments |

## 1. Opinion in one page

The direction is right, with two qualifications.

1. **Truck capacity should be derived, not entered.** It is currently a free number that already disagrees with the compartments. Capacity is only displayed in Fleet and used in one fleet statistic; loading is validated against compartment capacity, not truck capacity. Deriving it is therefore low risk and removes a class of errors permanently.
2. **Configuration should be separated from operations, but not all of it should be admin-only.** A fleet manager must be able to add a truck, a compartment or a driver without asking a director. The right split is by permission, not by hiding everything behind one admin role:
   - organisation, locations, roles, members, policies: Director/admin.
   - fleet setup: Director + Fleet manager.
   - catalogue (products, suppliers, depots): Director + Operations.
   - commercial master (customers and their stations): Director + Operations/Sales.
3. **"Deletable" should mean archive, not hard delete.** Almost every configuration record is referenced by history (see section 5). Hard deletion would either fail or destroy traceability. Use active/inactive or retired status, with deletion only for records that have never been used.

## 2. What is configuration today

| Area | Item | Current home | Manage permission | Assessment |
|---|---|---|---|---|
| Tenant | Organisation profile, code, status | Settings (summary only) | `organisation.manage` | Partly available |
| Tenant | Business locations / own stations | **No CRUD in the app**; seeded only | — | **Gap** |
| Tenant | Roles, members, location grants | Access | `users.manage` | Available |
| Tenant | Approval thresholds | Settings → Business rules | `organisation.manage` | Available |
| Tenant | Transporter charge categories | Settings → Business rules | `organisation.manage` | Available |
| Tenant | Operating policy, closure, aging, correction method | Settings → Business rules | `organisation.manage` | Available |
| Supply | Products | Procurement → Catalogue | `procurement.manage` | Available, operational nav |
| Supply | Suppliers and supplier depots | Procurement → Suppliers | `procurement.manage` | Available, operational nav |
| Supply | Supplier-product links | Procurement → Catalogue | `procurement.manage` | Available, operational nav |
| Supply | Cost categories | Procurement → Costs | `procurement.manage` | Available, operational nav |
| Supply | Tolerance rules | Reconciliation | `transport.manage` | Available, arguably Settings |
| Fleet | Transporters | Fleet | `transport.manage` | Available, operational nav |
| Fleet | Trucks, compartments, drivers | Fleet | `transport.manage` | Available, operational nav |
| Fleet | **Compartment haulage rate card** | **Not modelled**; only a per-load quote on `trip_loading_records.haulage_cost` | `transport.manage` | **Gap** |
| Commercial | Customers | Sales | `sales.manage` | Available, operational nav |
| Commercial | Customer delivery locations | Sales → Customers | `sales.manage` | Available, but only inside the customer record |
| Transactions | POs, batches, trips, loading, deliveries, invoices, payments, issues | Operational modules | Module manage | Not configuration |

## 3. Proposed target structure

A **Setup** area, either under Settings or as its own navigation group, with sub-pages:

```
Settings / Setup
  Organisation        profile, code, timezone/currency (future)
  Locations           own depots and stations, active/inactive
  Fleet               transporters, trucks, compartments, drivers
  Catalogue           products, suppliers, supplier depots, links
  Commercial          customers, customer stations, payment terms
  Rules               approvals, charge categories, policies, tolerances
  Access              members, roles, location grants
```

Operational modules keep only transactions:

- Procurement: purchase orders, batches, matching.
- Sales: orders.
- Fleet: spend and availability views.
- Dispatch: trips, assignments, loading, allocations.
- Deliveries, reconciliation, haulage bills, money.

This matches the PetroCore.app mental model: configure once in Setup, operate every day in the modules.

### Permission model

Do not gate the whole Setup area on `organisation.manage`; that would remove fleet setup from the Fleet manager. Add two or three granular permissions instead:

| Permission | Director | Operations | Fleet manager |
|---|---|---|---|
| `settings.manage` (organisation, locations, rules) | ✓ | — | — |
| `fleet.configure` (transporters, trucks, compartments, drivers, rates) | ✓ | — | ✓ |
| `catalogue.manage` (products, suppliers, depots, links, cost categories) | ✓ | ✓ | — |
| `commercial.manage` (customers and their stations) | ✓ | ✓ | — |

The existing `transport.manage`, `procurement.manage` and `sales.manage` can remain as the operational permissions. This keeps today's behaviour while making configuration deliberate.

## 4. Truck capacity: recommendation

### Current state

- `trucks.capacity` is a required number.
- Compartments have their own capacities.
- Loading validates against `truck_compartments.capacity`; truck capacity is not used in posting.
- Fleet displays truck capacity and a total capacity statistic.
- The demo data already disagrees: 45,000 L stored vs 61,200 L in compartments.

### Options

| Option | How | Verdict |
|---|---|---|
| **A. Derive and drop the column** | Remove `trucks.capacity`; compute `sum(compartment.capacity)` in the fleet query; capacity field becomes read-only text "Capacity = sum of compartments" | **Recommended.** One source of truth, no triggers, no drift. Low risk because only Fleet uses it. |
| B. Keep the column, maintain by trigger | Trigger on compartment insert/update/delete recalculates `trucks.capacity`; UI read-only | Keeps existing queries but keeps a redundant value and trigger surface. Acceptable if external reports depend on the column. |
| C. Keep manual entry, validate equality | Reject save when capacity differs from compartment sum | Worst of both: still duplicates, and compartments must exist before the truck can be saved. |

### Consequences of option A

- Migration: drop `trucks.capacity`; no backfill needed.
- Fleet page computes capacity per truck from the compartments it already loads, and the total from those sums.
- Truck form loses the capacity input; show the computed capacity and a link to compartments.
- A truck with no compartments shows 0 and should be flagged as incomplete for dispatch.
- `truckSchema`/`truckUpdateSchema`, tests and forms drop the capacity field.
- Historical trips do not snapshot truck capacity, so nothing to rewrite.

**Open question:** are compartments always exhaustive? If a truck can have unallocated tank space, the sum is not the whole capacity. If yes, derive. If no, the model needs an explicit "unallocated" figure rather than a hidden difference.

## 5. Editable and deletable: what is actually possible

Foreign keys already point at the masters:

| Record | Referenced by |
|---|---|
| Truck | trip assignments, compartments |
| Compartment | trip loading records |
| Business location | inventory batches, movements, reservations, issues, procurement batches, trips (origin/destination), user location access |
| Supplier | purchase orders, batches, cost components, supplier depots, links, payments |
| Product | PO lines, procurement batches, inventory, sales lines, loading, deliveries, tolerance rules |
| Customer | sales orders, payments, customer locations |
| Transporter | trucks, drivers, invoices, assignments, payments |
| Role | role permissions, user roles |

Hard deletion would fail or erase the links behind historical documents. The practical rule:

- **Unreferenced record:** allow hard delete, with a typed confirmation.
- **Referenced record:** allow **archive / deactivate / retire**; keep the row, hide it from new documents, keep it on history.
- **Never delete:** audit rows, posted stock, financial records, trip history.
- Add an audit event for every configuration change and lifecycle transition.

The current app already follows this for suppliers, products, customers, fleet and compartments. Locations have no CRUD at all, so that is the first real gap.

## 6. Business locations

Locations are currently seeded and read by Access, Inventory, Procurement, Dispatch and Fleet. There is no create/edit/deactivate screen. The proposed Setup → Locations page should:

- create own depots/stations with code, name, type, address, contact and storage flag;
- edit them and deactivate/reactivate them;
- refuse deletion when referenced, offering deactivate instead;
- show usage counts (batches, trips, grants) before a delete attempt;
- keep customer stations separate: customer locations are commercial master data, not tenant infrastructure.

## 7. Compartment haulage "chart"

Today the only haulage amount is `trip_loading_records.haulage_cost`, a quote captured at loading. There is no configured rate per compartment. If "haulage of each compartment based on its chart" means a standing rate card, the model needs:

```
compartment_haulage_rates
  compartment_id
  rate_type        flat_per_trip | per_litre | per_km | per_compartment
  amount
  effective_from
  effective_to
```

Loading would prefill the current rate and store a **snapshot** of the amount on the loading record, so a later rate change never rewrites history. This is a separate decision because the rate basis is not defined. It should not be faked with a single number.

## 8. Benefits and downsides

### Benefits

- One source of truth for capacity; no impossible totals.
- Configuration is found once, in one place, instead of being scattered across operational pages.
- Cleaner daily screens for operators; Setup is visited rarely.
- Clear permission boundaries and a simpler onboarding path.
- Consistent with PetroCore.app, reducing training and support.
- Archival instead of deletion preserves historical traceability.
- Rates and policies become auditable and effective-dated.

### Downsides

- Navigation and URL churn: bookmarks and tests that point at `/workspace/fleet` or `/workspace/procurement` change or need redirects.
- Fleet managers may lose setup access unless granular permissions are added; this must be designed, not assumed.
- More permission keys and a larger Settings surface.
- Migration work across forms, actions, validation, tests and docs.
- Hard delete is often impossible; users may expect deletion and get archive instead. The UI must explain why.
- Effective-dated rates and snapshots add schema and reporting complexity.
- Configuration errors have wider blast radius; they need audit and confirmation.
- A truck with no compartments becomes visibly incomplete; dispatch must treat it as unavailable.

## 9. Recommended phases

**Phase 1 — correctness and the missing location screen (small, low risk)**

- Derive truck capacity; remove manual entry; show "sum of compartments".
- Add Setup → Locations with create/edit/deactivate and usage counts.
- Add an incomplete-truck warning when compartments are missing.
- Add unit tests for capacity calculation and location validation.

**Phase 2 — Setup hub and permissions**

- Create the Setup area and move Fleet, Catalogue and Commercial master pages behind it, with redirects from old routes.
- Add `settings.manage`, `fleet.configure`, `catalogue.manage`, `commercial.manage`; update Director/Operations/Fleet presets.
- Replace hard delete with archive where referenced; add audit events.

**Phase 3 — rate cards and effective dates**

- Compartment haulage rate card with basis and effective dates.
- Snapshot the applied rate on loading records.
- Show rate and actual invoice variance on the trip statement.

## 10. Decisions needed

1. **Compartments exhaustive?** If yes, capacity is a pure sum. If not, what is the unallocated allowance?
2. **Who configures fleet?** Recommended: Director and Fleet manager (`fleet.configure`), not Director only.
3. **Delete or archive?** Recommended: archive for referenced records, hard delete only for unused ones.
4. **Haulage chart basis:** flat per trip, per litre, per km, or per compartment? Effective from when?
5. **Locations:** are own depots/stations the only infrastructure, or should customer stations also be managed from Setup?
