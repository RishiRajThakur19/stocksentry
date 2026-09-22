export const getProductImage = (itemName = '', imageUrl = '') => {
  if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('data:image'))) {
    return imageUrl;
  }
  const lower = (itemName || '').toLowerCase();
  if (lower.includes('nokia')) return '/assets/modem_nokia.png';
  if (lower.includes('juniper')) return '/assets/modem_juniper.png';
  if (lower.includes('modem') || lower.includes('router')) return '/assets/modem_nokia.png';
  if (lower.includes('clamp') || lower.includes('splicer')) return '/assets/clamping_machine.png';
  if (lower.includes('cable') || lower.includes('wire')) return '/assets/cables.png';
  if (lower.includes('tie') || lower.includes('zip')) return '/assets/ties.png';
  if (lower.includes('camera') || lower.includes('security')) return '/assets/camera.png';
  if (lower.includes('shirt') || lower.includes('tshirt') || lower.includes('apparel')) return '/assets/tshirt.png';
  return '/assets/modem_nokia.png';
};
