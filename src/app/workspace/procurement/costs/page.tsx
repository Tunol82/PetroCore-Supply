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
import { Table, TBody, TD, TFoot, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { CostCategoryForm, CostComponentForm } from "./cost-forms";

export const dynamic = "force-dynamic";

type Category = {
  id: string;
  category_name: string;
  category_type: string;
  landed_cost_inclusion: boolean;
  allocation_method: string;
  status: string;
};

type Component = {
  id: string;
  procurement_batch_id: string;
  cost_category_id: string;
  amount: number;
  supplier_id: string | null;
  reference_number: string | null;
  description: string | null;
  approval_status: string;
  created_at: string;
};

type Batch = { id: string; batch_number: string };
type Supplier = { id: string; name: string };

const TABS = ["components", "categories"] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function humanise(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProcurementCostsPage({
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

  const [{ data: canView }, { data: canManage }] = await Promise.all([
    supabase.rpc("has_permission", { p_permission_key: "procurement.view" }),
    supabase.rpc("has_permission", { p_permission_key: "procurement.manage" }),
  ]);

  if (!canView && !canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Procurement costs"
          title="Not authorised"
          description="You cannot view procurement costs."
        />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;
  const tab = TABS.includes((params.tab ?? "") as (typeof TABS)[number]) ? (params.tab as string) : "components";

  const [categoriesResult, componentsResult, batchesResult, suppliersResult] = await Promise.all([
    supabase
      .from("cost_categories")
      .select("id, category_name, category_type, landed_cost_inclusion, allocation_method, status")
      .order("category_name"),
    supabase
      .from("procurement_cost_components")
      .select(
        "id, procurement_batch_id, cost_category_id, amount, supplier_id, reference_number, description, approval_status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("procurement_batches").select("id, batch_number").order("created_at", { ascending: false }).limit(40),
    supabase.from("suppliers").select("id, name").order("name"),
  ]);

  const queryError =
    categoriesResult.error ?? componentsResult.error ?? batchesResult.error ?? suppliersResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Procurement costs" title="Unavailable" description="Cost data could not be loaded." />
      </div>
    );
  }

  const categories = (categoriesResult.data ?? []) as Category[];
  const components = (componentsResult.data ?? []) as Component[];
  const batches = (batchesResult.data ?? []) as Batch[];
  const suppliers = (suppliersResult.data ?? []) as Supplier[];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    label: category.category_name,
  }));

  const batchOptions = batches.map((batch) => ({
    id: batch.id,
    label: batch.batch_number,
  }));

  const supplierOptions = suppliers.map((supplier) => ({
    id: supplier.id,
    label: supplier.name,
  }));

  const totalRecorded = components.reduce((sum, component) => sum + Number(component.amount), 0);
  const landedRecorded = components.reduce((sum, component) => {
    const category = categoryById.get(component.cost_category_id);
    return category?.landed_cost_inclusion ? sum + Number(component.amount) : sum;
  }, 0);
  const landedCategories = categories.filter((category) => category.landed_cost_inclusion).length;

  const tabs = [
    { href: "/workspace/procurement/costs?tab=components", label: "Cost components", count: components.length },
    { href: "/workspace/procurement/costs?tab=categories", label: "Cost categories", count: categories.length },
  ];
  const activeHref = `/workspace/procurement/costs?tab=${tab}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Procurement costs"
        title={tenant.organisationName}
        description="Cost categories and append-only cost components per procurement batch. Allocation and approval remain pending decisions."
        actions={
          <>
            <ButtonLink href="/workspace/procurement">Procurement</ButtonLink>
            <ButtonLink href="/workspace/inventory">Inventory</ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cost components" value={components.length} hint="Latest 50" tone="brand" />
        <StatCard label="Recorded amount" value={formatMoney(totalRecorded)} hint="Append-only evidence" />
        <StatCard
          label="Landed cost"
          value={formatMoney(landedRecorded)}
          hint={
            categories.length === 0
              ? "No categories configured"
              : `${landedCategories} of ${categories.length} categories include`
          }
        />
        <StatCard
          label="Cost categories"
          value={categories.length}
          hint={`${landedCategories} landed cost categor${landedCategories === 1 ? "y" : "ies"}`}
        />
      </div>

      <Tabs items={tabs} active={activeHref} />

      {tab === "components" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Cost components"
              description="Recorded against a procurement batch. Approval status starts as pending and nothing is allocated yet."
            />
            <CardBody>
              {components.length === 0 ? (
                <EmptyState title="No cost components" description="Record the first batch cost below." />
              ) : (
                <TableScroll>
                  <Table minWidth={1000}>
                    <THead>
                      <TR>
                        <TH>Batch</TH>
                        <TH>Category</TH>
                        <TH>Supplier</TH>
                        <TH>Reference</TH>
                        <TH align="right">Amount</TH>
                        <TH>Approval</TH>
                        <TH>Recorded</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {components.map((component) => {
                        const category = categoryById.get(component.cost_category_id);

                        return (
                          <TR key={component.id}>
                            <TD className="font-medium">
                              {batchById.get(component.procurement_batch_id)?.batch_number ?? "—"}
                            </TD>
                            <TD>
                              {category?.category_name ?? "—"}
                              <span className="block text-xs text-[var(--muted)]">
                                {component.description ?? humanise(category?.category_type ?? "")}
                              </span>
                            </TD>
                            <TD className="text-xs">
                              {component.supplier_id
                                ? supplierById.get(component.supplier_id)?.name ?? "—"
                                : <span className="text-[var(--muted)]">—</span>}
                            </TD>
                            <TD className="text-xs text-[var(--muted)]">{component.reference_number ?? "—"}</TD>
                            <TD align="right">{formatMoney(Number(component.amount))}</TD>
                            <TD>
                              <StatusBadge status={component.approval_status} />
                            </TD>
                            <TD className="text-xs text-[var(--muted)]">
                              {new Date(component.created_at).toLocaleDateString("en-GB")}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                    <TFoot>
                      <TR>
                        <TD>Total</TD>
                        <TD className="text-xs text-[var(--muted)]">
                          {components.length} component{components.length === 1 ? "" : "s"}
                        </TD>
                        <TD />
                        <TD />
                        <TD align="right">{formatMoney(totalRecorded)}</TD>
                        <TD />
                        <TD />
                      </TR>
                    </TFoot>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader
                title="Record a cost component"
                description="Only categories configured as landed cost roll into batch landed cost."
              />
              <CardBody>
                {batches.length === 0 ? (
                  <EmptyState title="No procurement batch" description="Record a batch before adding costs." />
                ) : categories.length === 0 ? (
                  <EmptyState title="No cost category" description="Create a category on the categories tab first." />
                ) : (
                  <CostComponentForm
                    batches={batchOptions}
                    categories={categoryOptions}
                    suppliers={supplierOptions}
                  />
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "categories" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Cost categories"
              description="Inbound costs belong here only when the category is configured as landed cost."
            />
            <CardBody>
              {categories.length === 0 ? (
                <EmptyState title="No cost categories" description="Create the first category below." />
              ) : (
                <TableScroll>
                  <Table minWidth={820}>
                    <THead>
                      <TR>
                        <TH>Category</TH>
                        <TH>Type</TH>
                        <TH>Allocation</TH>
                        <TH>Landed cost</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {categories.map((category) => (
                        <TR key={category.id}>
                          <TD className="font-medium">{category.category_name}</TD>
                          <TD className="text-xs capitalize">{humanise(category.category_type)}</TD>
                          <TD className="text-xs capitalize">{humanise(category.allocation_method)}</TD>
                          <TD>
                            <Badge tone={category.landed_cost_inclusion ? "accent" : "neutral"}>
                              {category.landed_cost_inclusion ? "Included" : "Excluded"}
                            </Badge>
                          </TD>
                          <TD>
                            <StatusBadge status={category.status} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              )}
            </CardBody>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader
                title="Create cost category"
                description="Allocation method is recorded for now; no allocation is applied in this release."
              />
              <CardBody>
                <CostCategoryForm />
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs leading-6 text-[var(--muted)]">
        Inbound procurement costs belong here only when the category is configured as landed cost. Outbound customer
        delivery haulage must be recorded separately. No allocation is applied in this release.
      </p>
    </div>
  );
}
