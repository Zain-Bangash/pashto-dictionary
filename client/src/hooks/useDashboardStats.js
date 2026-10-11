import { useContext } from 'react';
import { DashboardStatsContext } from '../context/dashboardStatsValue';
import useStatsLoader from './useStatsLoader';

// The layout's shared stats when there is one, otherwise this page loads its own
export default function useDashboardStats() {
  const shared = useContext(DashboardStatsContext);
  const own = useStatsLoader(!shared);
  return shared ?? own;
}
