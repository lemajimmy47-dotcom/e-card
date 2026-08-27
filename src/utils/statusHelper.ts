/**
 * Centralized utility for handling and checking message sending statuses.
 * This helper determines if an SMS or WhatsApp status indicates that the message
 * has been successfully sent or delivered/read.
 */

export const isStatusSent = (status: string | undefined | null): boolean => {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return (
    s === 'imetumia' || 
    s === 'imefika' || 
    s === 'imesomwa' || 
    s === 'sent' || 
    s === 'delivered' || 
    s === 'read' ||
    s === 'success' ||
    s === 'delivered to device' ||
    s === 'read by recipient'
  );
};
