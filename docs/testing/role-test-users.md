# Role test accounts (non-production)

These accounts exist only in the **non-production** project and are used to review what each role sees. Do not recreate them in production.

| Role | Email | Name |
|---|---|---|
| Director | `director@petrocore.test` | QA Director |
| Operations staff | `operations@petrocore.test` | QA Operations |
| Fleet manager | `fleet@petrocore.test` | QA Fleet Manager |

Passwords were set when the accounts were created and shared with the owner outside this repository. If a password is lost, reset it in Supabase Authentication → Users, or recreate the account with the same email and role. Never commit the passwords.

## What each account should see

| Area | Director | Operations staff | Fleet manager |
|---|---|---|---|
| Procurement | Full | Full | View only |
| Inventory | Full | Full | View only |
| Stock issues | Full | Full | View only |
| Sales | Full | Full | View only |
| Fleet | Full | Full | Full |
| Dispatch | Full | Full | Full |
| Deliveries | Full | Full | Full |
| Trip checks / Haulage bills | Full | Full | Full |
| Money | Full | Full | Full |
| Access | Visible | Hidden / blocked | Hidden / blocked |
| Settings | Visible | Hidden / blocked | Hidden / blocked |
| Activity audit | Visible | Hidden | Hidden |
| Locations | Tenant-wide | Tenant-wide | Tenant-wide |

`Access` and `Settings` are both hidden from the sidebar and rejected by the page for the two non-administrator roles. The permission matrix on Access → Roles is the authoritative view.

## Verify or reset

1. Sign in at `/login` with the email and password.
2. Confirm the sidebar matches the table above.
3. If the roles are missing, open Access → Roles and choose **Create standard roles**. The action is idempotent and only adds missing roles/permissions.
4. To change a password, use Supabase Authentication → Users, or create a new account and assign the same role.

These accounts are not used by the automated Playwright suite; that suite uses separate users in the dedicated E2E project.
