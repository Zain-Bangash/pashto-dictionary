# User Flows

---

## Guest

As a guest I should be able to view the homepage, which shows a search bar, a Word of the Day tile, recent concept cards, and community stats (published variants, registered users, variants this month).

As a guest I should be able to click any concept card on the homepage to go to that concept's detail page.

As a guest I should be able to search for words using the homepage search bar or by clicking Browse, both of which take me to the Concepts page with ranked results.

As a guest I should be able to browse all published concepts from the Concepts page, which shows each concept's Pashto word, English gloss, variant count, and an example sentence.

As a guest I should be able to click a concept card to go to its detail page, where I see the concept's English gloss and part of speech, and all published variants grouped by Pashto word. Variants that share the same Pashto word are shown as one card with a region tab strip — clicking a region tab shows that region's phonetic, definition, and example.

As a guest, a concept's detail page also shows any extra field values admins have defined: concept fields under the concept heading, and variant fields in each region's panel. Fields an admin has deactivated are not shown.

As a guest, under each regional variant on a concept page I can expand a "Forms" list showing the word's grammatical forms (for example masculine plural direct, or past tense), each with its Pashto text, phonetic and example sentence. Searching for any form's Pashto text, such as a plural, finds the word.

As a guest I should be able to click Register in the navbar to go to the Register page.

As a guest I should be able to click Login in the navbar to go to the Login page.

---

## User

As a user I should be able to register with a username, email, and password. I can optionally add my region and village. The region dropdown shows the current region list maintained by admins — the same list used on the Submit form — and the server rejects a region that is not active.

As a user I should be able to log in with my email and password. My session should survive a page refresh — I should not be logged out when I reload the browser.

As a user, if I enter an incorrect email or password on the Login page, I stay on the page and see a visible error message ("Invalid email or password"). My entered email stays in the field, and the message clears when I start typing again. Other failures, such as too many attempts, show the server's message in the same place.

As a user I should be able to view all the same pages a guest can.

As a user I should be able to go to the Submit page to submit a new entry. The form has two steps: Step 1 asks for the English gloss with live autocomplete suggestions from existing concepts; Step 2 asks for the Pashto word, phonetic, region, definition, and example.

As a user, the Submit form also shows any extra fields admins have added: concept fields when I create a new concept, and variant fields in Step 2. Fields not marked optional are required, and I cannot submit until they are filled. These fields are not required when I resubmit an existing entry.

As a user, in Step 2 of the Submit form, if the concept is a noun or adjective I can add gendered forms (masculine/feminine × singular/plural × direct/oblique); if it is a verb I can add infinitive, past, present and imperative forms. Each form needs its Pashto text; phonetic and an example are optional. I cannot add the same form twice, and other parts of speech have no forms.

As a user I should be able to submit a new concept and its first variant together. After submission both are placed in the pending state awaiting a moderator.

As a user I should be able to submit a new variant for an existing concept by selecting it from the autocomplete in Step 1, then completing Step 2 for my variant.

As a user, on any concept detail page, I should be able to click "+ I also say this in my region" on a variant card. If I am not logged in, it takes me to the login page. Once logged in, it takes me to the Submit page pre-filled with the concept and Pashto word so I only need to fill in my region, phonetic, definition, and example.

As a user I should not be able to submit a concept whose English gloss already exists — the autocomplete and server both prevent duplicates.

As a user I should not be able to submit a variant with the same Pashto word and region under the same concept — the server rejects it with a clear message. However, the same Pashto word from a different region is allowed.

As a user, in Step 2 of the Submit form, I can optionally add a note to the moderators — such as a book reference, page number, or link — to help them verify the word. This note is visible to moderators and admins in the moderation queue but is not shown on the public concept detail page.

As a user I should be able to view My Submissions, which lists all my submitted concepts and variants with their current status (pending, approved, rejected, or published). If an item is rejected, the moderator's rejection reason is shown beneath the status badge.

As a user, if an admin rejects my published concept or variant, it disappears from the public site and shows as rejected with the admin's note in My Submissions. If my variant was rejected because its concept was rejected, the note says so. I can edit and resubmit it, and it goes through normal review again (pending → approved → published). The resubmit form includes the entry's extra fields and grammatical forms, so I can fix, add or remove those too.

As a user I cannot change the forms of my pending or published variant — the server rejects it. To add forms to a published word, I ask an admin, who adds them through the Edit form while the word stays published.

---

## Moderator

As a moderator I should be able to log in and access the Dashboard. Refreshing the page should not log me out.

As a moderator I should see the Moderation Queue as a single list of concepts. Each concept row shows its status and a "N variants waiting" toggle. Clicking anywhere on the concept row, or on the toggle, expands or collapses a dropdown listing that concept's variants awaiting review. Clicking the row's Approve, Reject, Publish, or Edit buttons does not toggle it.

As a moderator I should not be able to approve a variant while its concept is still pending. The variant's Approve button is disabled with the hint "Approve the concept first", and the server rejects the attempt with a 400. Once the concept is approved, its variants can be approved.

As a moderator, when a variant is submitted for a concept that is already approved or published, I still see the concept as a row in the queue with that variant in its dropdown. The concept row has no Approve/Reject buttons, and only the variant can be acted on.

As a moderator I should only see items in the pending state. I cannot see approved items because I have no publish action — approved items are waiting for an admin.

As a moderator I should be able to approve a pending concept, which moves it to the approved state and writes a ModerationLog record.

As a moderator I should be able to reject a pending concept with a note, which moves it to the rejected state and writes a ModerationLog record.

As a moderator I should be able to approve a pending variant from its concept's dropdown. Each variant row shows the Pashto word, phonetic, region, definition, example, and who submitted it (username, village, region). The parent concept's English gloss and status are shown on the concept row above it.

