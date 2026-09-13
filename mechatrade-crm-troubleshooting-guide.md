# Mechatrade CRM — Troubleshooting Guide

A running log of real issues hit while operating the CRM (GitHub Pages + Firebase),
what caused them, and how they were fixed. This is meant to grow — see
**"How to add a new entry"** at the bottom.

Each entry follows the same shape: **Symptom → Cause → Fix → Prevention**.

---

## 1. Deleted records still show up for other users (stale cache)

**Symptom**
A record (e.g. a Contact) was deleted directly in the Firebase console —
confirmed the collection is empty there — but another signed-in user's
browser still shows it in the list. Trying to delete it from that view
fails or shows a permission message.

**Cause**
That browser tab already had the record loaded from before the deletion.
Firestore normally pushes live "removed" updates to every open session the
moment a document is deleted, but a session that's been idle, lost its
connection briefly, or hasn't been reloaded since the change can keep
showing its last known snapshot until it resyncs. What you were seeing was
stale local data, not a real record still sitting in the database.

**Fix**
1. Hard refresh the affected browser tab (Ctrl+R / Cmd+R). This alone
   usually fixes it.
2. If it still shows the old data, sign out and sign back in.
3. If it *still* persists, clear that site's storage for the browser
   (Chrome: Settings → Privacy → Site settings → find the site → Clear
   data) to wipe Firestore's local cache (IndexedDB) entirely, then reload.

**Prevention**
No action needed day-to-day — this is normal, occasional Firestore
behavior, not a bug to fix in the app. If it happens often for the same
person, it's usually a sign their device/browser tab stays open and
unattended for long stretches (e.g. overnight) without a refresh.

---

## 2. A contact isn't visible to someone who should see it (or is visible to someone who shouldn't)

**Symptom**
A user can't find a Contact in the Contacts list, or the delete/edit
button is missing/grayed out, even though the contact clearly exists.

**Cause**
This is very likely **working as designed**, not a bug. As of the current
Firestore rules:
- **Accounts and Leads** are a shared registry — every signed-in user can
  see all of them, regardless of who owns them. Editing is still
  restricted to the owner, a manager over that department, or an admin.
- **Contacts** are intentionally *not* shared the same way. A contact is
  only visible to: the rep who owns/created it, their department manager,
  the account's designated Account Manager, or an admin.

So if someone can't see a contact, check who owns it and whether the
person asking is that owner, that account's manager, or an admin.

**Fix**
- If the visibility is correct per the rule above, no fix needed — explain
  the rule to whoever's asking.
- If a contact genuinely needs to be visible to someone who should
  legitimately handle it, reassign its **Owner** field (or the parent
  Account's Account Manager) rather than trying to force broader read
  access.

**Prevention**
When creating a contact, make sure its **Owner** is set correctly from
the start — that's what determines who can see and manage it later.

---

## 3. The app looks out of date after an update was uploaded to GitHub

**Symptom**
`index.html` was updated and pushed to GitHub, but the app (especially on
a phone that has it "installed" as a PWA) still shows the old version.

**Cause**
The service worker (`sw.js`) caches the app shell for offline use. If its
`CACHE_VERSION` string wasn't bumped when `index.html` changed, browsers
keep serving the cached (old) copy instead of fetching the new one.

**Fix**
1. Confirm `CACHE_VERSION` in `sw.js` was incremented (e.g.
   `"mechatrade-v17"` → `"mechatrade-v18"`) whenever `index.html` changes.
2. On the affected device: close the app fully and reopen it (the service
   worker checks for updates on activate), or do a hard refresh in a
   regular browser tab.
3. If it's still stuck, uninstall and reinstall the PWA, or clear site
   data as in Issue #1.

**Prevention**
Always bump `CACHE_VERSION` in the same update that changes `index.html`.
(This is already the habit going forward — every file handed over should
have this done automatically.)

---

## 4. "No supplier marked as winner" / Proceed to Product Costing doesn't do what's expected

**Symptom**
Clicking "Create Product Costing" from an inquiry gives an unexpected
toast message, or pulls in the wrong supplier's items.

**Cause**
Proceed to Costing reads the **Winner tick(s)** in each supplier's "Items
quoted" checklist on the inquiry — not the totals, not a "lowest price"
badge. If:
- No item has a Winner ticked → it'll tell you to tick one before
  proceeding.
- Winners are ticked across **more than one supplier** → it automatically
  opens one costing sheet per contributing supplier, one after another,
  each pre-filled with just that supplier's winning items.

**Fix**
Open the inquiry, check the "Items quoted" list per supplier, and make
sure the intended Winner boxes are ticked for every item before
proceeding.

**Prevention**
Tick Winners as you go while canvassing, rather than leaving it for later
— it also drives the highlighting in the Item List Inquiry table so you
can see at a glance if anything's unticked.

---

## 5. GitHub's "Upload files" hangs forever on "Uploading 1 of 2 files"

**Symptom**
Dragging `index.html` (and `sw.js`) into GitHub's web upload box gets stuck
indefinitely with the progress bar frozen — tried different browsers,
disabled extensions, logged out and back in, nothing helped.

**Cause**
`index.html` had three logo images embedded directly as base64 text inside
`<img>` tags and a JS constant. Each of those turned into a single line
roughly 100,000 characters long. The file itself was small and completely
valid, but GitHub's browser-based upload widget tries to process/render
the file before committing, and pathologically long single lines are a
known way to make that client-side step hang — even though total file
size was nowhere near any real limit.

**Fix**
The three logos were pulled out into their own files —
`logo-lockup.png`, `logo-mark.png`, `logo-print.png` — referenced normally
(`<img src="./logo-lockup.png">`) instead of embedded as base64 text. This
dropped the longest line in the file from ~100,000 characters to under
300, and cut the file from ~749 KB to ~420 KB. The upload widget works
normally after this change.

**Prevention**
Don't embed large images as inline base64 in `index.html` going forward —
add new logos/images as their own files in the repo and reference them
with a normal relative path.

---

## How to add a new entry

When something new comes up, bring it back to a conversation with Claude
along with:
- What you were doing right before it happened
- The exact error message or screenshot, if there is one
- What you expected to happen instead

Ask Claude to add it to this file in the same **Symptom → Cause → Fix →
Prevention** format, then re-download the updated file. Claude doesn't
automatically remember past conversations by default, so keep this file
as your master copy and upload it back in whenever you want it added to —
that way nothing gets lost between sessions.
