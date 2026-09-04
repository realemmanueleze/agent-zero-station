export const errorCodes = {
  "auth.control_token": { status: 401, retryable: false },
  "auth.cockpit_password": { status: 401, retryable: false },
  "auth.graph": { status: 401, retryable: false },
  "claim.taken": { status: 409, retryable: false },
  "config.graph_required": { status: 500, retryable: false },
  "config.missing_master_key": { status: 500, retryable: false },
  "config.pack_db_same_as_station": { status: 500, retryable: false },
  "invariant.missing_tenant": { status: 500, retryable: false },
  "invariant.not_implemented": { status: 500, retryable: false },
  "invariant.unhandled": { status: 500, retryable: false },
  "lease.held": { status: 409, retryable: false },
  "schema.migrate_failed": { status: 500, retryable: false },
  "send.already_sent": { status: 409, retryable: false },
  "send.provider_failed": { status: 502, retryable: true },
} as const;

export type ErrorCode = keyof typeof errorCodes;

export function isErrorCode(value: string): value is ErrorCode {
  return value in errorCodes;
}
