// ============================================================================
// STEP 3 — Two additions to server.js (no other changes needed)
// ============================================================================

// 1. Add this import line near the other route imports (e.g. right after
//    the bookingsRouter import, since they're conceptually similar):

import calendarRouter from "./routes/calendar.js";


// 2. Add this mount line near the other app.use(...) calls (right after
//    bookingsRouter, same reasoning):

app.use("/api/calendar", calendarRouter);
