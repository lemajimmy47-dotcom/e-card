import sys

with open('src/components/ContributionManager.tsx', 'r') as f:
    content = f.read()

old_block = """                if (mobileNormal.length > 0) {
                  paymentString += isEn ? "Mobile Money:\\n" : "Namba za Simu:\\n";
                  mobileNormal.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
                  paymentString += "\\n";
                }
                if (mobileMixx.length > 0) {
                  paymentString += "Mixx By Yas:\\n";
                  mobileMixx.forEach(m => paymentString += `${m.number} (${m.name})\\n`);
                  paymentString += "\\n";
                }
                if (lipa.length > 0) {
                  paymentString += "Lipa Namba:\\n";
                  lipa.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
                  paymentString += "\\n";
                }
                if (bank.length > 0) {
                  paymentString += "Akaunti za Benki:\\n";
                  bank.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
                  paymentString += "\\n";
                }"""

new_block = """                if (mobileNormal.length > 0 || mobileMixx.length > 0) {
                  paymentString += isEn ? "Mobile Money:\\n\\n" : "Namba za Simu:\\n\\n";
                  mobileNormal.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
                  mobileMixx.forEach(m => paymentString += `Mixx By Yas: ${m.number} (${m.name})\\n\\n`);
                }
                if (lipa.length > 0) {
                  paymentString += "Lipa Namba:\\n\\n";
                  lipa.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
                }
                if (bank.length > 0) {
                  paymentString += "Akaunti za Benki:\\n\\n";
                  bank.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
                }"""

content = content.replace(old_block, new_block)

old_block_2 = """      if (mobileNormal.length > 0) {
        paymentString += isEn ? "Mobile Money:\\n" : "Namba za Simu:\\n";
        mobileNormal.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
        paymentString += "\\n";
      }
      if (mobileMixx.length > 0) {
        paymentString += "Mixx By Yas:\\n";
        mobileMixx.forEach(m => paymentString += `${m.number} (${m.name})\\n`);
        paymentString += "\\n";
      }
      if (lipa.length > 0) {
        paymentString += "Lipa Namba:\\n";
        lipa.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
        paymentString += "\\n";
      }
      if (bank.length > 0) {
        paymentString += "Akaunti za Benki:\\n";
        bank.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n`);
        paymentString += "\\n";
      }"""

new_block_2 = """      if (mobileNormal.length > 0 || mobileMixx.length > 0) {
        paymentString += isEn ? "Mobile Money:\\n\\n" : "Namba za Simu:\\n\\n";
        mobileNormal.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
        mobileMixx.forEach(m => paymentString += `Mixx By Yas: ${m.number} (${m.name})\\n\\n`);
      }
      if (lipa.length > 0) {
        paymentString += "Lipa Namba:\\n\\n";
        lipa.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
      }
      if (bank.length > 0) {
        paymentString += "Akaunti za Benki:\\n\\n";
        bank.forEach(m => paymentString += `${m.provider}: ${m.number} (${m.name})\\n\\n`);
      }"""

content = content.replace(old_block_2, new_block_2)

with open('src/components/ContributionManager.tsx', 'w') as f:
    f.write(content)
