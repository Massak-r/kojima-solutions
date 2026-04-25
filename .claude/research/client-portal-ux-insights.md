# Client Portal UX Research: Insights, Pitfalls & Best Practices

> Compiled from agency best practices, tool analysis (Basecamp, Monday.com, Figma, InVision, ClientPoint), and common web designer/developer complaints. For use as a foundation for future UX/UI improvements.

---

## 1. Top Client Frustrations

### "I don't know what to do"
The #1 complaint. Clients log in and see a dashboard of information but nothing tells them what action is expected. They browse, feel overwhelmed, and leave without acting. Every screen must answer in 5 seconds: **Do I need to do something? If yes, what?**

### "I already answered that"
When approvals or feedback are scattered across multiple channels (email, WhatsApp, portal), clients feel like they're repeating themselves. The portal must be the single source of truth with a visible log of all past decisions.

### "I'm afraid of making the wrong choice"
Clients freeze when presented with options without context. They need: (a) a clear recommendation, (b) the ability to change their mind later, (c) reassurance that choosing a direction doesn't mean final commitment.

### "I don't know where my project stands"
Clients want a single glance to understand overall progress. Not percentages or Gantt charts, but a clear narrative: "We're working on the design. You'll see it in 3 days."

### "Too many notifications, I stopped reading them"
Portals that send emails for every status change train clients to ignore all notifications. Reserve notifications for actions that truly need client input.

### "I gave feedback but nothing changed"
When clients submit feedback and don't see acknowledgment or a timeline for when changes will appear, they lose trust in the portal.

---

## 2. The "Ball in Court" Principle

The most effective pattern from agency research. At any moment, the project ball is in one of two courts:

**Client's turn:**
- There are open approval gates, pending feedback requests, or documents awaiting signature
- The portal shows: "Votre tour" with a clear count of pending actions
- Color: amber/blue (attention-grabbing but not alarming)

**Agency's turn:**
- All client actions are resolved, the team is working
- The portal shows: "Notre tour" with what's being worked on and when the client will next be needed
- Color: green (reassuring, no action needed)

This single indicator eliminates 80% of client confusion. They know instantly whether to act or wait.

---

## 3. Common Web Designer/Developer Complaints

### The "too many cooks" problem
- Multiple stakeholders give conflicting feedback
- Nobody has final decision authority
- **Solution:** Designate one decision-maker per project. Others can comment, but only one person can approve/reject. Show all comments, gate the approval action.

### Version confusion
- Client references "the version I saw last Tuesday"
- **Solution:** Sequential version labels (v1, v2, v3) with dates. Never overwrite. Always show what changed between versions.

### Unclear responsibility
- Both sides think the other is doing something
- **Solution:** Explicit status naming the responsible party. "En attente de votre retour" vs "Nous travaillons dessus." Never passive voice.

### Feedback scattered across channels
- Client sends notes via email, WhatsApp, phone, and portal
- **Solution:** The portal is the single source of truth. When feedback arrives elsewhere, the admin adds it to the portal and tells the client "I've logged your feedback here: [link]."

### "Looks good" feedback
- Client approves without actually reviewing
- **Solution:** Guided review with specific questions: "Does the color palette match your brand?" "Is the contact information correct?" Checkboxes force engagement.

### Clients ignoring requests
- No deadline, no consequence, no urgency
- **Solution:** Review deadlines with gentle escalation. "Please review by [date]. After this date, we'll proceed with the current version." Makes inaction a conscious choice.

### Scope creep via casual requests
- "Can you also add..." in a comment thread
- **Solution:** Distinguish between feedback (included in scope) and change requests (may affect budget/timeline). Make the distinction visible.

---

## 4. Design Patterns That Work

### Single-page hub with drill-down
A landing page answering three questions, with drill-down for details:
1. What's the status of my project?
2. Do I need to do anything?
3. What happened since I last checked?

### Progressive disclosure (3 levels)
- **Level 1 (glanceable):** Project status, pending actions, next milestone
- **Level 2 (scannable):** Timeline with milestones, recent activity, deliverable previews
- **Level 3 (detailed):** Full files, comment threads, approval history, version history

