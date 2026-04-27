import { useEffect, useState } from 'react';
import { apiJson } from '../../api/client';
import { parseApiError } from '../../utils/apiHelpers';

interface LegalDoc {
  key: 'terms' | 'privacy';
  title: string;
  content: string;
  updatedAt?: string;
}

const DEFAULT_DOCS: LegalDoc[] = [
  { key: 'terms', title: 'Terms and Conditions', content: '' },
  { key: 'privacy', title: 'Privacy Policy', content: '' },
];

export function LegalAdminEditor({ token }: { token: string | null }) {
  const [docs, setDocs] = useState<LegalDoc[]>(DEFAULT_DOCS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing auth token');
      return;
    }
    setLoading(true);
    setError(null);
    apiJson<LegalDoc[]>('/legal', { token })
      .then((incoming) => {
        const byKey: Record<string, LegalDoc> = {};
        for (const d of incoming) byKey[d.key] = d;
        setDocs(
          DEFAULT_DOCS.map((d) => byKey[d.key] ?? d)
        );
      })
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key: 'terms' | 'privacy', content: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.key === key ? { ...d, content } : d))
    );
  };

  const saveDoc = async (doc: LegalDoc) => {
    if (!token) return;
    setSavingKey(doc.key);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiJson<LegalDoc>(`/legal/${doc.key}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ title: doc.title, content: doc.content }),
      });
      setDocs((prev) =>
        prev.map((d) => (d.key === updated.key ? { ...d, ...updated } : d))
      );
      setSuccess(
        doc.key === 'terms'
          ? 'Terms and Conditions saved'
          : 'Privacy Policy saved'
      );
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      {loading && <p>Loading legal content…</p>}
      {error && !loading && (
        <div className="alert-error" style={{ marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}
      {success && !loading && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary-light)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text)',
          }}
        >
          {success}
        </div>
      )}
      {!loading && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {docs.map((doc) => (
            <div key={doc.key}>
              <h3 style={{ marginTop: 0, fontSize: 'var(--text-base)' }}>{doc.title}</h3>
              <textarea
                className="input"
                rows={12}
                value={doc.content}
                onChange={(e) => updateField(doc.key, e.target.value)}
                placeholder={`Paste your ${doc.title.toLowerCase()} here…`}
              />
              {doc.updatedAt && (
                <p
                  style={{
                    marginTop: '0.35rem',
                    marginBottom: '0.35rem',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Last updated: {new Date(doc.updatedAt).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveDoc(doc)}
                disabled={!doc.content.trim() || savingKey === doc.key}
                style={{ marginTop: '0.35rem' }}
              >
                {savingKey === doc.key ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

