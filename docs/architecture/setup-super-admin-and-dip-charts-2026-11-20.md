# Setup, Super Admin, fleet assets and compartment dip charts

| Field | Detail |
|---|---|
| Date | 2026-11-20 |
| Status | **Revised proposal — Director configuration removed; no chart schema applied yet** |
| Supersedes | `docs/architecture/configuration-and-capacity-2026-11-20.md` || Owner decisions captured | Configuration belongs to a Super Admin; Directors do not configure; trucks are one-time assets configured once and selected by Fleet managers; compartments have fixed capacity and an updatable dip chart; actual daily volumes change |

## 1. The model in one page

- **Capacity is fixed per compartment.** A truck's capacity is the sum of its compartments. The truck does not need a separate capacity field.
- **A dip chart is calibration, not capacity.** It maps a physical level (dip) in a compartment to a volume. A 15,000 L compartment can read 11,400 L at a particular dip without changing its 15,000 L capacity.
- **Charts are versioned configuration.** The active chart is used for new readings. Historical readings keep the chart version and computed volume, so revising a chart never rewrites history.
- **Super Admin configures; Fleet Manager operates.** Trucks, compartments, charts, locations and rates are configured once in Setup. The Fleet Manager selects from active, configured assets and cannot invent them.
- **Directors oversee, they do not configure.** Director keeps broad operational access, approvals and audit, but not organisation, people, locations or setup.

## 2. Role model

| Permission | Super Admin (Administrator) | Director | Operations staff | Fleet manager |
|---|---|---|---|---|
| `audit.view` | ✓ | ✓ | — | — |
| `inventory.manage` | ✓ | ✓ | ✓ | — |
| `inventory.view` | ✓ | ✓ | ✓ | ✓ |
| `locations.manage` | ✓ | — | — | — |
| `locations.view_all` | ✓ | ✓ | ✓ | ✓ |
| `organisation.manage` | ✓ | — | — | — |
| `procurement.manage` | ✓ | ✓ | ✓ | — |
| `procurement.view` | ✓ | ✓ | ✓ | ✓ |
| `sales.manage` | ✓ | ✓ | ✓ | — |
| `sales.view` | ✓ | ✓ | ✓ | ✓ |
| `transport.manage` | ✓ | ✓ | ✓ | ✓ |
| `transport.view` | ✓ | ✓ | ✓ | ✓ |
| `users.manage` | ✓ | — | — | — |
| **Total** | **13** | **10** | **9** | **6** |

**Applied now:** the Director role has lost `users.manage`, `organisation.manage` and `locations.manage`. Director still has operational manage rights because there is no separate approval permission yet and fleet configuration has not yet moved out of `transport.manage`. A read-only **Audit** page at `/workspace/audit` now serves `audit.view` holders; Access and Settings remain Super Admin only.

**Target:** add `configuration.manage` for the Setup area. Only Super Admin receives it. `transport.manage` then means “operate fleet and dispatch”, not “create trucks or charts”.

The Super Admin is the existing tenant `Administrator` role. It is distinct from the platform administrator, who supports tenants and impersonates but does not own tenant configuration. Renaming the tenant role to “Super Admin” is a presentation decision; keeping the database name avoids breaking migrations and seeds.

## 3. Configuration inventory and target home

| Configuration | Current home | Target |
|---|---|---|
| Organisation profile | Settings | Setup → Organisation |
| Business locations / own stations | **No CRUD** | Setup → Locations |
| Members, roles, grants | Access | Setup → Access |
| Approval thresholds, charge categories, policies, tolerances | Settings → Rules / Reconciliation | Setup → Rules |
| Transporters | Fleet | Setup → Fleet |
| Trucks, compartments, dip charts | Fleet / none | Setup → Fleet |
| Compartment haulage rates | Not modelled | Setup → Fleet → Rates |
| Drivers | Fleet | Setup → Fleet |
| Products, suppliers, supplier depots, links, cost categories | Procurement | Setup → Catalogue, `procurement.manage` |
| Customers, customer stations, credit terms | Sales | Setup → Commercial, `sales.manage` |
| Purchase orders, batches, trips, loading, deliveries, invoices, payments | Operation modules | Unchanged |

