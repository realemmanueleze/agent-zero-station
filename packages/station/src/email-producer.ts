export type ProducedEmail = {
  account: string;
  kind: "email";
  sendTo: string;
  from: string;
  subject: string;
  body: string;
};

export function decisionFromInbound(input: {
  account: string;
  from: string;
  to: string;
  subject: string;
  body: string;
}): ProducedEmail {
  return {
    account: input.account,
    kind: "email",
    sendTo: input.to,
    from: input.from,
    subject: input.subject,
    body: input.body,
  };
}

export function fixtureInbound(account: string): ProducedEmail {
  return decisionFromInbound({
    account,
    from: "inbound@example.com",
    to: account,
    subject: "inbound",
    body: "inbound",
  });
}
