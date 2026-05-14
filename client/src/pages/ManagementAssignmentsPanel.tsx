/**
 * QM ↔ QE matrix and supplier active projects (same data as Internal Management → Management Assignments).
 * Global Supply Internal Management can also show Sourcing Director ↔ employee/contractor assignments.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiJson } from '../api/client';
import { parseApiError } from '../utils/apiHelpers';

interface ManagementAssignmentRow {
  id: string;
  projectCode: string;
  buyerName: string;
  supplierName: string;
  qualityEngineers: string[];
  qualityManagers: string[];
}

interface ManagementUserRow {
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

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export function ManagementAssignmentsPanel({
  token,
  toast,
  showSourcingDirectorStaff = false,
}: {
  token: string | null;
  toast: ToastApi;
  /** When true (e.g. Global Supply Internal Management), show Sourcing Director ↔ staff assignments. */
  showSourcingDirectorStaff?: boolean;
}) {
  const { t } = useLanguage();
  const [managementAssignments, setManagementAssignments] = useState<ManagementAssignmentRow[]>([]);
  const [managementUsers, setManagementUsers] = useState<ManagementUserRow[]>([]);
  const [selectedQmId, setSelectedQmId] = useState('');
  const [selectedQeId, setSelectedQeId] = useState('');
  const [managementAssignBusy, setManagementAssignBusy] = useState(false);
  const [selectedSdId, setSelectedSdId] = useState('');
  const [selectedStaffUserId, setSelectedStaffUserId] = useState('');
  const [sdAssignBusy, setSdAssignBusy] = useState(false);

  const loadManagementAssignments = useCallback(() => {
    if (!token) return;
    apiJson<ManagementAssignmentRow[]>('/project-history/management-assignments', { token })
      .then(setManagementAssignments)
      .catch(() => setManagementAssignments([]));
  }, [token]);

  const loadManagementUsers = useCallback(() => {
    if (!token) return;
    apiJson<ManagementUserRow[]>('/management-directory', { token })
      .then(setManagementUsers)
      .catch(() => setManagementUsers([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadManagementAssignments();
    loadManagementUsers();
  }, [token, loadManagementAssignments, loadManagementUsers]);

  const managementQualityManagers = useMemo(
    () => managementUsers.filter((u) => u.roleNames.includes('QualityManager')),
    [managementUsers]
  );

  const managementQualityEngineers = useMemo(
    () => managementUsers.filter((u) => u.roleNames.includes('QualityEngineer')),
    [managementUsers]
  );

  const sourcingDirectors = useMemo(
    () => managementUsers.filter((u) => u.roleNames.includes('SourcingDirector')),
    [managementUsers]
  );

  const staffForSourcingDirectorPick = useMemo(
    () =>
      managementUsers.filter(
        (u) => Boolean(u.isEmployee) || Boolean(u.isContractor)
      ),
    [managementUsers]
  );

  const assignSdStaff = async () => {
    if (!token || !selectedSdId || !selectedStaffUserId) return;
    setSdAssignBusy(true);
    try {
      await apiJson('/sourcing-director-staff', {
        token,
        method: 'POST',
        body: JSON.stringify({
          sourcingDirectorId: selectedSdId,
          staffUserId: selectedStaffUserId,
        }),
      });
      toast.success(t('toast.staffAssignedSourcingDirector'));
      setSelectedStaffUserId('');
      loadManagementUsers();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSdAssignBusy(false);
    }
  };

  const removeSdStaff = async (sourcingDirectorId: string, staffUserId: string) => {
    if (!token) return;
    setSdAssignBusy(true);
    try {
      await apiJson(`/sourcing-director-staff/${sourcingDirectorId}/${staffUserId}`, {
        token,
        method: 'DELETE',
      });
      toast.info(t('toast.staffAssignmentRemoved'));
      loadManagementUsers();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setSdAssignBusy(false);
    }
  };

  const assignQmToQe = async () => {
    if (!token || !selectedQmId || !selectedQeId) return;
    setManagementAssignBusy(true);
    try {
      await apiJson('/qm-qes', {
        token,
        method: 'POST',
        body: JSON.stringify({
          qualityManagerId: selectedQmId,
          qualityEngineerId: selectedQeId,
        }),
      });
      toast.success(t('toast.qmAssignedToQe'));
      setSelectedQeId('');
      loadManagementUsers();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setManagementAssignBusy(false);
    }
  };

  const removeQmToQe = async (qualityManagerId: string, qualityEngineerId: string) => {
    if (!token) return;
    setManagementAssignBusy(true);
    try {
      await apiJson(`/qm-qes/${qualityManagerId}/${qualityEngineerId}`, {
        token,
        method: 'DELETE',
      });
      toast.info(t('toast.qmQeAssignmentRemoved'));
      loadManagementUsers();
    } catch (e) {
      toast.error(parseApiError(e));
    } finally {
      setManagementAssignBusy(false);
    }
  };

  return (
    <>
      {showSourcingDirectorStaff ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{t('management.section.sdStaff')}</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('management.label.sourcingDirector')}</label>
                <select
                  className="input"
                  value={selectedSdId}
                  onChange={(e) => setSelectedSdId(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  <option value="">{t('management.placeholder.selectSd')}</option>
                  {sourcingDirectors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name?.trim() ? `${d.name} (${d.email})` : d.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">{t('management.label.employeeContractor')}</label>
                <select
                  className="input"
                  value={selectedStaffUserId}
                  onChange={(e) => setSelectedStaffUserId(e.target.value)}
                  style={{ minWidth: 260 }}
                >
                  <option value="">{t('management.placeholder.selectStaff')}</option>
                  {staffForSourcingDirectorPick.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name?.trim() ? `${u.name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void assignSdStaff()}
                disabled={sdAssignBusy || !selectedSdId || !selectedStaffUserId}
              >
                {t('management.btn.assign')}
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('management.col.sourcingDirector')}</th>
                    <th>{t('management.col.assignedStaff')}</th>
                    <th style={{ width: 100 }}>{t('table.col.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcingDirectors.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="table-empty">
                        {t('management.empty.noSourcingDirectors')}
                      </td>
                    </tr>
                  ) : (
                    sourcingDirectors.flatMap((d) => {
                      const staffIds = d.sourcingDirectorAssignedStaffIds ?? [];
                      if (staffIds.length === 0) {
                        return (
                          <tr key={d.id}>
                            <td>{d.name?.trim() ? d.name : d.email}</td>
                            <td colSpan={2} className="table-empty">
                              {t('common.none')}
                            </td>
                          </tr>
                        );
                      }
                      return staffIds.map((sid) => {
                        const staff = managementUsers.find((x) => x.id === sid);
                        return (
                          <tr key={`${d.id}-${sid}`}>
                            <td>{d.name?.trim() ? d.name : d.email}</td>
                            <td>{staff?.name?.trim() ? `${staff.name} (${staff.email})` : staff?.email ?? sid}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => void removeSdStaff(d.id, sid)}
                                disabled={sdAssignBusy}
                              >
                                {t('management.btn.remove')}
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!showSourcingDirectorStaff ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{t('management.section.qmToQe')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('management.label.qualityManager')}</label>
              <select
                className="input"
                value={selectedQmId}
                onChange={(e) => setSelectedQmId(e.target.value)}
                style={{ minWidth: 260 }}
              >
                <option value="">{t('management.placeholder.selectQm')}</option>
                {managementQualityManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name?.trim() ? `${m.name} (${m.email})` : m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">{t('management.label.qualityEngineer')}</label>
              <select
                className="input"
                value={selectedQeId}
                onChange={(e) => setSelectedQeId(e.target.value)}
                style={{ minWidth: 260 }}
              >
                <option value="">{t('management.placeholder.selectQe')}</option>
                {managementQualityEngineers.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name?.trim() ? `${q.name} (${q.email})` : q.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void assignQmToQe()}
              disabled={managementAssignBusy || !selectedQmId || !selectedQeId}
            >
              {t('management.btn.assign')}
            </button>
          </div>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('management.col.qualityManager')}</th>
                  <th>{t('management.col.assignedQEs')}</th>
                  <th style={{ width: 100 }}>{t('table.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {managementQualityManagers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      {t('management.empty.noQualityManagers')}
                    </td>
                  </tr>
                ) : (
                  managementQualityManagers.flatMap((m) => {
                    const qeIds = m.qmAssignedQeIds ?? [];
                    if (qeIds.length === 0) {
                      return (
                        <tr key={m.id}>
                          <td>{m.name?.trim() ? m.name : m.email}</td>
                          <td colSpan={2} className="table-empty">
                            {t('common.none')}
                          </td>
                        </tr>
                      );
                    }
                    return qeIds.map((qid) => {
                      const qe = managementQualityEngineers.find((x) => x.id === qid);
                      return (
                        <tr key={`${m.id}-${qid}`}>
                          <td>{m.name?.trim() ? m.name : m.email}</td>
                          <td>{qe?.name?.trim() ? `${qe.name} (${qe.email})` : qe?.email ?? qid}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => void removeQmToQe(m.id, qid)}
                              disabled={managementAssignBusy}
                            >
                              {t('management.btn.remove')}
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      ) : null}

      {!showSourcingDirectorStaff ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <h2 style={{ marginTop: 0 }}>{t('management.section.projects')}</h2>
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            {managementAssignments.length === 0 ? (
              <p className="table-empty">{t('management.empty.noActiveProjects')}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('management.col.project')}</th>
                    <th>{t('management.col.buyer')}</th>
                    <th>{t('management.col.supplier')}</th>
                    <th>{t('management.col.qualityEngineer')}</th>
                    <th>{t('management.col.qualityManager')}</th>
                  </tr>
                </thead>
                <tbody>
                  {managementAssignments.map((row) => (
                    <tr key={row.id}>
                      <td>{row.projectCode}</td>
                      <td>{row.buyerName || t('internal.scheduleAudit.dash')}</td>
                      <td>{row.supplierName || t('internal.scheduleAudit.dash')}</td>
                      <td>
                        {row.qualityEngineers.length > 0
                          ? row.qualityEngineers.join(', ')
                          : t('internal.scheduleAudit.dash')}
                      </td>
                      <td>
                        {row.qualityManagers.length > 0
                          ? row.qualityManagers.join(', ')
                          : t('internal.scheduleAudit.dash')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        </div>
      ) : null}
    </>
  );
}
