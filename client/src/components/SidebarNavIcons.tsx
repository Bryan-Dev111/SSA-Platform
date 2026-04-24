import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Icons keyed by NavLink `to` path — stroke icons, inherit `currentColor`. */
export function SidebarNavIcon({ path }: { path: string }) {
  switch (path) {
    case '/dashboard':
    case '/global-vendors/dashboard':
      return (
        <Svg>
          <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/global-vendors/farm-dashboard':
      return (
        <Svg>
          <path
            d="M3 21h18M6 21V12l6-5 6 5v9M10 21v-5h4v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 3v2M9 5h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/risk':
      return (
        <Svg>
          <path
            d="M12 9v4M12 17h.01M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    // Side-view car silhouette for Corrective Actions (CAR)
    case '/corrective-actions':
      return (
        <Svg>
          <path
            d="M6 17H18M6 17l2-5 3-2h3l3 2 1 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="17.25" r="1.65" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="17.25" r="1.65" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/findings':
      return (
        <Svg>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.3-4.3M11 8v5M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/audits':
      return (
        <Svg>
          <path
            d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/shipments':
      return (
        <Svg>
          <path
            d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/records':
      return (
        <Svg>
          <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/supplier-profile':
      return (
        <Svg>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/supplier-list':
      return (
        <Svg>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/suppliers-map':
      return (
        <Svg>
          <path
            d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0zM12 13a3 3 0 100-6 3 3 0 000 6z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/documents':
      return (
        <Svg>
          <path
            d="M4 4h10l4 4v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM14 4v4h4M9 13h6M9 17h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/work-logs':
      return (
        <Svg>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/internal-management':
      return (
        <Svg>
          <path d="M12 3v18M8 8h8M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/admin':
      return (
        <Svg>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );

    case '/global-vendors/farmers':
      return (
        <Svg>
          <path
            d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M13 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/global-vendors/farm-profile':
      return (
        <Svg>
          <path
            d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/global-vendors/processing-quality':
      return (
        <Svg>
          <path d="M10 2v7.5M14 9.5V2M10 9.5c0 2 1.5 3.5 4 4s4 2 4 4v6H6v-6c0-2 2-3 4-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/approved':
      return (
        <Svg>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M22 11l-3 3-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/map':
      return (
        <Svg>
          <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 3v15M15 6v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/relationship':
      return (
        <Svg>
          <path d="M12 21a9 9 0 110-18 9 9 0 010 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/buyer-relationships':
      return (
        <Svg>
          <path
            d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '/global-vendors/internal-management':
      return (
        <Svg>
          <path d="M12 3v18M8 8h8M8 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/global-vendors/work-logs':
      return (
        <Svg>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/purchase-orders':
      return (
        <Svg>
          <path d="M6 2L4 6v14a2 2 0 002 2h12a2 2 0 002-2V6l-2-4M6 2h12M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/samples':
      return (
        <Svg>
          <path d="M10 2v7.5M14 9.5V2M10 9.5c0 2 1.5 3.5 4 4s4 2 4 4v6H6v-6c0-2 2-3 4-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/logistics':
    case '/global-vendors/logistics-profile':
      return (
        <Svg>
          <path d="M14 18V6a2 2 0 00-2-2H4a2 2 0 00-2 2v11a2 2 0 002 2h8M14 18h6M14 14h6M14 10h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
        </Svg>
      );
    case '/global-vendors/expenses':
      return (
        <Svg>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case '/global-vendors/admin':
      return (
        <Svg>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
  }
}