Not every master is one-time. Suppliers, products and customers change often, so they stay master data with Operations access; only infrastructure that defines how the business is structured moves to Super Admin.

## 4. Truck, compartment and dip chart

### Truck and compartment rules

- A truck is a one-time asset: registration, make/model, ownership, transporter link, status.
- A truck has one or more compartments. Each compartment has a **fixed capacity** and product compatibility.
- Truck capacity is **derived** as `sum(compartment.capacity)`; the manual capacity field is removed.
- A truck with no compartments is incomplete and cannot be selected for dispatch.
- A truck or compartment is archived, not hard-deleted, once referenced by history.
- The truck cannot be changed on a compartment after loading history exists.

### Dip chart rules

A chart belongs to one compartment and is a set of calibration points:

```
dip (level) → volume (litres)
```

For example, a 15,000 L compartment:

| Dip (mm) | Volume (L) |
|---:|---:|
| 0 | 0 |
| 300 | 2,400 |
| 600 | 5,100 |
| 900 | 8,000 |
| 1,200 | 11,400 |
| 1,500 | 15,000 |

- Capacity stays 15,000 L. A reading of 1,200 mm yields 11,400 L.
- Points must be strictly increasing in both dip and volume.
- The last point should equal the compartment capacity; the first point should be the zero/empty level.
- Volume between points is **linearly interpolated**; a dip outside the chart is rejected, not extrapolated.
- One active chart per compartment at a time. Changes create a **new version**; the active chart is never edited in place once used.
- A chart has a source reference (manufacturer sheet, calibration certificate), notes, effective date and audit trail.
- Charts can be entered manually or imported from CSV.

### Loading and daily actuals

The chart does not change; the measured dip and resulting volume change every day. The loading flow should record:

| Field | Purpose |
|---|---|
| Compartment | Configured asset |
| Dip before (optional) | Empty/baseline reading |
| Dip after | Reading after filling |
| Active chart version | Snapshot used for the calculation |
| Computed volume | `chart(after) − chart(before)` or `chart(after)` when starting empty |
| Volume source | `chart` or `manual` |
| Override reason | Required when a manual volume is used |
| Loaded date/time | Daily actual |

For discharges, the same before/after dip pair can derive the discharged volume and be compared with the customer-confirmed quantity. Whether discharge dips are in the first release is a decision below.

### Schema proposal

```sql
compartment_calibration_charts
  id, organisation_id, compartment_id
  version integer
  status draft | active | retired
  effective_from date, effective_to date
  source, notes
  created_by, created_at, activated_at, retired_at
  unique (compartment_id, version)
  partial unique (compartment_id) where status = 'active'

compartment_calibration_points
  id, chart_id, dip_mm integer, volume_l numeric(18,3)
  unique (chart_id, dip_mm)

-- loading records gain
  dip_before_mm, dip_after_mm
  calibration_chart_id
  volume_source chart | manual
  override_reason

-- compartment rates (phase 4)
compartment_haulage_rates
  id, compartment_id, basis flat_per_trip | per_litre | per_km
  amount, effective_from, effective_to
```

`trucks.capacity` is removed; the fleet query sums compartments. Existing loading volumes remain `manual` and are not rewritten.

## 5. What to take from PetroCore.app

PetroCore.app already uses the right shape:

- **Administration is separate** from daily operations: Approvals, Users, Station Config.
- **Station Config owns the assets**: stations, pumps per product, opening values and cost per litre.
- **Managers select from configured lists.** Regional managers are scoped to allowed stations and cannot invent one.
- **Configuration is restricted.** Only certain roles can change station configuration or prices.

What to copy:

- Admin-only Setup area.
- Configured lists drive operational dropdowns.
- Scoped managers (stations there; trucks, locations or business units here).
- Clear, compact operational screens; configuration is visited rarely.

What to improve:

