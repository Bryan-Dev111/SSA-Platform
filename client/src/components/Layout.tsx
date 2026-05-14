/**
 * App layout: sidebar (role-based menu), header, outlet.
 * Mobile: sidebar becomes overlay drawer; hamburger toggles menu.
 * Desktop: sidebar width is resizable; can collapse to icon rail (tooltips on hover).
 */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { TOptions } from 'i18next';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ConfirmDialog } from './ConfirmDialog';
import { SidebarNavIcon } from './SidebarNavIcons';
import { LanguageFlagSelector } from './LanguageFlagSelector';
import { canAccessPath, getDefaultPath } from '../config/rolePageAccess';

const STORAGE_SIDEBAR_COLLAPSED = 'sentinel.sidebarCollapsed';
const STORAGE_SIDEBAR_WIDTH = 'sentinel.sidebarWidthPx';

const SIDEBAR_WIDTH_DEFAULT = 268;
const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_MAX = 420;
const SIDEBAR_RAIL_WIDTH = 72;

function readCollapsedFromStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_SIDEBAR_COLLAPSED) === '1';
  } catch {
    return false;
  }
}

function readWidthFromStorage(): number {
  try {
    if (typeof localStorage === 'undefined') return SIDEBAR_WIDTH_DEFAULT;
    const raw = localStorage.getItem(STORAGE_SIDEBAR_WIDTH);
    if (!raw) return SIDEBAR_WIDTH_DEFAULT;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return SIDEBAR_WIDTH_DEFAULT;
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, n));
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

function desktopMatches(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 769px)').matches;
}

const MENU_ITEMS: { path: string; labelKey: string; fallback: string }[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', fallback: 'Dashboard' },
  { path: '/risk', labelKey: 'nav.risk', fallback: 'Risk' },
  { path: '/corrective-actions', labelKey: 'nav.correctiveActions', fallback: 'Corrective Actions' },
  { path: '/findings', labelKey: 'nav.findings', fallback: 'Findings' },
  { path: '/audits', labelKey: 'nav.audits', fallback: 'Audits' },
  { path: '/shipments', labelKey: 'nav.shipments', fallback: 'Shipments' },
  { path: '/records', labelKey: 'nav.records', fallback: 'Records' },
  { path: '/supplier-profile', labelKey: 'nav.supplierProfile', fallback: 'Supplier Profile' },
  { path: '/supplier-list', labelKey: 'nav.approvedSupplierList', fallback: 'Approved Suppliers List' },
  { path: '/suppliers-map', labelKey: 'nav.suppliersMap', fallback: 'Suppliers Map' },
  { path: '/documents', labelKey: 'nav.commandMedia', fallback: 'Command Media' },
  { path: '/work-logs', labelKey: 'nav.workLogs', fallback: 'Work Logs' },
  { path: '/internal-management', labelKey: 'nav.internalManagement', fallback: 'Internal Management' },
  { path: '/admin', labelKey: 'nav.admin', fallback: 'Admin' },
];

const GLOBAL_VENDOR_ITEMS: { path: string; labelKey: string; fallback: string }[] = [
  { path: '/global-vendors/dashboard', labelKey: 'nav.businessDashboard', fallback: 'Business Dashboard' },
  { path: '/global-vendors/farm-dashboard', labelKey: 'nav.farmDashboard', fallback: 'Farm Dashboard' },
  { path: '/global-vendors/risk-intelligence', labelKey: 'nav.riskIntelligence', fallback: 'Risk Intelligence' },
  { path: '/global-vendors/farmers', labelKey: 'nav.farmInformation', fallback: 'Farm Information' },
  { path: '/global-vendors/approved', labelKey: 'nav.approvedFarmsList', fallback: 'Approved Farms List' },
  { path: '/global-vendors/map', labelKey: 'nav.farmsMap', fallback: 'Farms Map' },
  { path: '/global-vendors/relationship', labelKey: 'nav.relationshipTrust', fallback: 'Relationship & Trust' },
  { path: '/global-vendors/buyer-relationships', labelKey: 'nav.buyerRelationships', fallback: 'Buyer Relationships' },
  { path: '/global-vendors/samples', labelKey: 'nav.samples', fallback: 'Samples' },
  { path: '/global-vendors/logistics', labelKey: 'nav.logistics', fallback: 'Logistics' },
  { path: '/global-vendors/work-logs', labelKey: 'nav.workLogs', fallback: 'Work Logs' },
  { path: '/global-vendors/internal-management', labelKey: 'nav.internalManagement', fallback: 'Internal Management' },
  { path: '/global-vendors/admin', labelKey: 'nav.admin', fallback: 'Admin' },
];

