import { DashboardProvider } from "@/lib/store";
import Shell from "@/components/Shell";

export default function Page() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  );
}
