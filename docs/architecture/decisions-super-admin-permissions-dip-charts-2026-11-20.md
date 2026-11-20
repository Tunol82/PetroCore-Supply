# Decisions: Super Admin, tenant Admin, permissions and dip charts

| Field | Detail |
|---|---|
| Date | 2026-11-20 |
| Status | **Decisions captured — implementation not started** |
| Supersedes | Authority and dip-chart sections of `setup-super-admin-and-dip-charts-2026-11-20.md` |
| Owner answers | Before/after dips with optional discharge; unit/import not decided; chart activation Super Admin only; no-chart waiver by Super Admin; Super Admin is global and Admin is tenant-level; Super Admin sets permissions |

## 1. Decisions

### D1 — Dip readings

- **Loading:** record **dip before** and **dip after**. Dip before defaults to **0** (empty) but is editable.
- **Volume loaded:** `chart(dip_after) − chart(dip_before)`.
- **Discharge:** optional **dip before** and **dip after**. When present, `discharged = chart(dip_before) − chart(dip_after)` and is compared with the customer-confirmed quantity. When absent, delivery records keep the existing quantity fields.
- **Snapshot:** each loading/discharge stores the chart ID, chart version, the two dips and the computed volume. A later chart revision never rewrites history.
- **Override:** only with a waiver (D4); the waiver reference and reason are stored on the record.

### D2 — Units and import

Not decided by the owner. Recommendation:

- Dip in **millimetres**, integer.
- Volume in **litres**, three decimals.
- CSV columns: `dip_mm,volume_l`; optional header row; points sorted ascending.
- Validate strictly increasing dip and volume, last volume at or below compartment capacity, no duplicate dips.
- Manual grid entry in addition to CSV, so a small correction does not require a file.

This can change without affecting the rest of the model.

### D3 — Chart activation

- Charts are created and edited as **draft** by the tenant Admin.
- **Only Super Admin activates** a chart version. Activation is a reserved action, not a normal tenant permission.
- The active chart is immutable. A change creates a new draft version; the previous version is retired after activation.
- Activation and retirement are audited with the Super Admin identity.

If this becomes an operational bottleneck, the reserved action can later be delegated as `charts.activate`; the default remains Super Admin only.

### D4 — Compartments without a chart

- Loading a compartment with **no active chart is blocked**.
- Super Admin can issue a **waiver** for a specific compartment/loading window:
  - compartment and (optionally) truck,
  - reason,
  - valid from/to, or a single loading reference,
  - issued by, issued at, expiry,
  - audit event.
- Under a valid waiver, the operator may enter a manual volume with a required reason. The loading record stores `volume_source = manual`, the waiver ID and the reason.
- A waiver is not a permanent bypass: it expires and is visible in the loading history.

### D5 — Authority model

| Role | Scope | Configuration |
|---|---|---|
| **Super Admin** | **All tenants** (current platform administrator, MFA) | Creates tenants; configures any tenant; sets role permissions; activates charts; issues waivers; platform audit |
| **Admin** | One tenant (current `Administrator` role) | Organisation, locations, fleet assets, chart drafts, catalogue, commercial master, members, roles within its tenant |
| **Director** | One tenant | Default: oversight, approvals, operations, audit; **no configuration**. Super Admin/Admin may grant more |
| **Operations staff** | One tenant | Supply, stock, sales and dispatch operations |
| **Fleet manager** | One tenant | Fleet and dispatch operations; selects configured assets; no setup |

The existing `platform_admins` table is the Super Admin layer. The existing tenant `Administrator` role is the Admin layer. The UI should present them with those names; the database role name can be migrated later without changing IDs.

Super Admin actions inside a tenant must be attributable to the Super Admin, not the target member. Impersonation currently writes as the target (DR-27). Reserved actions such as chart activation and waivers should use a platform-audited action path rather than ordinary impersonation.

### D6 — Permissions are configurable

- Role permissions are database-backed and editable. The current Roles tab is read-only; the next step is the editor.
- Super Admin can set permissions for any tenant. Tenant Admin can manage its own roles subject to reserved Super Admin actions.
- The three standard roles are **defaults**, not hard limits. A Director can be granted full access if the Super Admin/Admin decides.
- Guardrails:
  - prevent removing the last `users.manage` holder in a tenant,
  - prevent a user from locking themselves out,
  - audit every permission change with actor and before/after,
  - reserved actions (`charts.activate`, waiver approval, tenant creation) are not ordinary permissions.
