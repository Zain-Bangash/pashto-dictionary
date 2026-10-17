# User Flows

---

## Guest

As a guest I should be able to view the homepage, which shows a search bar, a Word of the Day tile, recent concept cards, and community stats (published variants, registered users, variants this month).

As a guest I should be able to click any concept card on the homepage to go to that concept's detail page.

As a guest I should be able to search for words using the homepage search bar or by clicking Browse, both of which take me to the Concepts page with ranked results.

As a guest I should be able to browse all published concepts from the Concepts page. Each card shows the English meaning with the part of speech, then the Pashto word, an example sentence in Pashto and how many regional words it has, with a count of matching concepts above the grid. When the concept has other written words besides the one shown, the word carries "+ 1 more word" or "+ n more words"; the same word used in several regions counts once, and with a region selected only that region's words count. If the word has a published recording, a Listen button on the card plays it without opening the page, and if its example sentence has one, a small play button beside the example plays that. The same cards are used for Recent Words on the homepage, and the Word of the Day has a Listen button only when its word has a published recording (and a play button beside its example when that has one).

As a guest I should be able to click a concept card to go to its detail page, where I see the concept's English gloss and part of speech, and all published variants grouped by Pashto word. Variants that share the same Pashto word are shown as one card with a region tab strip — clicking a region tab shows that region's phonetic, definition, and example (shown in Pashto, right to left).

As a guest, on a wide screen a concept page shows the concept (meaning, part of speech, how many words and regions it has, domains, details and submitter) in a column on the left that stays in view while I scroll the words on the right. On a phone it sits above the words.

As a guest, the Concepts page shows region pills above the domain pills. Picking one shows only concepts that have a published word from that region (in search results too), and each card shows that region's word. Picking it again clears it, "Clear filters" resets search, region and domain together, and the choice stays in the URL.

As a guest, a concept's detail page shows its domains (for example "Food & cooking") as chips under the heading. Clicking one takes me to the Concepts page filtered to that domain.

As a guest, the Concepts page shows the active domains as pills under the search bar. Picking one narrows the list (and search results) to concepts in that domain; picking it again clears the filter. The choice stays in the URL, so a filtered page can be shared. With no domains defined, the pills are hidden.

As a guest, a word on a concept page shows "Also means: fence (Hangu, Tirah) · side (Kohat)" when the same written word is published under other concepts, each linking to that concept, with the regions that use it that way. Spellings that differ only by vowel marks or by Arabic/Urdu keyboard letters (ك for ک, ہ for ه) count as the same word. Words under review are not listed.

As a guest, a concept's detail page also shows any extra field values admins have defined: concept fields under the concept heading, and variant fields in each region's panel. Fields an admin has deactivated are not shown.

As a guest, under each regional variant on a concept page I can expand a "Forms" list showing the word's grammatical forms (for example masculine plural direct, or past tense), each with its Pashto text, phonetic and example sentence. Searching for any form's Pashto text, such as a plural, finds the word.

As a guest, a regional variant on a concept page has a play button beside the word when a published recording exists, with "Recorded by <username> (village, region)" under it. The example sentence works the same way: a play button beside it and "Example recorded by <username> (village, region)" under it. Recordings of grammatical forms are listed in the region's panel, each with its text, a play button and the speaker's credit. If my device cannot play a recording's format (for example an older iPhone and a WebM clip), I see "Can't play on this device" instead of a broken button. Recordings that are still under review are never played to me.

As a guest, clicking "Record a pronunciation" on a concept page takes me to the Login page.

As a guest, a form in a word's Forms list that was suggested by someone other than the word's submitter shows "Added by <username> (village, region)" under it. Forms the submitter added themselves, including every form added before suggestions existed, carry no separate credit.

As a guest, clicking "+ Suggest forms" under a word on a concept page takes me to the Login page.

As a user, a published word on a concept page shows "+ Suggest forms" when its part of speech has grammatical forms (noun, adjective, verb) and some of its form slots are still empty. It opens an inline editor where I can add any empty slot; slots the word already has cannot be picked. On sending, I see "Thanks — your forms will appear here once they are reviewed". A moderator reviews my suggestion and an admin publishes it; the word itself is unchanged until then. If I already have a suggestion under review for that word, the card says "Your suggestion for this word is under review" instead. I can suggest only grammatical forms for someone else's word — the server refuses phonetic, example or extra fields from anyone but the word's submitter. Several people can have a suggestion open on the same word at once, but I can have only one per word.

