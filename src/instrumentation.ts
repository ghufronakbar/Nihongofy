import type { Instrumentation } from "next";
import { getSafeRequestPath, reportServerError } from "@/lib/server-logger";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportServerError("next.request.unhandled_error", error, {
    request: {
      method: request.method,
      path: getSafeRequestPath(request.path),
    },
    context: {
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
    },
  });
};
