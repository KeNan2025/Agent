/**
 * Format file size in human-readable format.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format a date string to locale display.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get risk level color variable name.
 */
export function riskColorVar(level: string): string {
  if (level.includes('高')) return 'var(--danger)';
  if (level.includes('中')) return 'var(--warning)';
  return 'var(--success)';
}

/**
 * Get probability color based on threshold.
 */
export function probabilityColor(value: number): string {
  if (value >= 0.6) return 'var(--danger)';
  if (value >= 0.3) return 'var(--warning)';
  return 'var(--success)';
}