As a guest I can open Wanted from the navbar. It has two tabs, Words and Audio; switching tab keeps my region and search. Each tab has region pills (one region is always selected), a search box, a part-of-speech filter and the domain pills; every filter stays in the URL, changing one returns to page 1, and the list is paginated.

As a guest, the Words tab lists published concepts that have no word yet in the selected region — any submitted word for that region, even one under review or rejected, removes the concept from the list. I can search by English meaning. Each concept is a dropdown, closed at first, showing how many words it has elsewhere; opening it lists the words already published for it in other regions, the same spelling shown once with every region that uses it ("Hangu · Tirah"), or "No words yet". Clicking "Add your [Region] word" (on the closed row) or "Also spoken in [Region]" (beside a word) sends me to log in, then straight back to the Submit page.

As a guest, the Audio tab lists concepts whose published words in the selected region have no recording of the word, or of the example sentence when there is one. A recording under review counts as covered, since nobody can record that slot until its review ends; recordings of grammatical forms are not listed. I can search by English meaning, Pashto (spellings that differ only by vowel marks or keyboard letters still match) or phonetic, and narrow by what is missing (All, Word, Example). Each concept is a dropdown listing its words with their example and gold "+ Word" / "+ Example" chips. Clicking a chip sends me to log in, then to the concept page with the recorder open.

As a guest I should be able to click Register in the navbar to go to the Register page.

As a guest I should be able to click Login in the navbar to go to the Login page.

---

## User

As a user I should be able to register with a username, email, and password. I can optionally add my region and village. The region dropdown shows the current region list maintained by admins — the same list used on the Submit form — and the server rejects a region that is not active.

As a user I should be able to log in with my email and password. Once I log in I stay logged in on this browser for up to 30 days: reloading, opening the site in a new tab, or closing and reopening the browser keeps me logged in. After 30 days I log in again.

As a user, while the site checks my session on load, protected pages wait instead of briefly sending me to the Login page.

As a user, if my session has expired or been revoked, the next action that needs me to be logged in takes me to the Login page.

As a user, when I log out in one tab, every other open tab of the site logs out too and shows the guest navbar; a tab on a protected page takes me to the Login page.

As a user, if I enter an incorrect email or password on the Login page, I stay on the page and see a visible error message ("Invalid email or password"). My entered email stays in the field, and the message clears when I start typing again. Other failures, such as too many attempts, show the server's message in the same place.

As a user I should be able to view all the same pages a guest can.

As a user I should be able to go to the Submit page to submit a new entry. The form has two steps: Step 1 asks for the English gloss with live autocomplete suggestions from existing concepts; Step 2 asks for the Pashto word, an optional recording of it, phonetic, region, definition, and example.

As a user, when I create a new concept on the Submit form I can pick up to 10 domains (optional) from the admin-maintained list. When I edit and resubmit a rejected concept I can change them too. After that, only an admin can change a concept's domains.

As a user, a Pashto word I submit counts as a duplicate of an existing word for the same concept and region even if it differs only by vowel marks, zero-width characters or Arabic/Urdu keyboard letters, and searching with any of those spellings finds the word.

As a user, the Submit form also shows any extra fields admins have added: concept fields when I create a new concept, and variant fields in Step 2. Fields not marked optional are required, and I cannot submit until they are filled. These fields are not required when I resubmit an existing entry.

As a user, in Step 2 of the Submit form, if the concept is a noun or adjective I can add gendered forms (masculine/feminine × singular/plural × direct/oblique); if it is a verb I can add infinitive, past, present and imperative forms. Each form needs its Pashto text; phonetic and an example are optional. I cannot add the same form twice, and other parts of speech have no forms.

As a user I should be able to submit a new concept and its first variant together. After submission both are placed in the pending state awaiting a moderator.

