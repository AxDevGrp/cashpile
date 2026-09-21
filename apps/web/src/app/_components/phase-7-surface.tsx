"use client";

import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  getPhase7Surface,
  type Phase7SurfaceId,
} from "@/components/ui-v2/phase-7-model";
import styles from "./phase-7-surface.module.css";

export function Phase7Surface({
  id,
  children,
  fullPage = true,
}: {
  id: Phase7SurfaceId;
  children?: React.ReactNode;
  fullPage?: boolean;
}) {
  const surface = getPhase7Surface(id);
  const Root = fullPage ? "main" : "section";
  const Heading = fullPage ? "h1" : "h2";

  return (
    <Root
      className={fullPage ? styles.surface : styles.embeddedSurface}
      data-phase-7-surface={id}
      aria-labelledby={`phase-7-${id}-title`}
    >
      <div className={styles.inner}>
        <img
          className={styles.cash}
          src="/assets/gremlin-v3-crop.png"
          alt="Cash, the Cashpile gremlin"
        />
        <Heading id={`phase-7-${id}-title`}>{surface.title}</Heading>
        <p className={styles.detail}>{surface.detail}</p>
        {children}
      </div>
    </Root>
  );
}

export function Phase7LoadingSurface({ id }: { id: Phase7SurfaceId }) {
  return (
    <Phase7Surface id={id} fullPage={false}>
      <div className={styles.loading} role="status" aria-live="polite">
        <Loader2 aria-hidden="true" />
        <span>Loading</span>
      </div>
      <div className={styles.skeleton} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </Phase7Surface>
  );
}

export function Phase7ErrorSurface({
  id,
  detail,
  onRetry,
}: {
  id: Phase7SurfaceId;
  detail: string;
  onRetry: () => void;
}) {
  return (
    <Phase7Surface id={id} fullPage={false}>
      <div className={styles.alert} role="alert">
        <AlertTriangle aria-hidden="true" />
        <p>{detail}</p>
      </div>
      <button className={styles.primaryAction} type="button" onClick={onRetry}>
        Try again
      </button>
    </Phase7Surface>
  );
}

export function Phase7UnavailableSurface() {
  return (
    <Phase7Surface id="unavailable">
      <Link className={styles.primaryAction} href="/">
        Return home
      </Link>
    </Phase7Surface>
  );
}
