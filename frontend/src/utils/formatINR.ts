/**
 * Format Indian Rupees in Lakhs/Crores notation
 */
export function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN')}`;
}

/**
 * Format with full number + Lakhs/Crores label
 */
export function formatINRFull(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Crore (₹${value.toLocaleString('en-IN')})`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} Lakh (₹${value.toLocaleString('en-IN')})`;
  return `₹${value.toLocaleString('en-IN')}`;
}

/**
 * Short format for metric cards
 */
export function formatINRShort(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}
