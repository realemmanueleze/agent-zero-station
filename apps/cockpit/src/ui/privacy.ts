export const PRIVACY_HREF = "/privacy";

export function renderPrivacyHtml(): string {
  return `<main class="privacy">
  <h1>Privacy</h1>
  <p>This station is self-hosted. There is no shared SaaS and no shared OAuth client.</p>
  <p>Secrets stay on the host that runs the worker. Logs redact tokens and mail bodies. Approve is the only send.</p>
  <p>The operator of this install is whoever deployed it.</p>
</main>`;
}
