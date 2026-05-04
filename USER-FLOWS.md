# User Flows

---

## Guest

As a guest I should be able to view the homepage, which shows a search bar, a Word of the Day tile, recent concept cards, and community stats (published variants, registered users, variants this month).

As a guest I should be able to click any concept card on the homepage to go to that concept's detail page.

As a guest I should be able to search for words using the homepage search bar or by clicking Browse, both of which take me to the Concepts page with ranked results.

As a guest I should be able to browse all published concepts from the Concepts page, which shows each concept's Pashto word, English gloss, variant count, and an example sentence.

As a guest I should be able to click a concept card to go to its detail page, where I see the concept's English gloss and part of speech, and all published variants grouped by Pashto word. Variants that share the same Pashto word are shown as one card with a region tab strip — clicking a region tab shows that region's phonetic, definition, and example.

As a guest I should be able to click Register in the navbar to go to the Register page.

As a guest I should be able to click Login in the navbar to go to the Login page.

---

## User

As a user I should be able to register with a username, email, and password. I can optionally add my region (Kohat, Hangu, Tirah, Thal, or Parachinar) and village.

As a user I should be able to log in with my email and password. My session should survive a page refresh — I should not be logged out when I reload the browser.

As a user I should be able to view all the same pages a guest can.

As a user I should be able to go to the Submit page to submit a new entry. The form has two steps: Step 1 asks for the English gloss with live autocomplete suggestions from existing concepts; Step 2 asks for the Pashto word, phonetic, region, definition, and example.

As a user I should be able to submit a new concept and its first variant together. After submission both are placed in the pending state awaiting a moderator.

As a user I should be able to submit a new variant for an existing concept by selecting it from the autocomplete in Step 1, then completing Step 2 for my variant.

As a user, on any concept detail page, I should be able to click "+ I also say this in my region" on a variant card. If I am not logged in, it takes me to the login page. Once logged in, it takes me to the Submit page pre-filled with the concept and Pashto word so I only need to fill in my region, phonetic, definition, and example.

As a user I should not be able to submit a concept whose English gloss already exists — the autocomplete and server both prevent duplicates.

As a user I should not be able to submit a variant with the same Pashto word and region under the same concept — the server rejects it with a clear message. However, the same Pashto word from a different region is allowed.

As a user, in Step 2 of the Submit form, I can optionally add a note to the moderators — such as a book reference, page number, or link — to help them verify the word. This note is visible to moderators and admins in the moderation queue but is not shown on the public concept detail page.

As a user I should be able to view My Submissions, which lists all my submitted concepts and variants with their current status (pending, approved, rejected, or published). If an item is rejected, the moderator's rejection reason is shown beneath the status badge.

---

## Moderator

As a moderator I should be able to log in and access the Dashboard. Refreshing the page should not log me out.

As a moderator I should be able to see the Moderation Queue with two tabs: Concepts and Variants.

As a moderator I should only see items in the pending state. I cannot see approved items because I have no publish action — approved items are waiting for an admin.

As a moderator I should be able to approve a pending concept, which moves it to the approved state and writes a ModerationLog record.

As a moderator I should be able to reject a pending concept with a note, which moves it to the rejected state and writes a ModerationLog record.

As a moderator I should be able to approve a pending variant. Each variant card shows the Pashto word, phonetic, region, definition, example, the parent concept's English gloss and status, and who submitted it (username, village, region).

As a moderator I should be able to reject a pending variant with a note.

As a moderator I should be able to view the Concepts list page in the dashboard.

As a moderator I should not be able to access the Users or Log pages — those are admin-only.

As a moderator I should be able to reject a pending item by clicking Reject, which opens a modal requiring me to type a reason before confirming. The reason is stored and shown to the submitter in their My Submissions page.

As a moderator I should be able to edit any submission that was not submitted by me, at any point in its lifecycle, using the Edit button on the queue card. The inline form opens pre-populated with the current values. A note explaining the edit is required before saving. The item updates in place; its moderation status does not change.

As a moderator I should see a "Similar concepts" panel on each concept card in the queue, populated by the suggest endpoint using that concept's English gloss. If a match is found I can click "Merge into this" to open a confirmation modal, enter a note, and merge the pending concept into the existing one. All variants are moved to the target; the source concept is soft-deleted.

As a moderator I should be able to trigger a merge from the Concepts list page in the dashboard, not only from the queue.

---

## Admin

As an admin I should be able to do everything a moderator can do.

As an admin I should see a Pending / Approved filter toggle above the moderation queue list. Moderators do not see this toggle. Each filter button shows a count so I know how many items are waiting at each stage.

As an admin I should be able to switch to the Approved filter to see all approved concepts and variants that are ready to publish.

As an admin I should be able to publish an approved concept or variant, which moves it to the published state and writes a ModerationLog record. Once published, variants appear on the public Concepts and Concept Detail pages.

As an admin I should be able to view the Users page in the dashboard, which lists all registered users.

As an admin I should be able to view the Moderation Log page, which shows a full audit trail of every status transition — submitted, approved, rejected, published, resubmitted, edited, merged, profile_updated — with the actor's username, timestamp, and for edited entries, the before/after field values.

As an admin I should be able to edit any submission including my own, using the same inline Edit form available to moderators.

As an admin I should be able to reassign a variant to a different concept by using the Concept search field inside the variant Edit form. Suggestions show the concept's English gloss and ID. Selecting one and saving moves the variant to the new concept in place.
