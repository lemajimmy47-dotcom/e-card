#!/bin/bash
sed -i '/if (errObj.error) {/i \
          if (rootErrorObj && rootErrorObj.error) {\
            throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${rootErrorObj.error.error_data?.details || "haipo"}) halipatikani katika lugha uliyochagua. Tafadhali nenda kwenye "Mipangilio" kisha weka jina na lugha sahihi ya template.`);\
          }\
' server.ts
