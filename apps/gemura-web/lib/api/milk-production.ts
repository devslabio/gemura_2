import { apiClient } from './client';

export interface MilkCostPerLitreReport {
  from: string | null;
  to: string | null;
  farm_id: string | null;
  total_expense: number;
  total_expense_accounting: number;
  total_expense_inventory_feed: number;
  total_production_litres: number;
  total_cows: number;
  producing_cows: number;
  non_producing_cows: number;
  producing_cost_estimate: number;
  non_producing_cost_estimate: number;
  cost_per_litre_producing_cows: number;
  expense_by_category: Array<{ category_name: string; amount: number }>;
  allocation_basis?: 'producing_cows' | 'total_cows' | 'production_litres';
  shared_cost_allocation_factor?: number;
  notes: string[];
}

interface ApiResponse<T> {
  code: number;
  status: string;
  message: string;
  data: T;
}

export const milkProductionApi = {
  costPerLitre: (
    from?: string,
    to?: string,
    farmId?: string,
    includeInventoryFeedCosts = true,
    avoidDoubleCounting = true,
    allocationBasis: 'producing_cows' | 'total_cows' | 'production_litres' = 'producing_cows',
  ) =>
    apiClient.get<ApiResponse<MilkCostPerLitreReport>>('/milk-production/cost-per-litre', {
      params: {
        from,
        to,
        farm_id: farmId,
        include_inventory_feed_costs: includeInventoryFeedCosts ? 'true' : 'false',
        avoid_double_counting: avoidDoubleCounting ? 'true' : 'false',
        allocation_basis: allocationBasis,
      },
    }),
};

