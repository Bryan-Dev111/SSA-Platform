export function NoAccess() {
  return (
    <section className="card">
      <div className="card-body">
        <h1 style={{ marginTop: 0 }}>No page access assigned</h1>
        <p className="page-description">
          Your account does not currently have permission to access any page. Please contact an administrator.
        </p>
      </div>
    </section>
  );
}
