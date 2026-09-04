import { AsyncLocalStorage } from "node:async_hooks";
import { StationError } from "./error.ts";
import type { Logger } from "./logger.ts";

export type RequestContext = {
  requestId: string;
  tenantId?: string;
  signalId?: string;
  log?: Logger;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export async function runWithContext<T>(
  ctx: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, async () => {
    try {
      return await fn();
    } catch (thrown) {
      if (thrown instanceof StationError) {
        thrown.requestId ??= ctx.requestId;
        throw thrown;
      }
      ctx.log
        ?.withContext({ requestId: ctx.requestId, tenantId: ctx.tenantId })
        .error("unhandled", { err: String(thrown) });
      throw new StationError({
        code: "invariant.unhandled",
        message: "unhandled error",
        requestId: ctx.requestId,
        tenantId: ctx.tenantId,
        signalId: ctx.signalId,
        cause: thrown,
      });
    }
  });
}