As a user I should be able to submit a new variant for an existing concept by selecting it from the autocomplete in Step 1, then completing Step 2 for my variant.

As a user, each word card on a concept page keeps its actions in a "Contribute" column on the right (a row under the word on a phone): "Record a pronunciation", "Record the example" (when the region's word has an example sentence), "+ I also say this" and "+ Suggest forms" (when forms can be added). "Record the example" opens the recorder with the example sentence picked; while someone's example recording is under review it is replaced by "A recording of the example is under review". Opening one shows its panel under the card and closes any other; switching region tab closes it.

As a user, on any concept detail page, I should be able to click "+ I also say this" on a variant card. If I am not logged in, it takes me to the login page. Once logged in, it takes me to the Submit page pre-filled with the concept and Pashto word so I only need to fill in my region, phonetic, definition, and example.

As a user, "Add your [Region] word" on Wanted Words opens the Submit page at Step 2 with the concept and region already filled in. "Also spoken in [Region]" also fills in the Pashto word and its phonetic, so I only need to add the definition and anything else I know. Both Wanted tabs default to my own region.

As a user, a "+ Word" or "+ Example" chip on Wanted Audio opens the concept page on that region's word, scrolled into view, with the recorder already open on the word or the example sentence.

As a user I should not be able to submit a concept whose English gloss already exists — the autocomplete and server both prevent duplicates.

As a user I should not be able to submit a variant with the same Pashto word and region under the same concept — the server rejects it with a clear message. However, the same Pashto word from a different region is allowed.

As a user, in Step 2 of the Submit form, once I have typed the Pashto word I can optionally record how it is said (or upload a recording), with the same time limit, preview and discard as on a concept page. It is sent for review together with my word and appears under Recordings in My Submissions. If I change the word after recording, I am told the recording may no longer match. If the recording fails to upload, my word is still submitted and I can try again, record again, or continue without it.

As a user, in Step 2 of the Submit form, once I have typed an example sentence I can record it the same way, just under the example field (up to 20 seconds). Both recordings are sent for review with my word. If I change the example after recording, I am told the recording may no longer match; if I clear the example but keep its recording, I am asked to type the example or discard the recording before submitting. If one recording fails to upload, only that one is offered for retry. Grammatical forms can be recorded once the word is published.

As a user, in Step 2 of the Submit form, I can optionally add a note to the moderators — such as a book reference, page number, or link — to help them verify the word. This note is visible to moderators and admins in the moderation queue but is not shown on the public concept detail page.

As a user I should be able to view My Submissions, which lists all my submitted concepts, variants and recordings (and the forms I suggested for other people's words) with their current status (pending, approved, rejected, or published). If an item is rejected, the moderator's rejection reason is shown beneath the status badge.

As a user, My Submissions opens with a row of totals (Pending, Approved, Published, Rejected) across everything I have submitted, then one collapsible section each for Concepts, Variants, Recordings and Forms you suggested. All sections start closed. Each header shows how many I have and, in red, how many were rejected; a section loads its list only when I open it. Clicking a total opens every section that has submissions in that status, already filtered to it. If the totals cannot be loaded the sections still work, just without counts.

As a user, if an admin rejects my published concept or variant, it disappears from the public site and shows as rejected with the admin's note in My Submissions. If my variant was rejected because its concept was rejected, the note says so. I can edit and resubmit it, and it goes through normal review again (pending → approved → published). The resubmit form includes the entry's extra fields and grammatical forms, so I can fix, add or remove those too.

As a user I cannot change the forms of my pending or published variant directly — the server rejects it. To add forms or other missing details to a published word, I use the Edit button or a "Needs" chip on its My Submissions card.

As a user, if someone else adds the same word for the same concept and region while mine is rejected, resubmitting mine shows a clear message asking me to change the word or region.

As a user, My Submissions has a "Needs completion (n)" chip. It lists my published words that are missing a phonetic, an example, any grammatical forms (where the part of speech allows them) or an optional extra field, and shows what each one needs as gold "+ Forms" / "+ Example" chips; clicking a chip opens the edit form. I can narrow the list by the missing detail and by region; the region filter also works on my whole list. Words whose forms are only partly filled are not counted, but show a quiet "Forms 2/8" beside the region, and "Forms: some empty" in the filter finds them.

As a user, every section has status chips (All, Pending, Approved, Published, Rejected, with how many are in each; a status I have none of is hidden) and is paginated, 5 to a page; changing a filter returns to page 1. Concepts can also be searched by English gloss and filtered by part of speech. Variants can be searched by Pashto, phonetic, definition or English gloss, filtered by region, and narrowed to "Needs completion" (which is always published words, so it replaces the status filter). Recordings can be filtered by type (words, example sentences, forms) and also by replaced or withdrawn. A filter that matches nothing says so.

As a user, My Submissions has a "Forms you suggested" section listing the forms I suggested for other people's words, each with the word, its concept (linking to the concept page), the forms I proposed and the suggestion's status. If one was rejected I see the moderator's note and can edit and resubmit its forms while the word is still published. The section is hidden when I have none.

As a user, each My Submissions card shows the Pashto word, the definition in italics and the region, with its status and a bordered Edit button (pencil icon) at the top right. On a published word, Edit and the gold "Needs" chips open the same form; on a rejected entry the button reads "Edit & Resubmit"; on a word whose suggestion was rejected it reads "Edit & resubmit suggestion"; while a suggestion is pending or approved there is no button, only its status and the comparison. It shows my word's Pashto, phonetic, definition and example sentence already filled in, plus inputs for blank custom fields and forms; forms I already have are shown but cannot be picked again. Where I change a value, "Current: …" shows what it is now, and only the fields I changed are sent. If I changed nothing I see "Change at least one detail". My word stays live and unchanged while a moderator reviews my suggestion and an admin publishes it. The row then shows "Suggestion pending" or "Suggestion approved", with my changes as old → new and the word's other details underneath. If it is rejected, I see the moderator's note and the same comparison, and can edit and resubmit it. I can have only one open suggestion per word myself. Suggestions other people send for my word do not appear on my row. Only I can propose new Pashto, phonetic, definition or example for my word; everyone else can only suggest forms.

As a user, if my word changed after I wrote my suggestion (for example an admin edited it), the row warns me that the word has changed, and an admin must edit or reject the suggestion before it can be published. Resubmitting takes the word's current values.

As a user, on any published word I can click "Record a pronunciation", including words other people added. I pick what I am recording: the word, the example sentence (only if it has text), or any grammatical form the part of speech allows, even a form with no text yet. The recorder shows the Pashto text I should say and a time limit (longer words and the example get more time, up to 10 seconds for a word and 20 for an example). Recording stops by itself at the limit. I can listen back, discard it and record again, then submit it for review.

As a user, if my browser cannot record, or I deny the microphone, I am told so and can upload a recording instead (WebM, M4A, MP3 or Ogg such as a WhatsApp voice note, up to 1 MB). The server checks the real length of the file; a recording that is too long, too short, not audio, or in another format is refused with a message.

As a user, if someone's recording for the same word and slot is already under review, that slot is marked "under review" and I cannot pick it until the review ends. A slot that already has a published recording can still be recorded again; mine waits for review beside the current one and replaces it only if an admin publishes it.

As a user, My Submissions lists "Your recordings" with each one's status (pending, approved, published, rejected, replaced or withdrawn), a play button while it is under review or live, and the moderator's note if it was rejected. I can withdraw a recording that is still pending. A rejected recording is final; to try again I record a new one.

As a user, when I edit and resubmit my rejected word, if my change alters text that has recordings (the word, the example, or a form) I am warned which recordings will be removed, and nothing is saved unless I confirm.

---

## Moderator

As a moderator I should be able to log in and access the Dashboard. Refreshing the page or opening the Dashboard in a new tab should not log me out.

As a moderator, the Dashboard Overview is my to-do list: "Entries to review", "Suggestions to review" and "Recordings to review", each with the number waiting and a link to that queue. When nothing is waiting it says "All caught up". Below it are the totals of concepts and words by status. The Queue item in the dashboard menu shows a gold badge with the number of items waiting for me, and each queue tab shows its own count; both update after every action.

As a moderator, on a phone the dashboard menu is a scrolling row of tabs above the page instead of a sidebar, and queue action buttons sit under each item.

As a moderator, every queue tab (Entries, Suggestions, Audio) has a search box (English gloss, Pashto word or phonetic), a region dropdown and a submitter username box. Spellings that differ only by vowel marks or keyboard letters still match. The filters are kept in the page address, so refreshing or sharing the link keeps them, and switching tab keeps them too. Clicking a submitter's name on any item filters the queue to that person. "Clear filters" resets them. With filters set and no results I see "Nothing matches these filters."

As a moderator, each queue item has a checkbox and the toolbar has "Select all on this page". With items selected, a bar at the bottom offers "Approve selected", "Reject selected…" and "Clear". Each item is sent separately, concepts before their words, so every one is checked by the state machine and logged. Items that fail (for example my own submission, or a word whose concept is still pending) stay selected and are listed with the reason; the rest go through. Bulk reject asks for one note that is sent with every item; words under a concept rejected in the same run are not sent again, because rejecting the concept already rejects them. A concept listed only because of its words (it is not itself waiting, or does not match the filters) has no checkbox, so selecting one person's spam never touches someone else's concept. My own recordings have no checkbox.

As a moderator, after approving, rejecting, publishing, editing or merging I see a short message at the bottom of the screen ("Approved “house”", "Approved 5 items; 1 failed"). A failed single action shows a red message above the list that I can dismiss.

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

As a moderator I cannot edit any entry, at any status — editing is admin-only. I approve, or reject with a note. The queue shows no Edit button, and the server returns 403 if I call an edit endpoint.

As a moderator, each concept row and variant row in the queue shows the entry's extra field values, so I can review them without opening the Edit form. Variant rows also have a collapsible Forms list.

As an admin, the variant Edit form includes the variant's grammatical forms, which I can add, change or remove. Each changed form appears in the Moderation Log diff under its name (for example "form (Masculine plural, direct)"). If the concept's part of speech changed after forms were added, forms that no longer match are labelled so I can remove them; the server only rejects new or changed forms that do not match.

As a moderator I see a "Similar concepts" panel on each pending concept card in the queue, populated by the suggest endpoint using that concept's English gloss, so I can spot duplicates. Only an admin sees the "Merge into this" button, which opens a confirmation modal; after entering a note the pending concept is merged into the existing one. All variants are moved to the target; the source concept is soft-deleted.

As an admin I can also trigger a merge from the Concepts list page in the dashboard. Moderators see no Merge button, and the server returns 403 if they call the merge endpoint.

As a moderator, the Moderation Queue has Entries and Suggestions views. Entries is the queue described above. Suggestions lists words that have pending suggestions, oldest first, 20 words per page. Each word shows its concept, Pashto, region, definition and submitter, and a "N suggestions" toggle (open by default). Inside, a table lists every proposed form slot with each person's proposal side by side: a slot two or more people proposed is marked "Conflict", and a slot the word has since filled is marked "Already filled". Below it each suggestion is listed with every proposed value next to its blank current value and "Proposed by <username>" (with "(the word's submitter)" when it is). I can approve one, or reject it with a note, but not one I submitted myself. Only one proposal per slot can be published; the others are refused at publish, so I reject the losers with a note. I cannot edit a suggestion — only admins can.

As a moderator, the Moderation Queue also has an Audio view listing pending recordings. Each row shows the word, its region and concept, the slot and the Pashto text the speaker should be saying, the recording's length and who recorded it. When a recording would replace a published one, the current and the replacement recordings are shown side by side and both can be played. I can approve one, or reject it with a note; I cannot review a recording I made myself (the buttons are disabled and the server returns 403).

As a moderator, a recording sent with a new word appears in the Audio queue straight away, marked "Word pending" (or "Word approved"), and I can approve or reject it before the word is reviewed. If the word or its concept is rejected, the recording is rejected too.

As a moderator, when I reject a concept, all of that concept's pending, approved, or published variants are automatically rejected and removed from the variant queue. Each variant's submitter sees "Concept "X" was rejected: <reason>" in My Submissions and can resubmit. This prevents orphaned variants from accumulating in the queue after their parent concept is discarded.

As a moderator I cannot reject a published concept or variant — only admins can. The server rejects the attempt with a 403.

As a moderator or admin, after I approve, reject, or publish an item, the moderation queue automatically refreshes from the server to reflect the latest state — including any cascade effects from concept rejection.

---

## Admin

As an admin I should be able to do everything a moderator can do.

As an admin I should see Pending / Approved filter chips above each queue. Moderators do not see them. Each chip shows the count for the current filters, so I know how many items are waiting at each stage. The Overview also lists "Entries / Suggestions / Recordings to publish" linking to the Approved view, and the Queue badge counts approved items too. Under Approved, the bulk bar offers "Publish selected" and "Reject selected…".

As an admin, the dashboard Concepts page filters by status with chips (All, Pending, Approved, Published, Rejected); All really lists every status. Search waits until I pause typing and keeps the list (and my cursor) on screen while it loads, and the list is paginated.

As an admin, the Pending / Approved filter applies to concepts and their variants together. Under Approved, I see every concept that is approved or has approved variants, with only the approved variants in its dropdown. A variant's Publish button stays disabled with the hint "Publish the concept first" until its concept is published.

As an admin I should be able to switch to the Approved filter to see all approved concepts and variants that are ready to publish.

As an admin I can reject an approved concept, variant or suggestion with a required note instead of publishing it. Rejecting an approved concept also rejects its variants. Moderators get a 403.

As an admin, the Suggestions view has its own Pending / Approved filter with counts. Publishing an approved suggestion fills the blank fields of the live word and logs a `suggestion_applied` entry with the diff. If the word changed so the suggestion no longer fits — a field was filled meanwhile, or the part of speech no longer allows its forms — the publish is refused with the field named, and I can edit or reject the suggestion. I can edit pending and approved suggestions; a suggestion from someone other than the word's submitter stays forms-only. When I edit a form's text, the contributor's credit stays on that form.

As a moderator or admin, the Suggestions queue shows each changed field of an edit as old → new (Pashto, phonetic, definition or example), with the word's unchanged details underneath, and warns me when the word changed since the suggestion was written. Approving such a suggestion is refused while that applies.

As an admin, publishing an edit suggestion replaces the live Pashto, phonetic, definition or example, is refused if the new Pashto would duplicate another word of the same concept and region, and logs each field's before and after. In the queue I can edit a suggestion's proposed Pashto and definition as well as its other fields.

As an admin, a published word with open suggestions shows "Suggestion pending" (or "N open suggestions") with a link to Suggestions in the Concepts panel, and its Edit form locks every field any of them proposes until they are resolved. Other fields stay editable.

As an admin, when I reject or delete a published word, any open suggestion on it is rejected automatically with a note naming the cause.

As an admin, the Audio view has its own Pending / Approved filter with counts. Publishing an approved recording makes it live on the concept page; if it replaces a published recording, the old one is retired and its audio deleted. A recording sent with a new word cannot be published until its word is published: its Publish button is disabled with "Publish the word first", and the server refuses it with that message. I can reject an approved recording with a note. Moderators cannot publish.

As an admin, a published word in the Concepts panel lists its live recordings with play buttons and a Remove button; removing one needs a note and takes it off the site.

As an admin, when I reject or delete a published word, recordings under review for it are rejected automatically. Its published recordings are hidden while the word is off the site and come back if it is republished with the same text.

As an admin, if an edit would change text that has recordings — the word's Pashto, the example (including clearing it), a form's Pashto or removing a form, the concept's part of speech, a merge, or moving the variant to a concept with a different part of speech — I see a warning listing the recordings that will be removed and who recorded them. Nothing is saved unless I confirm; on confirm the recordings are retired, their audio is deleted and each removal is logged. Filling in a form that had no text keeps its recording.

As an admin, the Moderation Log includes recordings (filter type "Recording"): submitted, approved, rejected, published, retired and withdrawn, each labelled with the word and slot, plus an `audio_published` entry on the word itself saying whether a recording was added or replaced.

As an admin I should be able to publish an approved concept or variant, which moves it to the published state and writes a ModerationLog record. Once published, variants appear on the public Concepts and Concept Detail pages.

As an admin I should be able to view the Users page in the dashboard, which lists registered users 20 per page with Previous / Next controls.

As an admin, each user row on the Users page has a "Make moderator" button and each moderator row a "Remove moderator" button. Clicking one opens a confirmation dialog with an optional note; nothing changes until I confirm. The row then shows the new role, the change applies on that person's next request, and a `role_changed` entry (with the note, if any) appears in the Moderation Log under their username. Admin rows and my own row have no button: admin roles can only be changed in the database, and the server returns 400 if anyone tries.

As an admin I should be able to view the Moderation Log page, which shows a full audit trail of every status transition — submitted, approved, rejected, published, resubmitted, edited, merged, profile_updated, suggestion_applied, role_changed — with the actor's username, timestamp, and for edited, suggestion_applied and role_changed entries, the before/after values. I can filter by the Suggestion type; suggestion entries are labelled with the word they complete.

As an admin I can edit any pending, approved or published submission, including my own, with the inline Edit form on the queue card. The form opens pre-populated with the current values, including any extra fields. A note explaining the edit is required before saving. The item updates in place; its moderation status does not change. Changes to extra fields appear in the edit's Moderation Log diff under the field's name. If the server rejects the edit, its message is shown in the form. Rejected entries cannot be edited by anyone on staff — the server returns 400 — because only the submitter can fix and resubmit them.

As an admin I should be able to reassign a variant to a different concept by using the Concept search field inside the variant Edit form. Suggestions show the concept's English gloss and ID. Selecting one and saving moves the variant to the new concept in place.

As an admin, I cannot publish a variant whose parent concept has not yet been published. If I attempt to do so, I see an error message. I must publish the concept first, then publish its variants.

As an admin, on the dashboard Concepts page, I can click any concept's row that is not rejected (or its Manage button) to expand it. For a published concept the panel shows its published variants, and both the concept and each variant have Edit and Reject buttons. For a pending or approved concept it shows the variants still under review (rejected ones are hidden) with Edit only; approving, rejecting and publishing stay in the queue. Rejected concepts cannot be expanded. Moderators do not see the Manage button and cannot expand rows.

As an admin I can edit a concept or variant from that panel using the same inline Edit form as the queue. A note is required, the item keeps its status, and an `edited` ModerationLog record is written.

As an admin I can reject a published concept from that panel. The Reject modal requires a reason and warns how many variants will also be rejected. On confirm, the concept leaves the public site, every one of its variants is rejected with the note "Concept "X" was rejected: <reason>", and the Concepts list refreshes.

As an admin I can reject a single published variant from that panel with a required reason. It disappears from the panel and the public concept page, and its submitter sees the reason in My Submissions.

As an admin, the concept Edit form has the domain pills, so I can add or remove domains on any pending, approved or published concept; the change appears in the edit's Moderation Log diff as "domains". When I merge a concept, the target gains the source's domains and the merge log entry lists them. Moderators cannot change domains.

As an admin I can open Lists in the dashboard to manage the region, part-of-speech and domain lists. I can add a value, rename its label, and move it up or down. Renaming a label changes how it appears on every existing entry immediately. Each change writes a `lookup_changed` record to the Moderation Log. No domain is built in: I can rename, reorder or deactivate every one. A deactivated domain disappears from forms and the browse filter but stays on the concepts that already have it.

As an admin I can deactivate a value I added. It disappears from the Submit, Register, and edit dropdowns, but existing entries that use it still show it, and they can still be edited as long as that value is not changed. I can reactivate it later. Built-in values (the original five regions and six parts of speech) cannot be deactivated, and no value can ever be deleted.

As an admin I can open Fields in the dashboard to add a text, long-text, or dropdown field to concepts or variants. I can rename a field, mark it required or optional, and reorder it. Making a field required only affects new submissions. Each change writes a `field_changed` record to the Moderation Log.

As an admin I can deactivate a field. It disappears from the forms, entry pages and queue, but the values already entered are kept and come back if I reactivate it. For dropdown fields I can add, rename, deactivate and reactivate options, but I cannot deactivate the last active option. Entries that already use a deactivated option keep it. No field or option can ever be deleted.
