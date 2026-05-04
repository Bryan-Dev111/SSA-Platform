/**
 * Sentinel Global Supply — Risk Intelligence hub for external risk lenses.
 */
import { useLanguage } from '../../context/LanguageContext';

type SignalPillar = {
  titleKey: string;
  titleFallback: string;
  bodyKey: string;
  bodyFallback: string;
  links: { label: string; href: string }[];
};

const PILLARS: SignalPillar[] = [
  {
    titleKey: 'globalRisk.pillar.environment.title',
    titleFallback: 'Environmental & weather',
    bodyKey: 'globalRisk.pillar.environment.body',
    bodyFallback:
      'Track seasonal rainfall and temperature stress, drought or flood advisories, pest pressure, and harvest windows that can shift origin availability or quality. Pair satellite and ground reports with your crop calendar.',
    links: [
      { label: 'NOAA Climate', href: 'https://www.climate.gov/' },
      { label: 'WMO', href: 'https://public.wmo.int/' },
    ],
  },
  {
    titleKey: 'globalRisk.pillar.politics.title',
    titleFallback: 'Politics & policy',
    bodyKey: 'globalRisk.pillar.politics.body',
    bodyFallback:
      'Monitor elections, civil unrest, sanctions, export bans, and trade-rule changes that can block shipments or re-price origins overnight. Flag jurisdictions where contract enforcement may weaken.',
    links: [
      { label: 'WTO news', href: 'https://www.wto.org/english/news_e/news_e.htm' },
      { label: 'World Bank — overview', href: 'https://www.worldbank.org/en/what-we-do' },
    ],
  },
  {
    titleKey: 'globalRisk.pillar.logistics.title',
    titleFallback: 'Logistics & infrastructure',
    bodyKey: 'globalRisk.pillar.logistics.body',
    bodyFallback:
      'Watch port congestion, rail and road disruptions, fuel or power shortages, cold-chain breaks, and last-mile risk. Correlate carrier delays with origin and destination hubs you use most.',
    links: [
      { label: 'UNCTAD — transport & trade', href: 'https://unctad.org/topic/transport-and-trade-logistics' },
      { label: 'ReliefWeb — disasters', href: 'https://reliefweb.int/disasters' },
    ],
  },
  {
    titleKey: 'globalRisk.pillar.financial.title',
    titleFallback: 'Financial & market signals',
    bodyKey: 'globalRisk.pillar.financial.body',
    bodyFallback:
      'Follow FX against your settlement currencies, benchmark futures for your commodities, credit spreads for key counterparties, and inflation or interest-rate paths that move working-capital cost.',
    links: [
      { label: 'IMF — World Economic Outlook', href: 'https://www.imf.org/en/Publications/WEO' },
      { label: 'FAO — food outlook', href: 'https://www.fao.org/worldfoodsituation/csdb/en/' },
    ],
  },
];

export function GlobalSupplyRiskIntelligencePage() {
  const { t } = useLanguage();

  return (
    <div className="global-vendors-main">
      <h1 className="page-title">{t('globalRisk.pageTitle', 'Risk Intelligence')}</h1>
      <p className="global-vendors-lead" style={{ maxWidth: '52rem' }}>
        {t(
          'globalRisk.lead',
          'A single place to orient sourcing and operations teams on external risks. Use the pillars below as a checklist; links open official reference sources in a new tab.'
        )}
      </p>

      <div
        className="dashboard-metric-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
      >
        {PILLARS.map((pillar) => (
          <div key={pillar.titleKey} className="card" style={{ margin: 0 }}>
            <div className="card-body">
              <h2 style={{ marginTop: 0, fontSize: 'var(--text-lg)' }}>
                {t(pillar.titleKey, pillar.titleFallback)}
              </h2>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, marginBottom: '1rem' }}>
                {t(pillar.bodyKey, pillar.bodyFallback)}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--text-sm)' }}>
                {pillar.links.map((link) => (
                  <li key={link.href} style={{ marginBottom: '0.35rem' }}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-body">
          <h2 style={{ marginTop: 0, fontSize: 'var(--text-lg)' }}>{t('globalRisk.howTitle', 'How teams use this page')}</h2>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
            <li>{t('globalRisk.how1', 'Commodity buyers: align bids and coverage with weather and policy shocks in origins.')}</li>
            <li>{t('globalRisk.how2', 'Sourcing directors: prioritize country reviews when multiple pillars flash red.')}</li>
            <li>{t('globalRisk.how3', 'Logistics: escalate reroutes when infrastructure and market stress overlap.')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
