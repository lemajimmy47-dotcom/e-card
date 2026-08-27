#!/bin/bash
sed -i 's/resolvedParams.push(eventData?.deadlineDate || "Tarehe ya Mwisho");/const dd = eventData?.contributionDeadline || eventData?.deadlineDate;\n        resolvedParams.push(dd ? new Date(dd).toLocaleDateString("sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : "Tarehe ya Mwisho");/g' server.ts
