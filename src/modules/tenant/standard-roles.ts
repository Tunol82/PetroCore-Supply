export const PERMISSION_LABELS: Record<string, string> = {
  "audit.view": "View audit trail",
  "inventory.manage": "Manage inventory and stock issues",
  "inventory.view": "View inventory",
  "locations.manage": "Manage business locations",
  "locations.view_all": "View all locations",
  "organisation.manage": "Manage organisation settings",
  "procurement.manage": "Manage procurement",
  "procurement.view": "View procurement",
  "sales.manage": "Manage sales",
  "sales.view": "View sales",
  "transport.manage": "Manage fleet, dispatch and haulage",
  "transport.view": "View fleet, dispatch and haulage",
  "users.manage": "Manage members, roles and access",
};

export type StandardRole = {
  name: string;
  description: string;
  permissions: string[];
};

const OPERATIONS = [
  "procurement.view",
  "procurement.manage",
  "inventory.view",
  "inventory.manage",
  "sales.view",
  "sales.manage",
  "transport.view",
  "transport.manage",
  "locations.view_all",
];

const DIRECTOR = [
  "audit.view",
  "inventory.view",
  "inventory.manage",
  "procurement.view",
  "procurement.manage",
  "sales.view",
  "sales.manage",
  "transport.view",
  "transport.manage",
  "locations.view_all",
];

const FLEET = [
  "transport.view",
  "transport.manage",
  "procurement.view",
  "inventory.view",
  "sales.view",
  "locations.view_all",
];

/**
 * The three operating roles the business asked for. Provisioning is opt-in per
 * tenant, creates only missing roles and adds only missing permissions, so a
 * tenant that has customised a role is never overwritten.
 */
export const STANDARD_ROLES: StandardRole[] = [
  {
    name: "Director",
    description: "Oversight, approvals and operational control without configuration, people or settings administration.",
    permissions: DIRECTOR,
  },
  {
    name: "Operations staff",
    description: "Day-to-day procurement, stock, sales and dispatch, without people or organisation settings.",
    permissions: OPERATIONS,
  },
  {
    name: "Fleet manager",
    description: "Fleet, dispatch, haulage and trip costs, with read-only supply context.",
    permissions: FLEET,
  },
];
