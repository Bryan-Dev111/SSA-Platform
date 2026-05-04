import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

type BankingStatus = {
  provider: string;
  institutionLabel: string | null;
  apiKeyHint: string | null;
  apiSecretConfigured: boolean;
  updatedAt: string | null;
};

const PROVIDERS = ['custom', 'plaid', 'stripe', 'teller', 'other'] as const;

export function InternalManagementBankingPanel({ token }: { token: string | null }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BankingStatus | null>(null);
  const [provider, setProvider] = useState('custom');
  const [institutionLabel, setInstitutionLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const row = await apiJson<BankingStatus>('/banking-settings', { token });
      setStatus(row);
      setProvider(row.provider || 'custom');
      setInstitutionLabel(row.institutionLabel ?? '');
      setApiKey('');
      setApiSecret('');
    } catch (e) {
      setStatus(null);
      toast.error(e instanceof Error ? e.message : t('internal.banking.loadError', 'Could not load banking settings'));
    } finally {
      setLoading(false);
    }
  }, [token, toast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider,
        institutionLabel: institutionLabel.trim() || null,
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (apiSecret.trim()) body.apiSecret = apiSecret.trim();
      const next = await apiJson<BankingStatus & { ok?: boolean }>('/banking-settings', {
        token,
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setStatus(next);
      setApiKey('');
      setApiSecret('');
      toast.success(t('internal.banking.saved', 'Banking settings saved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('internal.banking.saveError', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const next = await apiJson<BankingStatus & { ok?: boolean }>('/banking-settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          provider: 'custom',
          institutionLabel: null,
          apiKey: '',
          apiSecret: '',
        }),
      });
      setStatus(next);
      setProvider('custom');
      setInstitutionLabel('');
      setApiKey('');
      setApiSecret('');
      toast.info(t('internal.banking.disconnected', 'Stored API keys were removed'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('internal.banking.saveError', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (!token) return null;

  return (
    <div className="card">
      <div className="card-body">
        <h2 style={{ marginTop: 0 }}>{t('internal.banking.title', 'Banking connection')}</h2>
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '48rem', lineHeight: 1.55 }}>
          {t(
            'internal.banking.intro',
            'Store API keys for your bank or treasury provider. Keys are encrypted on the server. Leave key fields blank when saving to keep existing values unchanged.'
          )}
        </p>

        {loading ? (
          <p className="table-empty">{t('common.loading', 'Loading…')}</p>
        ) : (
          <>
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label className="input-label" htmlFor="bank-provider">
                {t('internal.banking.provider', 'Integration')}
              </label>
              <select
                id="bank-provider"
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={{ maxWidth: 320 }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p === 'custom'
                      ? t('internal.banking.providerCustom', 'Custom / other API')
                      : p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="bank-institution">
                {t('internal.banking.institutionLabel', 'Bank or institution label')}
              </label>
              <input
                id="bank-institution"
                className="input"
                value={institutionLabel}
                onChange={(e) => setInstitutionLabel(e.target.value)}
                placeholder={t('internal.banking.institutionPlaceholder', 'e.g. Operating account — North region')}
                autoComplete="off"
                style={{ maxWidth: 480 }}
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="bank-api-key">
                {t('internal.banking.apiKey', 'API key')}
              </label>
              <input
                id="bank-api-key"
                className="input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('internal.banking.apiKeyPlaceholder', 'Paste new key to replace stored key')}
                autoComplete="new-password"
                style={{ maxWidth: 480 }}
              />
              {status?.apiKeyHint ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  {t('internal.banking.currentKey', 'Current key')}: <code>{status.apiKeyHint}</code>
                </p>
              ) : null}
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="bank-api-secret">
                {t('internal.banking.apiSecret', 'API secret (optional)')}
              </label>
              <input
                id="bank-api-secret"
                className="input"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={t('internal.banking.apiSecretPlaceholder', 'Paste new secret to replace stored secret')}
                autoComplete="new-password"
                style={{ maxWidth: 480 }}
              />
              {status?.apiSecretConfigured ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 6 }}>
                  {t('internal.banking.secretOnFile', 'A secret is on file. Paste a new value to replace it.')}
                </p>
              ) : null}
            </div>

            {status?.updatedAt ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {t('internal.banking.lastUpdated', 'Last updated')}: {new Date(status.updatedAt).toLocaleString()}
              </p>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
                {t('internal.banking.save', 'Save connection')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving || (!status?.apiKeyHint && !status?.apiSecretConfigured)}
                onClick={() => void disconnect()}
              >
                {t('internal.banking.disconnect', 'Remove keys')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
