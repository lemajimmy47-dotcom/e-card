#!/bin/bash
sed -i '/app.get("\/api\/guest-lookup"/i \
  // API: Location Redirect\
  app.get("/api/location", async (req, res) => {\
    try {\
      const eventId = req.query.eventId as string;\
      if (!eventId) {\
        return res.status(400).send("Event ID missing. Location cannot be resolved.");\
      }\
      const db = await readDBLatest();\
      const event = db.events?.find((e: any) => e.id === eventId);\
      if (event && event.mapsLink) {\
        return res.redirect(event.mapsLink);\
      }\
      res.status(404).send("Location not configured for this event.");\
    } catch (error) {\
      res.status(500).send("Server error");\
    }\
  });\
' server.ts