/** Routes under this prefix use the Global Vendors shell only (sidebar + header). */
export function isGlobalVendorsPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === '/global-vendors' || p.startsWith('/global-vendors' + '/');
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SidebarNavLink({
  item,
  railMode,
  translate,
}: {
  item: { path: string; labelKey: string; fallback: string };
  /** Desktop collapsed sidebar: icon only + native tooltip */
  railMode?: boolean;
  translate: (key: string, fallbackOrOptions?: string | TOptions) => string;
}) {
  const label = translate(item.labelKey, item.fallback);
  return (
    <NavLink
      to={item.path}
      title={railMode ? label : undefined}
      aria-label={railMode ? label : undefined}
      className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
    >
      <span className="sidebar-nav-link-icon" aria-hidden>
        <SidebarNavIcon path={item.path} />
      </span>
      <span className="sidebar-nav-link-label">{label}</span>
    </NavLink>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="15" width="7" height="6" rx="1" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function headerUserDisplayName(user: { name?: string | null; email?: string | null } | null | undefined): string {
  const n = user?.name?.trim();
  if (n) return n;
  const em = user?.email?.trim();
  if (em) {
    const local = em.split('@')[0];
    return local || em;
  }
  return '';
}

function headerUserInitials(user: { name?: string | null; email?: string | null } | null | undefined): string {
  const n = user?.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const em = user?.email?.trim();
  if (em) return em.slice(0, 2).toUpperCase();
  return 'U';
}

function formatRoleSummary(
  roleNames: string[],
  translate: (key: string, fallbackOrOptions?: string | TOptions) => string
): string {
  if (!roleNames.length) return '';
  const sep = translate('layout.roleSummarySep');
  if (roleNames.length <= 2) return roleNames.join(sep);
  return `${roleNames.slice(0, 2).join(sep)} ${translate('layout.roleSummaryMore', {
    count: roleNames.length - 2,
  })}`;
}

export function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readCollapsedFromStorage);
  const [sidebarWidthPx, setSidebarWidthPx] = useState(readWidthFromStorage);
  const [isDesktop, setIsDesktop] = useState(desktopMatches);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const roleNames = user?.roleNames ?? [];
  const pathname = location.pathname;
  const globalVendorsShell = isGlobalVendorsPath(pathname);

  const sidebarRailMode = isDesktop && sidebarCollapsed;

  const desktopAsideStyle = useMemo(() => {
    if (!isDesktop) return undefined;
    const w = sidebarCollapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidthPx;
    return {
      width: w,
      minWidth: w,
      flexShrink: 0,
    } as const;
  }, [isDesktop, sidebarCollapsed, sidebarWidthPx]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SIDEBAR_COLLAPSED, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SIDEBAR_WIDTH, String(sidebarWidthPx));
    } catch {
      /* ignore */
    }
  }, [sidebarWidthPx]);

  useEffect(() => {
    if (!isResizingSidebar) return;
    const onMove = (e: MouseEvent) => {
      const next = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, e.clientX));
      setSidebarWidthPx(next);
    };
    const onUp = () => setIsResizingSidebar(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (sidebarCollapsed) setIsResizingSidebar(false);
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const headerDisplayName = useMemo(() => headerUserDisplayName(user) || t('layout.user'), [user, t]);
  const headerInitials = useMemo(() => headerUserInitials(user), [user]);
  const headerRoleSummary = useMemo(() => formatRoleSummary(roleNames, t), [roleNames, t]);
  const headerUserTitle = useMemo(() => {
    const parts: string[] = [];
    if (user?.email) parts.push(user.email);
    if (roleNames.length) parts.push(t('layout.rolesPrefix', { list: roleNames.join(', ') }));
    return parts.join('\n') || undefined;
  }, [user?.email, roleNames, t]);

  if (user) {
    const allowed = canAccessPath(pathname, roleNames);
    if (!allowed) return <Navigate to={getDefaultPath(roleNames)} replace />;
  }

  const visibleItems = MENU_ITEMS.filter((item) => canAccessPath(item.path, roleNames));
  const visibleGlobalVendor = GLOBAL_VENDOR_ITEMS.filter((item) => canAccessPath(item.path, roleNames));

  const showDualNavSections =
    !roleNames.includes('Admin') && visibleItems.length > 0 && visibleGlobalVendor.length > 0;
  const showGlobalSupplySectionAdmin =
    roleNames.includes('Admin') && globalVendorsShell && visibleGlobalVendor.length > 0;

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay ${menuOpen ? 'is-open' : ''}`}
        onClick={closeMenu}
        onKeyDown={(e) => e.key === 'Escape' && closeMenu()}
        role="button"
        tabIndex={-1}
        aria-hidden="true"
      />
      <aside
        style={desktopAsideStyle}
        className={`sidebar ${menuOpen ? 'is-open' : ''} ${sidebarRailMode ? 'sidebar--collapsed' : ''} ${isDesktop && isResizingSidebar ? 'sidebar--resizing' : ''}`}
        aria-label={t('layout.mainNavigation')}
      >
        <div className="sidebar-brand-wrap">
          <div className="sidebar-brand">
            <span className="sidebar-brand-dot" aria-hidden />
            <span className="sidebar-brand-label">Sentinel</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={closeMenu}
            aria-label={t('layout.closeMenu')}
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="sidebar-nav" onClick={closeMenu}>
          {roleNames.includes('Admin') ? (
            // Admin: use Product Hub to switch; sidebar only shows the current area's pages.
            globalVendorsShell ? (
              <>
                {showGlobalSupplySectionAdmin ? (
                  <div className="sidebar-nav-section" title={sidebarRailMode ? t('layout.globalSupplySection') : undefined}>
                    {t('layout.globalSupplySection')}
                  </div>
                ) : null}
                {visibleGlobalVendor.map((item) => (
                  <SidebarNavLink key={item.path} item={item} railMode={sidebarRailMode} translate={t} />
                ))}
              </>
            ) : (
              visibleItems.map((item) => (
                <SidebarNavLink key={item.path} item={item} railMode={sidebarRailMode} translate={t} />
              ))
            )
          ) : (
            // Non-admin: unified sidebar showing Sentinel + Global Vendors together.
            <>
              {showDualNavSections ? (
                <div className="sidebar-nav-section" title={sidebarRailMode ? t('layout.supplierAssuranceSection') : undefined}>
                  {t('layout.supplierAssuranceSection')}
                </div>
              ) : null}
              {visibleItems.map((item) => (
                <SidebarNavLink key={item.path} item={item} railMode={sidebarRailMode} translate={t} />
              ))}
              {showDualNavSections ? (
                <div
                  className="sidebar-nav-section sidebar-nav-section--spaced"
                  title={sidebarRailMode ? t('layout.globalSupplySection') : undefined}
                >
                  {t('layout.globalSupplySection')}
                </div>
              ) : null}
              {visibleGlobalVendor.map((item) => (
                <SidebarNavLink key={item.path} item={item} railMode={sidebarRailMode} translate={t} />
              ))}
            </>
          )}
        </nav>
        {isDesktop ? (
          <div className="sidebar-footer">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebarAria')}
              title={sidebarCollapsed ? t('layout.expandSidebar') : t('layout.collapseSidebarTooltip')}
            >
              {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
          </div>
        ) : null}
      </aside>
      {isDesktop && !sidebarCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t('layout.resizeSidebarAria')}
          title={t('layout.resizeSidebarTooltip')}
          className={`sidebar-resize-handle${isResizingSidebar ? ' is-active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingSidebar(true);
          }}
        />
      ) : null}
      <div className="app-main-wrap">
        <header className="app-header">
          <div className="app-header-start">
            <button
              type="button"
              className="header-menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label={t('layout.openMenu')}
            >
              <MenuIcon />
            </button>
            <div className="app-header-brand" aria-label={t('layout.headerBrandAria')}>
              <div className="app-header-brand-text">
                <span className="app-header-brand-name">Sentinel</span>
                <span className="app-header-brand-tagline">{t('layout.headerTagline')}</span>
              </div>
              <span
                className={`app-header-context${globalVendorsShell ? ' app-header-context--supply' : ''}`}
                title={
                  globalVendorsShell
                    ? t('layout.workspaceContext', { area: t('layout.globalSupply') })
                    : t('layout.workspaceContext', { area: t('layout.supplierAssurance') })
                }
              >
                {globalVendorsShell ? t('layout.globalSupply') : t('layout.supplierAssurance')}
              </span>
            </div>
          </div>
          <div className="app-header-end">
            <LanguageFlagSelector className="app-header-language-selector" />
            {roleNames.includes('Admin') && (
              <button
                type="button"
                className="app-header-btn app-header-btn--hub"
                onClick={() => navigate('/product-hub')}
              >
                <LayoutIcon />
                {t('layout.productHub')}
              </button>
            )}
            <div
              className="app-header-user-chip"
              title={headerUserTitle}
              aria-label={
                headerRoleSummary
                  ? t('layout.userChipSignedInRoles', { name: headerDisplayName, roles: headerRoleSummary })
                  : t('layout.userChipSignedIn', { name: headerDisplayName })
              }
            >
              <span className="app-header-user-avatar" aria-hidden>
                {headerInitials}
              </span>
              <div className="app-header-user-meta">
                <span className="app-header-user-name">{headerDisplayName}</span>
                {headerRoleSummary ? (
                  <span className="app-header-user-roles">{headerRoleSummary}</span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="app-header-btn app-header-btn--logout"
            >
              <LogOutIcon />
              {t('auth.logOut')}
            </button>
          </div>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('auth.logOut')}
        message={t('auth.logOutQuestion')}
        confirmLabel={t('auth.logOut')}
        cancelLabel={t('auth.cancel')}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
          navigate('/login');
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
