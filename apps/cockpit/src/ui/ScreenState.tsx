import type { ReactNode } from "react";
import { screenStateClass, type ScreenStatus } from "./screen-state.ts";

export function ScreenState({
  status,
  title,
  children,
}: {
  status: ScreenStatus;
  title: string;
  children?: ReactNode;
}) {
  const role = status === "error" ? "alert" : "status";
  return (
    <div className={screenStateClass(status)} role={role} aria-live={status === "error" ? "assertive" : "polite"}>
      <p>{title}</p>
      {children ? <p className="note">{children}</p> : null}
    </div>
  );
}
