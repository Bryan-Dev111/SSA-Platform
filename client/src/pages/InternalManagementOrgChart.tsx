/**
 * Org chart variants:
 * - Supplier Assurance: viewer at top → quality managers → quality engineers (QM↔QE assignments).
 * - Global Supply: viewer at top (e.g. leadership) → sourcing directors → employees/contractors assigned to each director.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';

export type InternalManagementOrgChartVariant = 'supplierAssurance' | 'globalSupply';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  roleNames: string[];
  isEmployee?: boolean;
  isContractor?: boolean;
  country?: string | null;
  hourlyRate?: number | null;
  currency?: string | null;
  employmentResponsibilities?: string | null;
  employmentNotes?: string | null;
  qmAssignedQeIds?: string[];
  sourcingDirectorAssignedStaffIds?: string[];
}

function displayName(u: Pick<UserRow, 'name' | 'email'>): string {
  const n = u.name?.trim();
  return n || u.email;
}

function comparePeople(a: UserRow, b: UserRow): number {
  return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
}

export function InternalManagementOrgChart({
  token,
  viewerDisplayName,
  variant = 'supplierAssurance',
  employeeProfilePathPrefix = '/internal-management/employee-profile',
}: {
  token: string | null;
  viewerDisplayName: string;
  variant?: InternalManagementOrgChartVariant;
  employeeProfilePathPrefix?: string;
}) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setUsers(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    apiJson<UserRow[]>('/management-directory', { token })
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setUsers(null);
          setLoadError(parseApiError(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const byId = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of users ?? []) m.set(u.id, u);
    return m;
  }, [users]);

  const qualityManagers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => u.roleNames.includes('QualityManager')).sort(comparePeople);
  }, [users]);

  const sourcingDirectors = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => u.roleNames.includes('SourcingDirector')).sort(comparePeople);
  }, [users]);

  const loading = Boolean(token) && users === null && !loadError;

  const isGlobalSupply = variant === 'globalSupply';

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Organization Chart</h2>

        {loadError ? <div className="alert-error">{loadError}</div> : null}

        <div className="org-chart-root">
          <div className="org-chart-node org-chart-node--root">
            <span className="org-chart-root-name">{viewerDisplayName}</span>
            <span className="org-chart-root-sub">You</span>
          </div>
          <div className="org-chart-connector org-chart-connector--down" aria-hidden />

          {loading ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading team…</p>
          ) : null}

          {!loading &&
          !loadError &&
          users &&
          !isGlobalSupply &&
          qualityManagers.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              No quality managers yet. Assign the Quality Manager role in Admin → Users.
            </p>
          ) : null}

          {!loading && !loadError && users && isGlobalSupply && sourcingDirectors.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              No sourcing directors yet. Add the Sourcing Director role to a user, then assign staff in Management
              Assignments.
            </p>
          ) : null}

          {!loading && !loadError && !isGlobalSupply && qualityManagers.length > 0 ? (
            <div className="org-chart-branches org-chart-branches--people">
              {qualityManagers.map((qm) => {
                const qeIds = qm.qmAssignedQeIds ?? [];
                const engineers = qeIds
                  .map((id) => byId.get(id))
                  .filter((u): u is UserRow => Boolean(u && u.roleNames.includes('QualityEngineer')))
                  .sort(comparePeople);

                return (
                  <div key={qm.id} className="org-chart-branch org-chart-branch--qm">
                    <div className="org-chart-role-pill">Quality manager</div>
                    <div className="org-chart-node org-chart-node--qm">
                      <Link className="org-chart-person-name" to={`${employeeProfilePathPrefix}/${qm.id}`}>
                        {displayName(qm)}
                      </Link>
                    </div>
                    <div className="org-chart-connector org-chart-connector--down org-chart-connector--narrow" aria-hidden />
                    <div className="org-chart-qe-block">
                      <div className="org-chart-qe-heading">Quality Engineers</div>
                      {engineers.length === 0 ? (
                        <p className="org-chart-qe-empty">No quality engineers assigned.</p>
                      ) : (
                        <ul className="org-chart-qe-list">
                          {engineers.map((qe) => (
                            <li key={qe.id}>
                              <div className="org-chart-node org-chart-node--qe">
                                <Link className="org-chart-person-name" to={`${employeeProfilePathPrefix}/${qe.id}`}>
                                  {displayName(qe)}
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!loading && !loadError && isGlobalSupply && sourcingDirectors.length > 0 ? (
            <div className="org-chart-branches org-chart-branches--people">
              {sourcingDirectors.map((sd) => {
                const staffIds = sd.sourcingDirectorAssignedStaffIds ?? [];
                const staffMembers = staffIds
                  .map((id) => byId.get(id))
                  .filter((u): u is UserRow => Boolean(u))
                  .sort(comparePeople);

                return (
                  <div key={sd.id} className="org-chart-branch org-chart-branch--qm">
                    <div className="org-chart-node org-chart-node--qm">
                      <Link className="org-chart-person-name" to={`${employeeProfilePathPrefix}/${sd.id}`}>
                        {displayName(sd)}
                      </Link>
                    </div>
                    <div className="org-chart-connector org-chart-connector--down org-chart-connector--narrow" aria-hidden />
                    <div className="org-chart-qe-block">
                      <div className="org-chart-qe-heading">Assigned team</div>
                      {staffMembers.length === 0 ? (
                        <p className="org-chart-qe-empty">No employees or contractors assigned.</p>
                      ) : (
                        <ul className="org-chart-qe-list">
                          {staffMembers.map((member) => (
                            <li key={member.id}>
                              <div className="org-chart-node org-chart-node--qe">
                                <Link className="org-chart-person-name" to={`${employeeProfilePathPrefix}/${member.id}`}>
                                  {displayName(member)}
                                </Link>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
