/**
 * Utility function to convert array of objects to downloadable CSV file.
 * 
 * @param {string} filename Name of the file to download (e.g. 'stock_matrix_report.csv')
 * @param {Array<Object>} data Array of row data objects
 * @param {Array<{label: string, key: string}>} columns Column definitions with headers and object keys
 */
export const exportToCSV = (filename, data, columns) => {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Create header row
  const headers = columns ? columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',') : Object.keys(data[0]).map(k => `"${k.replace(/"/g, '""')}"`).join(',');

  // Create data rows
  const rows = data.map(row => {
    if (columns) {
      return columns.map(col => {
        let val = col.key.split('.').reduce((obj, i) => (obj ? obj[i] : ''), row);
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    } else {
      return Object.values(row).map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',');
    }
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
