export default function Home() {
  return (
    <main style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '60px 40px',
      maxWidth: 720,
      margin: '0 auto',
      color: '#1a1a1a',
      lineHeight: 1.6,
    }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>AssetVault Sync</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        Metadata sync backend. Running.
      </p>
      <div style={{
        background: '#f5f5f5',
        padding: 20,
        borderRadius: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13,
      }}>
        <div>GET  /api/sync/status   — healthcheck + counts</div>
        <div>GET  /api/sync/pull     — pull changes since ?since=</div>
        <div>POST /api/sync/push     — push local changes</div>
        <div>POST /api/sync/clear    — emergency wipe</div>
      </div>
      <p style={{ color: '#999', fontSize: 13, marginTop: 24 }}>
        All endpoints require <code>Authorization: Bearer &lt;SYNC_API_KEY&gt;</code>.
      </p>
    </main>
  )
}
