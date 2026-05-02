/**
 * Supplier / Customer entity types (UI for now; backend to be wired later).
 * Farmer, Cooperative, MCP, MCC + recommended options for dairy/agri supply chain.
 */
export const ENTITY_TYPE_OPTIONS = [
  { value: '', label: '— Select type —' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'mcp', label: 'MCP' },
  { value: 'mcc', label: 'MCC' },
  { value: 'trader', label: 'Trader' },
  { value: 'processor', label: 'Processor' },
  { value: 'collector', label: 'Collector' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'agent', label: 'Agent' },
  { value: 'household', label: 'Household' },
];

export const SUPPLIER_TYPE_OPTIONS = ENTITY_TYPE_OPTIONS;
