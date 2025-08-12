exports.formatPhone252 = (phone) => {
    if (!phone) return '';
  
    // Remove all non-digits
    let cleaned = String(phone).replace(/[^\d]/g, '');
  
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
  
    // Remove duplicate country code if present
    if (cleaned.startsWith('252252')) {
      cleaned = cleaned.slice(3);
    }
  
    // Ensure starts with 252
    if (!cleaned.startsWith('252')) {
      cleaned = `252${cleaned}`;
    }
  
    // Final sanity check: must be digits only
    return cleaned.replace(/[^\d]/g, '');
  };
  