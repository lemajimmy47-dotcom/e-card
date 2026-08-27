sed -i 's/onUpdateGuests(processingGuests);/onUpdateGuests(processingGuests, "Sending in progress...", true);/g' src/components/SendMessages.tsx

# At the end of handleSendAll, after the loop finishes:
# Before `setIsSendingAll(false);` add `onUpdateGuests(processingGuests, "Finished sending messages", false);`
sed -i 's/setIsSendingAll(false);/onUpdateGuests(processingGuests, "Finished sending messages", false);\n    setIsSendingAll(false);/g' src/components/SendMessages.tsx