### The "one big button" pattern
When the client lands, the primary action is a single prominent CTA. Not a list of 5 things. ONE thing. The most urgent one.

### Traffic light system
- Green: nothing needed from you
- Yellow/amber: review requested
- Red: blocking the project, action needed now

### Binary approval buttons
Always present two clear options:
- "Approuver" (with specific scope: "Approve the homepage header design v3")
- "Demander des modifications" (requires a comment explaining what to change)
- Optional third: "J'ai besoin d'en discuter" (prevents false approvals/rejections)

### Guided feedback forms
Instead of open text fields, use:
- Specific questions with checkboxes
- Rating scales for subjective items
- Required comment only for "request changes"
- Optional open comment for "approve"

### Approval audit log
Every decision timestamped and attributed: "Jane Doe a approuve 'Design page d'accueil v3' le 15 mars 2026." Prevents "I never approved that."

---

## 5. Decision-Making UX

### Limit options to 2-3
Never present more than 3 options. Cognitive overload kills decision-making.

### Always recommend one
Indicate which option you recommend and why. Clients want expert guidance, not a buffet. Mark it clearly: "Recommande par l'equipe."

### Show consequences of each choice
"Option A: timeline stays the same. Option B: adds 1 week." Helps clients make informed decisions.

### Make choosing feel safe
"This isn't final. You can refine after choosing a direction." Reduces decision paralysis.

### Side-by-side comparison
For visual decisions (design directions), always show options side by side, not one at a time. On mobile, stack vertically but keep both visible without scrolling away.

---

## 6. Revision Management

### Show the counter early
"This project includes 3 rounds of revisions. This is revision 1 of 3." Matter-of-fact, not punitive.

### Define what counts as a revision
"A revision round is one batch of collected feedback, not each individual change."

### Don't use punitive language
Instead of "You've used all your revisions" say "Additional revisions are available at [rate]. Want to proceed?"

### Encourage batching
"Please gather all stakeholder feedback before submitting, so we can address everything in one round."

---

## 7. Notification Strategy

### Tier notifications by urgency
- **Immediate (email + portal):** Action required from client (approval, feedback, decision)
- **Informational (portal only):** Status update, deliverable uploaded, comment added
- **Digest (weekly email):** Summary of project activity

### Each notification answers: "What do I need to do?"
Bad: "A new comment was added to your project"
Good: "Action requise : Choisissez votre direction graphique (echeance : 3 jours)"

### Deep-link to the exact action
Every notification links directly to the action, not the dashboard. Client clicks and sees the decision page, not a list of everything.

---

## 8. Mobile-First Patterns for Client Portals

- Action buttons minimum 48px height (touch-friendly)
- Image comparisons stack vertically, full width
- Collapsible sections to reduce scroll fatigue
- Swipe gestures for image galleries (embla-carousel)
- Bottom-sticky action bar for approval/revision buttons
- Simplified labels on mobile ("PDF" instead of "Telecharger le PDF")

---

## 9. Anti-Patterns to Avoid

- **Exposing internal terminology:** "Sprint 3 Review" means nothing to clients. Use "Etape 3 : Design"
- **Forcing account creation:** Magic links or email verification only. Never passwords.
- **Showing empty states:** If a section has no content, hide it entirely. Don't show "No items yet."
- **Auto-playing anything:** No auto-play videos or animations. Clients are busy.
- **Hiding critical actions behind tabs:** If the client needs to approve something, it must be at the top level.
- **Multiple progress indicators:** One source of truth for progress. Not "80% complete" in one place and "3/7 gates approved" in another.
- **Stale content:** If nothing changed since last visit, show "Aucune nouvelle activite. Prochaine etape prevue le [date]."

---

## 10. Tools & References

- **Basecamp:** Master of simplicity. Everything is a message or a to-do. Clients see only shared content.
- **Monday.com:** Status columns with clear visual states. Forms for structured input.
- **Figma:** Contextual comments on artifacts. Version comparison.
- **InVision:** Comment directly on designs. Resolve/unresolve threads.
- **ClientPoint:** Digital signatures, approval gates, revision counters.
- **Productive/Teamwork:** Agency-specific with client access levels.

---

*This document serves as a UX foundation for future client portal improvements. Review before any client-facing redesign.*
