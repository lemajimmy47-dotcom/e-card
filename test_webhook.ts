const textBody = "hapana, nina udhuru.";
let newRsvp = null;
if (textBody.includes('ndio') || textBody.includes('yes') || textBody.includes('nitakuja') || textBody.includes('nitahudhuria') || textBody.includes('atahudhuria') || textBody.includes('kuhudhuria') || textBody.includes('tatahudhuria') || textBody.includes('ntahudhuria') || textBody.includes('ntakuja') || textBody.includes('nakuja') || textBody.includes('1')) {
  newRsvp = 'Atahudhuria';
} else if (textBody.includes('hapana') || textBody.includes('no') || textBody.includes('sitakuja') || textBody.includes('sintahudhuria') || textBody.includes('hatahudhuria') || textBody.includes('sitohudhuria') || textBody.includes('stahudhuria') || textBody.includes('2')) {
  newRsvp = 'Hatahudhuria';
} else if (textBody.includes('sina uhakika') || textBody.includes('maybe') || textBody.includes('labda') || textBody.includes('3')) {
  newRsvp = 'Labda';
}
console.log("newRsvp:", newRsvp);
