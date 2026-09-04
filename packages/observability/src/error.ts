import { errorCodes, type ErrorCode } from "./codes.ts";

export type StationErrorInit = {
  code: ErrorCode;
  message: string;
  requestId?: string;
  tenantId?: string;
  signalId?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
  status?: number;
  retryable?: boolean;
};

export class StationError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly tenantId?: string;
  requestId?: string;
  readonly signalId?: string;
  override readonly cause?: unknown;

  constructor(init: StationErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = "StationError";
    this.code = init.code;
    const catalog = errorCodes[init.code];
    this.status = init.status ?? catalog.status;
    this.retryable = init.retryable ?? catalog.retryable;
    this.details = init.details;
    this.tenantId = init.tenantId;
    this.requestId = init.requestId;
    this.signalId = init.signalId;
    this.cause = init.cause;
  }
}

export type ClientErrorJson = {
  error: {
    code: ErrorCode;
    message: string;
    requestId?: string;
  };
};

export function toClientError(err: StationError): ClientErrorJson {
  return {
    error: {
      code: err.code,
      message: err.message,
      requestId: err.requestId,
    },
  };
}
