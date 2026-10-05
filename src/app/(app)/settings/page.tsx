import { Building2, ShieldCheck, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/queries/settings";
import { listTeam } from "@/lib/queries/team";
import { formatDate, initials } from "@/lib/utils";
import { PasswordForm, ProfileForm } from "./account-forms";
import { BusinessForm } from "./business-form";
import { AddUserForm, MemberControls } from "./team";

export const metadata = { title: "Settings" };

function SectionTitle({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      {children}
    </span>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const canManageSettings = can(user.role, "settings:manage");
  const canManageTeam = can(user.role, "team:manage");
  const [settings, team] = await Promise.all([
    getSettings(),
    canManageTeam ? listTeam() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your business profile, your account and your team." />

      <Card id="business">
        <CardHeader
          title={<SectionTitle icon={Building2}>Business profile</SectionTitle>}
          description="Shown on invoices and used as defaults across the app."
          action={!canManageSettings && <Badge>Read only</Badge>}
        />
        <CardBody>
          <BusinessForm settings={settings} readOnly={!canManageSettings} />
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="account">
          <CardHeader
            title={<SectionTitle icon={UserRound}>My account</SectionTitle>}
            description={
              <>
                Signed in as <span className="capitalize">{user.role}</span>
              </>
            }
          />
          <CardBody>
            <ProfileForm key={user.name} name={user.name} email={user.email} />
          </CardBody>
        </Card>
        <Card id="password">
          <CardHeader
            title={<SectionTitle icon={ShieldCheck}>Change password</SectionTitle>}
            description="Your current password is required."
          />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
      </div>

      {canManageTeam && (
        <Card id="team">
          <CardHeader
            title={<SectionTitle icon={Users}>Team</SectionTitle>}
            description={`${team.length} ${team.length === 1 ? "member" : "members"} · there must always be at least one admin`}
          />
          <Table>
            <THead>
              <tr>
                <TH>Member</TH>
                <TH className="hidden md:table-cell">Joined</TH>
                <TH className="text-right">Role</TH>
              </tr>
            </THead>
            <TBody>
              {team.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {m.name}
                          {m.id === user.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                    {formatDate(m.createdAt)}
                  </TD>
                  <TD className="text-right">
                    <MemberControls userId={m.id} role={m.role} isSelf={m.id === user.id} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="border-t p-5">
            <h3 className="mb-4 text-sm font-semibold">Add a team member</h3>
            <AddUserForm />
          </div>
        </Card>
      )}
    </div>
  );
}
