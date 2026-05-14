/**
 * Sentinel Global Supply — Risk Intelligence hub for external risk lenses.
 */
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { VerticalBarChart } from '../../components/DashboardBarCharts';

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

const RISK_NEWS_LINKS: { href: string; titleKey: string; titleFallback: string }[] = [
  {
    href: 'https://www.wto.org/english/news_e/news_e.htm',
    titleKey: 'globalRisk.news.i1',
    titleFallback: 'WTO — Trade monitoring and press',
  },
  {
    href: 'https://www.fao.org/news/en/',
    titleKey: 'globalRisk.news.i2',
    titleFallback: 'FAO — News on food and agriculture',
  },
  {
    href: 'https://news.un.org/en/climate-change',
    titleKey: 'globalRisk.news.i3',
    titleFallback: 'UN News — Climate change',
  },
  {
    href: 'https://www.imf.org/en/News',
    titleKey: 'globalRisk.news.i4',
    titleFallback: 'IMF — Press center',
  },
];

const singleLineHeading: CSSProperties = {
  marginTop: 0,
  fontSize: 'var(--text-lg)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  width: '100%',
  maxWidth: '100%',
};

const singleLineListItem: CSSProperties = {
  display: 'block',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginBottom: '0.4rem',
};

/** Centered block for the bar chart card: one row, card limited width, horizontally centered. */
const chartRowOuter: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  maxWidth: '100%',
  marginTop: '1.25rem',
};

const chartCard: CSSProperties = {
  margin: 0,
  minWidth: 0,
  width: '100%',
  maxWidth: 'min(56rem, 100%)',
};

export function GlobalSupplyRiskIntelligencePage() {
  const { t } = useLanguage();

  const chartRows = useMemo(
    () => [
      { label: t('globalRisk.chartBar.environment', 'Environment'), value: 68 },
      { label: t('globalRisk.chartBar.politics', 'Politics & policy'), value: 55 },
      { label: t('globalRisk.chartBar.logistics', 'Logistics'), value: 48 },
      { label: t('globalRisk.chartBar.financial', 'Markets'), value: 62 },
    ],
    [t]
  );

  return (
    <div className="global-vendors-main" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <h1 className="page-title">{t('globalRisk.pageTitle', 'Risk Intelligence')}</h1>
      <p className="global-vendors-lead" style={{ maxWidth: '80rem' }}>
        {t(
          'globalRisk.lead',
          'A single place to orient sourcing and operations teams on external risks. Use the pillars below as a checklist; links open official reference sources in a new tab.'
        )}
      </p>

      <div style={chartRowOuter}>
        <div className="card" style={chartCard}>
          <div className="card-body">
            <h2 style={{ ...singleLineHeading, textAlign: 'center' }}>
              {t('globalRisk.chartTitle', 'Pillar emphasis (illustrative)')}
            </h2>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                marginBottom: '0.75rem',
                textAlign: 'center',
              }}
            >
              {t(
                'globalRisk.chartCaption',
                'Sample scores for layout only — swap in your own indices, scores, or geospatial layers when you connect data.'
              )}
            </p>
            <VerticalBarChart rows={chartRows} valueFormatter={(v) => String(Math.round(v))} axisLabelsNoWrap />
          </div>
        </div>
      </div>

      <div className="global-risk-pillars-grid">
        {PILLARS.map((pillar) => (
          <div key={pillar.titleKey} className="card" style={{ margin: 0, minWidth: 0 }}>
            <div className="card-body">
              <h2 style={singleLineHeading}>{t(pillar.titleKey, pillar.titleFallback)}</h2>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.55, marginBottom: '1rem' }}>
                {t(pillar.bodyKey, pillar.bodyFallback)}
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--text-sm)' }}>
                {pillar.links.map((link) => (
                  <li key={link.href} style={{ ...singleLineListItem, marginBottom: '0.35rem' }}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" title={link.label}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.25rem', minWidth: 0 }}>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <h2 style={singleLineHeading}>{t('globalRisk.newsTitle', 'News & signals')}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: '0.75rem' }}>
            {t(
              'globalRisk.newsLead',
              'Curated entry points to public sources. RSS, APIs, or paid feeds can be wired here when you are ready to discuss integrations.'
            )}
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: 'var(--text-sm)', lineHeight: 1.55 }}>
            {RISK_NEWS_LINKS.map((item) => (
              <li key={item.href} style={singleLineListItem}>
                <a href={item.href} target="_blank" rel="noopener noreferrer" title={t(item.titleKey, item.titleFallback)}>
                  {t(item.titleKey, item.titleFallback)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.25rem', minWidth: 0 }}>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <h2 style={{ ...singleLineHeading, textAlign: 'center' }}>{t('globalRisk.howTitle', 'How teams use this page')}</h2>
          <ul
            style={{
              margin: '0.75rem auto 0',
              paddingLeft: '1.25rem',
              lineHeight: 1.6,
              display: 'inline-block',
              textAlign: 'left',
              maxWidth: 'min(48rem, 100%)',
            }}
          >
            <li style={singleLineListItem}>
              {t('globalRisk.how1', 'Commodity buyers: align bids and coverage with weather and policy shocks in origins.')}
            </li>
            <li style={singleLineListItem}>
              {t('globalRisk.how2', 'Sourcing directors: prioritize country reviews when multiple pillars flash red.')}
            </li>
            <li style={{ ...singleLineListItem, marginBottom: 0 }}>
              {t('globalRisk.how3', 'Logistics: escalate reroutes when infrastructure and market stress overlap.')}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