As a moderator I should be able to reject a pending variant with a note.

As a moderator I should be able to view the Concepts list page in the dashboard.

As a moderator I should not be able to access the Users, Log, Lists, or Fields pages — those are admin-only. The server returns 403 if a moderator or user calls the list-editing endpoints.

As a moderator I should be able to reject a pending item by clicking Reject, which opens a modal requiring me to type a reason before confirming. The reason is stored and shown to the submitter in their My Submissions page.

As a moderator I should be able to edit any submission that was not submitted by me and is not yet published, using the Edit button on the queue card. The inline form opens pre-populated with the current values, including any extra fields. A note explaining the edit is required before saving. The item updates in place; its moderation status does not change. Changes to extra fields appear in the edit's Moderation Log diff under the field's name. If the server rejects the edit, its message is shown in the form.

As a moderator, each concept row and variant row in the queue shows the entry's extra field values, so I can review them without opening the Edit form. Variant rows also have a collapsible Forms list.

As a moderator, the variant Edit form includes the variant's grammatical forms, which I can add, change or remove. Each changed form appears in the Moderation Log diff under its name (for example "form (Masculine plural, direct)"). If the concept's part of speech changed after forms were added, forms that no longer match are labelled so I can remove them; the server only rejects new or changed forms that do not match.

As a moderator I should see a "Similar concepts" panel on each concept card in the queue, populated by the suggest endpoint using that concept's English gloss. If a match is found I can click "Merge into this" to open a confirmation modal, enter a note, and merge the pending concept into the existing one. All variants are moved to the target; the source concept is soft-deleted.

As a moderator I should be able to trigger a merge from the Concepts list page in the dashboard, not only from the queue.

As a moderator, when I reject a concept, all of that concept's pending, approved, or published variants are automatically rejected and removed from the variant queue. Each variant's submitter sees "Concept "X" was rejected: <reason>" in My Submissions and can resubmit. This prevents orphaned variants from accumulating in the queue after their parent concept is discarded.

As a moderator I cannot edit or reject a published concept or variant — only admins can. The server rejects the attempt with a 403.

As a moderator or admin, after I approve, reject, or publish an item, the moderation queue automatically refreshes from the server to reflect the latest state — including any cascade effects from concept rejection.

---

## Admin

As an admin I should be able to do everything a moderator can do.

As an admin I should see a Pending / Approved filter toggle above the moderation queue list. Moderators do not see this toggle. Each filter button shows a count of concepts plus variants, so I know how many items are waiting at each stage.

As an admin, the Pending / Approved filter applies to concepts and their variants together. Under Approved, I see every concept that is approved or has approved variants, with only the approved variants in its dropdown. A variant's Publish button stays disabled with the hint "Publish the concept first" until its concept is published.

As an admin I should be able to switch to the Approved filter to see all approved concepts and variants that are ready to publish.

As an admin I should be able to publish an approved concept or variant, which moves it to the published state and writes a ModerationLog record. Once published, variants appear on the public Concepts and Concept Detail pages.

As an admin I should be able to view the Users page in the dashboard, which lists all registered users.

As an admin I should be able to view the Moderation Log page, which shows a full audit trail of every status transition — submitted, approved, rejected, published, resubmitted, edited, merged, profile_updated — with the actor's username, timestamp, and for edited entries, the before/after field values.

As an admin I should be able to edit any submission including my own, using the same inline Edit form available to moderators.

As an admin I should be able to reassign a variant to a different concept by using the Concept search field inside the variant Edit form. Suggestions show the concept's English gloss and ID. Selecting one and saving moves the variant to the new concept in place.

As an admin, I cannot publish a variant whose parent concept has not yet been published. If I attempt to do so, I see an error message. I must publish the concept first, then publish its variants.

As an admin, on the dashboard Concepts page, I can click a published concept's row (or its Manage button) to expand it. The panel shows the concept's published variants, and both the concept and each variant have Edit and Reject buttons. Moderators do not see the Manage button and cannot expand rows.

As an admin I can edit a published concept or variant from that panel using the same inline Edit form as the queue. A note is required, the item stays published, and an `edited` ModerationLog record is written.

As an admin I can reject a published concept from that panel. The Reject modal requires a reason and warns how many variants will also be rejected. On confirm, the concept leaves the public site, every one of its variants is rejected with the note "Concept "X" was rejected: <reason>", and the Concepts list refreshes.

As an admin I can reject a single published variant from that panel with a required reason. It disappears from the panel and the public concept page, and its submitter sees the reason in My Submissions.

As an admin I can open Lists in the dashboard to manage the region and part-of-speech lists. I can add a value, rename its label, and move it up or down. Renaming a label changes how it appears on every existing entry immediately. Each change writes a `lookup_changed` record to the Moderation Log.

As an admin I can deactivate a value I added. It disappears from the Submit, Register, and edit dropdowns, but existing entries that use it still show it, and they can still be edited as long as that value is not changed. I can reactivate it later. Built-in values (the original five regions and six parts of speech) cannot be deactivated, and no value can ever be deleted.

As an admin I can open Fields in the dashboard to add a text, long-text, or dropdown field to concepts or variants. I can rename a field, mark it required or optional, and reorder it. Making a field required only affects new submissions. Each change writes a `field_changed` record to the Moderation Log.

As an admin I can deactivate a field. It disappears from the forms, entry pages and queue, but the values already entered are kept and come back if I reactivate it. For dropdown fields I can add, rename, deactivate and reactivate options, but I cannot deactivate the last active option. Entries that already use a deactivated option keep it. No field or option can ever be deleted.
