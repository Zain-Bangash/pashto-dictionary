import { useContext } from 'react';
import { DashboardStatsContext } from '../context/dashboardStatsValue';

// The layout's stats, or null outside the dashboard layout; never fetches on its own
export default function useSharedStats() {
  return useContext(DashboardStatsContext);
}
