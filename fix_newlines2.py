with open('src/components/ContributionManager.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if line.strip() == '" : "Namba za Simu:':
        new_lines[-1] = new_lines[-1].replace('isEn ? "Mobile Money:', 'isEn ? "Mobile Money:\\n\\n" : "Namba za Simu:\\n\\n";')
        skip = True
        continue
    if skip and line.strip() == '";':
        skip = False
        continue
    if skip and line.strip() == '':
        continue
        
    if line.strip() == '`);':
        if 'mobileNormal.forEach' in new_lines[-1] or 'mobileMixx.forEach' in new_lines[-1] or 'lipa.forEach' in new_lines[-1] or 'bank.forEach' in new_lines[-1]:
            # This is complex. Let's just do a big regex replacement on the whole string.
            pass

with open('src/components/ContributionManager.tsx', 'w') as f:
    f.writelines(new_lines)
