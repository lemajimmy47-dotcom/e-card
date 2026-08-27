sed -i 's/onUpdateGuests(processingGuests);/onUpdateGuests(processingGuests, "Sending contributions alert in progress...", true);/g' src/components/ContributionManager.tsx

# At the end of handleSendBulkReminders, after the loop finishes:
# Before `setIsSendingAll(false);` add `onUpdateGuests(processingGuests, "Finished sending contribution alerts", false);`
sed -i 's/setIsSendingAll(false);/onUpdateGuests(processingGuests, "Finished sending contribution alerts", false);\n    setIsSendingAll(false);/g' src/components/ContributionManager.tsx
