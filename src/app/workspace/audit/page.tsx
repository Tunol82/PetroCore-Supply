import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/shared/lib/supabase/config";
import { getWorkspaceContext } from "@/modules/tenant/workspace-context";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR, TableScroll } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type AuditEvent = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_id: string | null;
  created_at: string;
};

function actionLabel(action: string) {
  return action
    .replaceAll(".", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function AuditPage() {
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

  if (!can("audit.view")) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Audit" title="Not authorised" description="You cannot view the audit trail." />
        <ButtonLink href="/workspace">Return to workspace</ButtonLink>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Audit" title="Unavailable" description="The audit trail could not be loaded." />
      </div>
    );
  }

  const events = (data ?? []) as AuditEvent[];
  const actorIds = Array.from(
    new Set(events.map((event) => event.user_id).filter((value): value is string => Boolean(value))),
  );

  const actorsResult =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
      : { data: [], error: null };

  const actors = (actorsResult.data ?? []) as { id: string; full_name: string | null; email: string }[];
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="Newest 100 events. Read-only: audit records are append-only and cannot be edited."
      />

      <Card>
        <CardHeader title="Recent activity" description="Access, configuration and operational changes recorded for this company." />
        <CardBody>
          {events.length === 0 ? (
            <EmptyState title="No audit events yet" description="Changes will appear here as they are recorded." />
          ) : (
            <TableScroll>
              <Table minWidth={880}>
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Action</TH>
                    <TH>Entity</TH>
                    <TH>Actor</TH>
                  </TR>
                </THead>
                <TBody>
                  {events.map((event) => {
                    const actor = event.user_id ? actorById.get(event.user_id) : undefined;

                    return (
                      <TR key={event.id}>
                        <TD className="whitespace-nowrap text-xs text-[var(--muted)]">
                          {new Date(event.created_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
                        </TD>
                        <TD className="text-xs font-medium">{actionLabel(event.action)}</TD>
                        <TD className="text-xs">
                          {event.entity_type}
                          {event.entity_id ? (
                            <span className="block text-[var(--muted)]">{event.entity_id.slice(0, 8)}…</span>
                          ) : null}
                        </TD>
                        <TD className="text-xs">
                          {actor ? (
                            <>
                              {actor.full_name ?? actor.email}
                              <span className="block text-[var(--muted)]">{actor.email}</span>
                            </>
                          ) : (
                            "System"
                          )}
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
    </div>
  );
}