- Relational tables with constraints instead of JSON blobs/localStorage.
- RLS and server-side permission checks on every change.
- Versioned dip charts with immutable history.
- Soft delete/archive with usage checks.
- Audit events for every configuration change and chart activation.
- Typed APIs, unit tests and authenticated e2e tests.

Do not copy the monolithic HTML/localStorage architecture or hard-delete behaviour.

## 6. Architecture impact

| Area | Impact |
|---|---|
| Schema | New chart/point/rate tables; loading dip fields; drop `trucks.capacity`; backfill existing masters |
| RLS | Read active assets/charts to tenant members; write only to `configuration.manage` holders |
| Permissions | New `configuration.manage`; Director loses configuration; Fleet Manager keeps operations only |
| Navigation | Setup group/pages; old Fleet/Catalogue routes redirect; operational nav slims down |
| Operational pickers | Only active, complete trucks with an active chart per compartment |
| Loading | Dip entry, chart lookup, interpolation, snapshot, manual override with reason |
| Audit | Chart version activation, capacity/compartment changes, archive actions |
| Tests | Interpolation/validation units; RLS; chart editor e2e; fleet selection; loading derived volume |
| Migration | Existing compartments have no chart; loading stays manual until charts are loaded |
| Training | Admin learns chart import/activation; fleet learns dip capture |

## 7. Benefits and downsides

**Benefits**

- Volumes are derived from the physical dip, not guessed; fewer disputes and manual errors.
- Capacity can never disagree with compartments.
- Chart changes are historical events, not silent edits.
- Configuration is central, permissioned and audited.
- Fleet managers get a clean list of available assets.
- Directors oversee without accidental configuration changes.
- Full traceability from dip → chart version → volume → trip.

**Downsides**

- Chart data entry/import is real work; a bad chart produces bad volumes.
- Chart versioning, activation and interpolation add code and tests.
- Fleet operations depend on Super Admin for new assets; a slow admin becomes an operational blocker.
- Existing compartments have no charts; there is a transition period of manual volumes.
- UI restructuring, redirects and permission migration.
- Disputes may arise over interpolation or chart accuracy; the source document and version must be defensible.
- Rate cards add another effective-dated layer.

## 8. Phased delivery

**Phase 1 — foundations (small)**

- Derive truck capacity; remove manual entry; flag incomplete trucks.
- Setup → Locations with create/edit/archive and usage counts.
- Director configuration removal (done) and Super Admin copy.
- Unit tests for capacity and locations.

**Phase 2 — Setup separation**

- Create Setup area; move fleet registry, locations and rules behind `configuration.manage`.
- Fleet becomes operational: available trucks, spend, status.
- Remove create/edit links from operational pages; redirect old routes.
- Archive instead of hard delete for referenced assets.

**Phase 3 — dip charts**

- Chart/point schema, validation, versioning and activation.
- Chart editor + CSV import in Setup → Fleet → Compartment.
- Loading captures dips, derives volume, snapshots chart and allows manual override with reason.
- Unit tests for interpolation and range rejection; e2e for a configured chart.

**Phase 4 — rates and daily controls**

- Compartment haulage rate cards with effective dates.
- Optional discharge dips and comparison with confirmed delivery.
- Daily dip/volume report per truck/compartment.

## 9. Decisions needed

1. **Super Admin identity:** keep the existing Administrator role as tenant Super Admin, or rename it? Can there be more than one?
2. **Director visibility:** no Setup at all, or read-only Setup with no changes?
3. **Measurement points:** final dip only, or before/after dips for loading; and before/after for discharge?
4. **Chart units and import:** dip in millimetres? CSV columns and rounding rules?
5. **Chart activation:** Super Admin only, or a second approval? Should a chart be usable while draft?
6. **No chart:** block loading, or allow manual volume with a required reason?
7. **Master data ownership:** suppliers, products and customers remain Operations master data, or also Super Admin?
8. **Rate basis:** flat per trip, per litre, per km, or per compartment?

## 10. Immediate next slice

If approved, Phase 1 is the lowest-risk starting point: derive truck capacity, add Locations, and confirm the Director/Super Admin split. Phase 3 should not start until the measurement points and chart import format are agreed.
