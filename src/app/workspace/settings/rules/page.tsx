import { redirect } from "next/navigation";
import { createClient } from "@/shared/lib/supabase/server";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getCurrentTenant } from "@/modules/tenant/current-tenant";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import {
  ApprovalThresholdForm,
  ChargeCategoryForm,
  ChargeCategoryToggle,
  PolicyForm,
  ThresholdToggle,
} from "./rule-forms";

export const dynamic = "force-dynamic";

type Threshold = {
  id: string;
  action: string;
  min_amount: number;
  max_amount: number | null;
  required_permission: string;
  active: boolean;
  notes: string | null;
  created_at: string;
};

type ChargeCategory = {
  id: string;
  code: string;
  label: string;
  sort_order: number;
  active: boolean;
};

type Policy = {
  trip_closure_policy: string;
  closure_override_permission: string;
  unresolved_aging_days: number;
  default_correction_method: string | null;
};

const TABS = ["approvals", "charges", "policies"] as const;

const ACTION_LABELS: Record<string, string> = {
  liability_confirm: "Liability confirmation",
  liability_write_off: "Write-off approval",
};

const CLOSURE_LABELS: Record<string, string> = {
  allow: "Allow closure with open items",
  warn: "Warn but allow closure",
  block: "Block closure with open items",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function BusinessRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
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
        <PageHeader
          eyebrow="Business rules"
          title="Not authorised"
          description="Changing approval thresholds and operating policy needs organisation.manage."
        />
        <ButtonLink href="/workspace/settings">Back to settings</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "approvals";

  const [thresholdsResult, permissionsResult, categoriesResult, policyResult] = await Promise.all([
    supabase
      .from("approval_thresholds")
      .select("id, action, min_amount, max_amount, required_permission, active, notes, created_at")
      .order("action")
      .order("min_amount"),
    supabase.from("permissions").select("permission_key").order("permission_key"),
    supabase
      .from("transporter_charge_categories")
      .select("id, code, label, sort_order, active")
      .order("sort_order")
      .order("label"),
    supabase
      .from("operating_policies")
      .select("trip_closure_policy, closure_override_permission, unresolved_aging_days, default_correction_method")
      .eq("organisation_id", tenant.organisationId)
      .maybeSingle(),
  ]);

  const queryError =
    thresholdsResult.error ?? permissionsResult.error ?? categoriesResult.error ?? policyResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Business rules" title="Unavailable" description="Business rules could not be loaded." />
      </div>
    );
  }

  const thresholds = (thresholdsResult.data ?? []) as Threshold[];
  const permissions = ((permissionsResult.data ?? []) as { permission_key: string }[]).map(
    (row) => row.permission_key,
  );
  const categories = (categoriesResult.data ?? []) as ChargeCategory[];
  const policy = (policyResult.data ?? null) as Policy | null;

  const activeThresholds = thresholds.filter((threshold) => threshold.active).length;
  const activeCategories = categories.filter((category) => category.active).length;
  const effectivePolicy = {
    tripClosurePolicy: policy?.trip_closure_policy ?? "warn",
    closureOverridePermission: policy?.closure_override_permission ?? "transport.manage",
    unresolvedAgingDays: policy?.unresolved_aging_days ?? 7,
    defaultCorrectionMethod: policy?.default_correction_method ?? null,
  };

  const tabs = [
    { href: "/workspace/settings/rules?tab=approvals", label: "Approvals", count: thresholds.length },
    { href: "/workspace/settings/rules?tab=charges", label: "Charge categories", count: categories.length },
    { href: "/workspace/settings/rules?tab=policies", label: "Operating policy" },
  ];
  const activeHref = `/workspace/settings/rules?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business rules"
        title={tenant.organisationName}
        description="Approval authority, transporter charge categories and operating policy. Values are stored per organisation and applied by the database, not hardcoded."
        actions={<ButtonLink href="/workspace/settings">Settings</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active thresholds"
          value={activeThresholds}
          hint={activeThresholds === 0 ? "Current behaviour: transport.manage only" : "Highest matching tier wins"}
          tone="brand"
        />
        <StatCard
          label="Charge categories"
          value={activeCategories}
          hint={`${categories.length} defined`}
        />
        <StatCard
          label="Trip closure"
          value={effectivePolicy.tripClosurePolicy === "block" ? "Block" : effectivePolicy.tripClosurePolicy === "allow" ? "Allow" : "Warn"}
          hint={CLOSURE_LABELS[effectivePolicy.tripClosurePolicy] ?? "Warn but allow closure"}
        />
        <StatCard
          label="Aging window"
          value={`${effectivePolicy.unresolvedAgingDays} days`}
          hint="Unresolved items report"
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "approvals" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Approval thresholds"
              description="Applied to liability confirmation and write-offs. With no active tier, any transport.manage user can confirm."
            />
            <CardBody>
              {thresholds.length === 0 ? (
                <EmptyState
                  title="No thresholds configured"
                  description="Any transport.manage user can confirm a liability, at any amount."
                />
              ) : (
                <TableScroll>
                  <Table minWidth={940}>
                    <THead>
                      <TR>
                        <TH>Applies to</TH>
                        <TH>From</TH>
                        <TH>Up to</TH>
                        <TH>Required permission</TH>
                        <TH>Status</TH>
                        <TH>Added</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {thresholds.map((threshold) => (
                        <TR key={threshold.id}>
                          <TD className="font-medium">{ACTION_LABELS[threshold.action] ?? threshold.action}</TD>
                          <TD align="right">{formatMoney(Number(threshold.min_amount))}</TD>
                          <TD align="right">
                            {threshold.max_amount === null ? "No upper limit" : formatMoney(Number(threshold.max_amount))}
                          </TD>
                          <TD>
                            <Badge tone="brand" capitalize={false}>
                              {threshold.required_permission}
                            </Badge>
                          </TD>
                          <TD>
                            <StatusBadge status={threshold.active ? "active" : "inactive"} />
                          </TD>
                          <TD className="text-xs text-[var(--muted)]">
                            {new Date(threshold.created_at).toLocaleDateString("en-GB")}
                          </TD>
                          <TD>
                            <ThresholdToggle id={threshold.id} active={threshold.active} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Add threshold" description="Ranges are inclusive. The highest matching minimum wins." />
            <CardBody>
              <ApprovalThresholdForm permissions={permissions} />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "charges" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Transporter charge categories"
              description="Offered on transporter invoice lines. Deactivating hides a category without changing historic lines."
            />
            <CardBody>
              {categories.length === 0 ? (
                <EmptyState title="No charge categories" description="Add the first category below." />
              ) : (
                <TableScroll>
                  <Table minWidth={760}>
                    <THead>
                      <TR>
                        <TH>Code</TH>
                        <TH>Label</TH>
                        <TH align="right">Sort</TH>
                        <TH>Status</TH>
                        <TH>Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {categories.map((category) => (
                        <TR key={category.id}>
                          <TD className="mono text-xs">{category.code}</TD>
                          <TD className="font-medium">{category.label}</TD>
                          <TD align="right">{category.sort_order}</TD>
                          <TD>
                            <StatusBadge status={category.active ? "active" : "inactive"} />
                          </TD>
                          <TD>
                            <ChargeCategoryToggle id={category.id} active={category.active} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Add charge category" description="Code is stored on the line; label is what users see." />
            <CardBody>
              <ChargeCategoryForm />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Operating policy"
              description="Defaults shown are applied when no row is saved. Saving creates one row per organisation."
            />
            <CardBody>
              <PolicyForm permissions={permissions} policy={effectivePolicy} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What these settings do today" />
            <CardBody>
              <ul className="space-y-2 text-sm text-[var(--ink-2)]">
                <li>
                  <strong className="font-semibold">Approval thresholds</strong> are enforced by the database when a
                  liability is confirmed.
                </li>
                <li>
                  <strong className="font-semibold">Charge categories</strong> feed the transporter invoice line form.
                </li>
                <li>
                  <strong className="font-semibold">Trip closure</strong> and the aging window are stored but not yet
                  enforced, because there is no close action. When that action ships, it will read this policy.
                </li>
                <li>
                  <strong className="font-semibold">Correction method</strong> is available as a form default; no
                  automatic conversion is applied.
                </li>
                <li>
                  <strong className="font-semibold">Tolerance values</strong> are configured on the reconciliation page,
                  since they are per product.
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Limit: the aging window currently drives reporting only. No trip is auto-closed. Changing rules never restates
        existing records.
      </p>
    </div>
  );
}
