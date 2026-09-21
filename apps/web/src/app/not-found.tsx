import { isUiV2Enabled } from "@/components/ui-v2";
import { Phase7UnavailableSurface } from "./_components/phase-7-surface";

export default function NotFound() {
  if (isUiV2Enabled()) return <Phase7UnavailableSurface />;

  return (
    <main>
      <h1>404</h1>
      <p>This page could not be found.</p>
    </main>
  );
}