- Reserved actions may later become delegable permissions; the default remains Super Admin only.

## 2. Revised dip-chart model

```sql
compartment_calibration_charts
  id, organisation_id, compartment_id, version
  status draft | active | retired
  effective_from, effective_to, source, notes
  created_by, created_at, activated_by, activated_at, retired_at
  unique (compartment_id, version)
  partial unique (compartment_id) where status = 'active'

compartment_calibration_points
  id, chart_id, dip_mm integer, volume_l numeric(18,3)
  unique (chart_id, dip_mm)

trip_loading_records +
  dip_before_mm, dip_after_mm
  calibration_chart_id, calibration_version
  volume_source chart | manual
  waiver_id, override_reason

trip_delivery_records +
  dip_before_mm, dip_after_mm (optional)
  calibration_chart_id, calibration_version (optional)
  discharge_source chart | manual

compartment_chart_waivers
  id, organisation_id, compartment_id, truck_id
  reason, valid_from, valid_to, issued_by, issued_at, revoked_at
```

Computation:

```
loaded   = chart(dip_after) − chart(dip_before)
discharged = chart(dip_before) − chart(dip_after)   // when both present
```

- Dip before defaults to 0 but is stored explicitly.
- Missing chart + no waiver = blocked.
- Missing chart + valid waiver = manual volume with reason.
- Out-of-range dip = rejected; never extrapolated.
- Capacity remains fixed on the compartment; truck capacity is the sum.

## 3. Impact on what exists

| Item | Today | Change |
|---|---|---|
| Tenant top role | `Administrator` (13 permissions) | Present as **Admin**; Super Admin sits above it |
| Platform admin | Support/impersonation | Present as **Super Admin**; add tenant configuration and reserved actions |
| Director | 10 permissions, Audit page | Default unchanged; permissions become editable |
| Roles tab | Read-only matrix | Add permission editor with guardrails and audit |
| Fleet | Assets edited in Fleet | Move to Setup; Fleet selects active assets |
| Trucks | Manual capacity | Derived; no manual entry |
| Loading | Manual volume | Dip before/after, chart-derived volume; waiver fallback |
| Deliveries | Quantity only | Optional discharge dips |
| Chart activation | Does not exist | Super Admin only, audited |
| Waivers | Does not exist | Super Admin only, expiring, audited |

## 4. Benefits and downsides of these decisions

**Benefits**

- Both loading and discharge volumes are evidence-based.
- Chart history is immutable and defensible.
- Super Admin and Admin have clear, separate scopes.
- Permissions are adjustable instead of hard-coded.
- Waivers handle exceptions without silently allowing manual volumes.

**Downsides**

- Chart activation by Super Admin only can block operations; the process needs a service-level commitment.
- Waivers add another approval queue and expiry to manage.
- Editable permissions can create unsafe combinations unless guardrails are enforced.
- Super Admin direct configuration needs a new audited path; impersonation alone is not sufficient for reserved actions.
- Dip capture adds work at loading and delivery.
- Units/import are still undecided, so the chart editor must not be built until D2 is confirmed.

## 5. Recommended delivery order

1. **Authority and permissions (small, foundational):** present Super Admin vs Admin, add the role-permission editor with guardrails and audit; keep Director default.
2. **Capacity and locations:** derive truck capacity; add Setup → Locations.
3. **Chart foundation:** schema, validation, draft editor and CSV import.
4. **Activation and waivers:** Super Admin-only actions, audited.
5. **Loading/discharge integration:** dip before/after, computed volumes, waiver path.
6. **Setup separation and rate cards:** move fleet/catalogue config behind permissions, then compartment haulage rates.

## 6. Remaining questions

1. **Units/import:** confirm millimetres and `dip_mm,volume_l` CSV. Say if the chart uses centimetres or inches.
2. **Super Admin configuration path:** direct platform configuration, or impersonation with dual attribution? Direct is recommended for reserved actions.
3. **Chart activation:** is Super Admin only a hard rule, or a reserved permission that can never be delegated? Default is hard for now.
4. **Discharge dips:** are they recorded per delivery record, or per compartment within a delivery?
5. **Waiver scope:** per loading, per compartment for a date range, or both? Recommendation: both, with a single-loading waiver as the narrowest option.
