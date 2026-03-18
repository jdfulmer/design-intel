// app/page.tsx — serves the dashboard, fetches data from API routes on load

import DesignIntelDashboard from "./dashboard";

export const metadata = { title: "Design Intel — D2E Labs" };

export default function Page() {
  return <DesignIntelDashboard />;
}
