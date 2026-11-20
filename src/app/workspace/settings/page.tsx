import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ResetDemoDataForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { tenant } = await getCurrentTenant(supabase, userData.user.id);

  if (!tenant) {
    redirect("/workspace");
  }

  const { data: canManage } = await supabase.rpc("has_permission", {
    p_permission_key: "organisation.manage",
  });

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Settings" title="Not authorised" />
        <Alert tone="warning">You cannot manage organisation settings.</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={tenant.organisationName}
        description={`${tenant.organisationCode} · tenant administration`}
      />

      <Card>
        <CardHeader
          title="Locations"
          description="Depots, stations and transit points used by procurement, inventory, dispatch and access."
        />
        <CardBody className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Configure storage and transit locations once. Deactivate a location instead of deleting it so historical
            batches, trips and access grants stay attached.
          </p>
          <ButtonLink href="/workspace/settings/locations">Manage locations</ButtonLink>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Business rules"
          description="Approval thresholds, transporter charge categories and operating policy."
        />
        <CardBody className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Approval tiers, charge categories, the trip closure policy and the default correction method are stored per
            organisation. Tolerance values remain per product on the reconciliation page.
          </p>
          <ButtonLink href="/workspace/settings/rules">Manage business rules</ButtonLink>
        </CardBody>
      </Card>

      <Card className="border-[var(--danger)]/30">
        <CardHeader
          title="Clear demo data"
          description="Removes transaction records only, and cannot be undone."
        />
        <CardBody className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Deletes procurements, sales orders, trips, loading, deliveries, evidence files, reconciliation, inventory,
            issues, recoveries, invoices, payments and tolerance rules.
          </p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Keeps the organisation, users, roles, locations, products, suppliers, transporters, trucks, drivers,
            customers, depots and the audit trail.
          </p>
          <ResetDemoDataForm organisationCode={tenant.organisationCode} />
        </CardBody>
      </Card>

      <p className="text-xs leading-6 text-[var(--muted)]">
        The reset runs as one database transaction. If any step fails, nothing is deleted.
      </p>
    </div>
  );
}
