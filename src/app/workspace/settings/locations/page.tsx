import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusToggle } from "@/components/ui/status-toggle";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";
import { LocationForm } from "./location-forms";
import { setLocationStatus } from "./actions";

export const dynamic = "force-dynamic";

type Location = {
  id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  is_storage_location: boolean;
  address: string | null;
  contact_person: string | null;
  phone: string | null;
  status: string;
};

const TYPE_LABELS: Record<string, string> = {
  storage: "Storage depot",
  transit: "Transit point",
  depot: "Depot",
  station: "Station",
  office: "Office",
  other: "Other",
};

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  if (!getSupabaseConfig()) {
    redirect("/workspace");
  }

  const { supabase, user, tenant, can } = await getWorkspaceContext();

  if (!user) {
    redirect("/login");
  }

  if (!tenant) {
    redirect("/workspace");
  }

  if (!can("locations.manage")) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Settings" title="Not authorised" description="You cannot manage business locations." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const params = await searchParams;

  const [locationsResult, batchesResult, tripsResult, grantsResult] = await Promise.all([
    supabase
      .from("business_locations")
      .select(
        "id, location_code, location_name, location_type, is_storage_location, address, contact_person, phone, status",
      )
      .order("location_name"),
    supabase.from("inventory_batches").select("location_id"),
    supabase.from("trips").select("origin_location_id, destination_location_id"),
    supabase.from("user_location_access").select("location_id"),
  ]);

  const queryError =
    locationsResult.error ?? batchesResult.error ?? tripsResult.error ?? grantsResult.error;

  if (queryError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Settings" title="Unavailable" description="Locations could not be loaded." />
        <ButtonLink href="/workspace/settings">Back to settings</ButtonLink>
      </div>
    );
  }

  const locations = (locationsResult.data ?? []) as Location[];
  const batchCount = new Map<string, number>();
  const tripCount = new Map<string, number>();
  const grantCount = new Map<string, number>();

  for (const batch of (batchesResult.data ?? []) as { location_id: string | null }[]) {
    if (batch.location_id) {
      batchCount.set(batch.location_id, (batchCount.get(batch.location_id) ?? 0) + 1);
    }
  }

  for (const trip of (tripsResult.data ?? []) as {
    origin_location_id: string | null;
    destination_location_id: string | null;
  }[]) {
    for (const locationId of [trip.origin_location_id, trip.destination_location_id]) {
      if (locationId) {
        tripCount.set(locationId, (tripCount.get(locationId) ?? 0) + 1);
      }
    }
  }

  for (const grant of (grantsResult.data ?? []) as { location_id: string }[]) {
    grantCount.set(grant.location_id, (grantCount.get(grant.location_id) ?? 0) + 1);
  }

  const editingLocation = params.edit
    ? locations.find((location) => location.id === params.edit) ?? null
    : null;
  const editMissing = Boolean(params.edit) && !editingLocation;

  const activeLocations = locations.filter((location) => location.status === "active").length;
  const storageLocations = locations.filter((location) => location.is_storage_location).length;
  const locationsInUse = locations.filter((location) => {
    const trips = tripCount.get(location.id) ?? 0;
    const batches = batchCount.get(location.id) ?? 0;
    const grants = grantCount.get(location.id) ?? 0;
    return trips + batches + grants > 0;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings · Locations"
        title="Business locations"
        description="Depots, stations and transit points used by procurement, inventory, dispatch and access. Deactivate rather than delete: history stays attached."
        actions={<ButtonLink href="/workspace/settings">Back to settings</ButtonLink>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Locations" value={locations.length} hint={`${activeLocations} active`} tone="brand" />
        <StatCard label="Storage locations" value={storageLocations} hint="Can receive product" />
        <StatCard label="Referenced" value={locationsInUse} hint="Batches, trips or access grants" />
        <StatCard
          label="Inactive"
          value={locations.length - activeLocations}
          hint="Kept for history"
        />
      </div>

      {editMissing ? (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          That location could not be found. It may have been removed.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Locations"
          description="Code must be unique for this company. A referenced location can only be deactivated."
        />
        <CardBody>
          {locations.length === 0 ? (
            <EmptyState title="No locations yet" description="Add the first depot, station or transit point below." />
          ) : (
            <TableScroll>
              <Table minWidth={980}>
                <THead>
                  <TR>
                    <TH>Code</TH>
                    <TH>Name</TH>
                    <TH>Type</TH>
                    <TH>Storage</TH>
                    <TH>Usage</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {locations.map((location) => {
                    const batches = batchCount.get(location.id) ?? 0;
                    const trips = tripCount.get(location.id) ?? 0;
                    const grants = grantCount.get(location.id) ?? 0;

                    return (
                      <TR
                        key={location.id}
                        className={editingLocation?.id === location.id ? "bg-[var(--brand-soft)]/40" : ""}
                      >
                        <TD className="font-medium">{location.location_code}</TD>
                        <TD>
                          {location.location_name}
                          {location.address ? (
                            <span className="block text-xs text-[var(--muted)]">{location.address}</span>
                          ) : null}
                        </TD>
                        <TD className="text-xs text-[var(--muted)]">
                          {TYPE_LABELS[location.location_type] ?? location.location_type}
                        </TD>
                        <TD className="text-xs">{location.is_storage_location ? "Yes" : "No"}</TD>
                        <TD className="text-xs text-[var(--muted)]">
                          {batches} batch{batches === 1 ? "" : "es"} · {trips} trip{trips === 1 ? "" : "s"} · {grants}{" "}
                          grant{grants === 1 ? "" : "s"}
                        </TD>
                        <TD>
                          <StatusBadge status={location.status} />
                        </TD>
                        <TD>
                          <div className="flex flex-wrap items-center gap-2">
                            <ButtonLink
                              href={`/workspace/settings/locations?edit=${location.id}`}
                              size="sm"
                              variant="ghost"
                            >
                              Edit
                            </ButtonLink>
                            <StatusToggle
                              action={setLocationStatus}
                              id={location.id}
                              name={location.location_name}
                              active={location.status === "active"}
                            />
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={editingLocation ? "Edit location" : "Add location"}
          description={
            editingLocation
              ? "Changes apply to future documents. Existing batches, trips and grants keep the location."
              : "Storage locations can receive product; transit points and offices cannot."
          }
        />
        <CardBody>
          <LocationForm key={editingLocation?.id ?? "new"} location={editingLocation ?? undefined} />
          {editingLocation ? (
            <div className="mt-3">
              <ButtonLink href="/workspace/settings/locations" size="sm">
                Cancel edit
              </ButtonLink>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
