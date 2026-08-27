import re

with open('src/components/ContributionManager.tsx', 'r') as f:
    content = f.read()

# We need to find the pattern for formatting payment methods and replace it.
pattern = r"const mobileNormal = mobile\.filter\(m => m\.provider !== 'Mixx By Yas'\);\s*const mobileMixx = mobile\.filter\(m => m\.provider === 'Mixx By Yas'\);\s*if \(mobileNormal\.length > 0 \|\| mobileMixx\.length > 0\) \{.*?(?=paymentString = paymentString\.trim\(\);)"

replacement = r"""const mobileNormal = mobile.filter(m => m.provider !== 'Mixx By Yas');
                const mobileMixx = mobile.filter(m => m.provider === 'Mixx By Yas');

                if (mobileNormal.length > 0 || mobileMixx.length > 0) {
                  paymentString += isEn ? "Mobile Money:\n\n" : "Namba za Simu:\n\n";
                  mobileNormal.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`);
                  mobileMixx.forEach(m => paymentString += `Mixx By Yas: ${m.number} (${m.name})\n\n`);
                }
                if (lipa.length > 0) {
                  paymentString += "Lipa Namba:\n\n";
                  lipa.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`);
                }
                if (bank.length > 0) {
                  paymentString += "Akaunti za Benki:\n\n";
                  bank.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\n\n`);
                }
                """

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open('src/components/ContributionManager.tsx', 'w') as f:
    f.write(new_content)
