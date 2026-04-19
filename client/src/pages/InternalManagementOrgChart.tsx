/**
 * Visual map of Internal Management areas; buttons switch to the matching tab or navigate to standalone pages.
 */
import { Link } from 'react-router-dom';
import type { InternalManagementTab } from './internalManagementTabs';

type OrgLeaf =
  | { label: string; tab: InternalManagementTab }
  | { label: string; href: string };

type OrgGroup = {
  title: string;
  subtitle?: string;
  items: OrgLeaf[];
};

const GROUPS: OrgGroup[] = [
  {
    title: 'Planning & field',
    subtitle: 'Audits and shipment schedule',
    items: [
      { label: 'Audits', tab: 'audits' },
      { label: 'Shipments', tab: 'shipments' },
    ],
  },
  {
    title: 'Commercial & records',
    subtitle: 'Contracts and internal documents',
    items: [
      { label: 'Contracts', tab: 'contracts' },
      { label: 'Documents', tab: 'documents' },
    ],
  },
  {
    title: 'Projects & performance',
    subtitle: 'History, assignments, profit',
    items: [
      { label: 'Project History', tab: 'projectHistory' },
      { label: 'Management Assignments', tab: 'managementAssignments' },
      { label: 'Profit', tab: 'profit' },
    ],
  },
  {
    title: 'Workforce',
    subtitle: 'Assignments, logs, labor costs',
    items: [
      { label: 'Employee Assignments', tab: 'employeeAssignments' },
      { label: 'Work Logs', href: '/work-logs' },
      { label: 'Labor Costs', tab: 'laborCosts' },
    ],
  },
];

function leafKey(item: OrgLeaf) {
  return 'href' in item ? item.href : item.tab;
}

export function InternalManagementOrgChart({ onGoToTab }: { onGoToTab: (tab: InternalManagementTab) => void }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>Organization chart</h2>
        <p style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Overview of Internal Management areas. Select a box to open that tab or page.
        </p>

        <div className="org-chart-root">
          <div className="org-chart-node org-chart-node--root">Internal Management</div>
          <div className="org-chart-connector org-chart-connector--down" aria-hidden />
          <div className="org-chart-branches">
            {GROUPS.map((g) => (
              <div key={g.title} className="org-chart-branch">
                <div className="org-chart-branch-title">{g.title}</div>
                {g.subtitle ? (
                  <div className="org-chart-branch-sub">{g.subtitle}</div>
                ) : null}
                <ul className="org-chart-branch-list">
                  {g.items.map((item) => (
                    <li key={leafKey(item)}>
                      {'href' in item ? (
                        <Link to={item.href} className="org-chart-leaf btn btn-ghost">
                          {item.label}
                        </Link>
                      ) : (
                        <button type="button" className="org-chart-leaf btn btn-ghost" onClick={() => onGoToTab(item.tab)}>
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
