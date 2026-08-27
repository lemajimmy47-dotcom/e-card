#!/bin/bash
sed -i 's/let lastError: Error | null = null;/let lastError: Error | null = null;\n        let rootErrorObj: any = null;/g' server.ts
sed -i '/if (errObj.error && errObj.error.code === 132001) {/a \
                if (attempt === 1) rootErrorObj = errObj; \
' server.ts
