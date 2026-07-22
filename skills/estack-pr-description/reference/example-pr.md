# Canonical example PR: buildpurdue-website, final body

This is the settled description for this example PR, reached after three rounds of feedback from the maintainer (Karthik) and the PR author (Elliot). It is the canonical worked example of the numbered merged "What changed and why" format the skill teaches: bold end-state lines, labeled Key decision / What changed sub-bullets, exact-scope verification with a post-merge checklist, and numbered open calls. Match its shape when writing a real description; the content below is specific to that PR.

---

This reworks how author profile info gets edited, and it starts moving people onto the `contacts` table. It's one step toward #145.

## What changed and why

1. **Author links are ordinary profile fields now.**
   - **Key decision:** keep them editable by every signed-in user instead of gating the inputs behind authorship, because the gate never protected anything and #145 wants person facts living in one place. Accepted cost: non-authors can edit links that never display anywhere.
   - **What changed:** website, Twitter, and Instagram moved into the Profile details form. The standalone author settings section and its edit endpoint (the PATCH on `/api/settings/author`) are deleted. The one-click claim POST stays, and it still derives the slug on the server so nobody can type their own.

2. **The claim prompt is a banner at the top of signed-in pages.**
   - **Key decision:** a banner on the dashboard, settings, and admin pages instead of a card inside settings, because a prompt you have to go find doesn't get acted on.
   - **What changed:** one shared component renders on all three surfaces. It only shows for a signed-in admin who is credited on a published post and hasn't claimed their page yet. For everyone else it renders nothing.

3. **Profile saves mirror the shared facts to the member's contact row.**
   - **Key decisions:** start mirroring now instead of waiting for the full #145 consolidation, so the two copies of this data stop drifting in the meantime. And the sync guards instead of trusts: it won't take over a contact that belongs to another account, and a blank form field never erases existing contact data, because admins edit the same rows and a member's save must not clobber their work.
   - **What changed:** on save, major, grad year, and LinkedIn copy to the linked contact row. A member with no contact gets one created by email, tagged "members" and opted into every email preference, the same as signup. If that email's contact belongs to a different account, the save stops with an error before anything is written. The contact write runs before the user profile update, so a failure partway through can't leave a half-saved profile. Blank fields are skipped, so the sync can change a contact fact but never clear one (clearing waits for #145).

4. **Tests cover the new paths.** Route tests for the claim endpoint and the contact sync, plus unit tests for when the banner should show. No decision here, just coverage.

## Verification

I manually tested the author flow by making myself an author: published a blog post, promoted my account to author, and accepted the author page. All of it worked as intended. That is the only functionality tested by hand, nothing else.

Still to check by hand right after merge:

1. Sign in as an eligible author and confirm the banner shows up on the dashboard, on settings, and on an admin page.
2. Click "Claim my author page" from the banner and confirm the page goes live and the banner disappears.
3. Save the profile form and confirm major, grad year, and LinkedIn land on that member's contact row.
4. Confirm a normal member with no matching byline never sees the banner.

## Database / migrations

None. Every column we write already exists in production on `users` and `contacts`, so merge order can't break anything. No migration, no backfill. The bigger users-to-contacts move stays in #145.

## Open calls for Karthik

1. Fine that any signed-in user can edit the author links (public display is still gated), or should editing itself be limited to authors?
2. The banner shows on the dashboard, settings, and every admin page. Right set of pages, or should I add or drop any?
3. When the email conflict hits, we return an error telling the user to ask an admin. OK as an interim, or do you want an admin merge flow built now instead of leaving it to #145?
4. Because the sync skips blank fields, the form can change a contact's major / grad year / LinkedIn but can't clear it. OK for now, or do you want a way to clear a contact fact from the member form?
5. On a first save with no contact, we create one fully opted in ("members" tag + all email preferences), same as signup. Intended, or should a contact created this way start untagged or unsubscribed?

Refs #145.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
