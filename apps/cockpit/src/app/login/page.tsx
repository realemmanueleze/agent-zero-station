export default function LoginPage() {
  return (
    <main className="login-desk">
      <form method="post" action="/api/login">
        <h1>Open the desk</h1>
        <p className="note">Off-box access needs the cockpit password for this install.</p>
        <label>
          Desk password
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Open desk</button>
      </form>
    </main>
  );
}
