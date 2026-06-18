# Active Learning Skill — User Corrections Log
## Session: Practice Exam Walkthrough — Exam 3 (Final)
## Extracted from: `Practice Exam Walkthrough - Exam 3 (Final) - cleaned.json`

---

## Numbered Corrections (in order of appearance)

---

### 1. Teaching output format — first attempt (EARLY SESSION, turns 6–7)

**Verbatim quote:**
> "[SYSTEM UPDATE]
>
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase you understand, reoutput the previous teaching section following these rules:
>
> Notes Formatting & Style for each topic/idea/concept your teaching:
> 1. Start each with a simple headline (e.g., "How do buyers behave").
> 2. Then each include a definition for explanation of what the topic/idea/concept is.
> 3. Every definition and example must be derived directly from the transcript's phrasing. If the professor tells a specific story (e.g., 'the two loans example'), it MUST be included as a distinct bullet point under the relevant topic.
> 4. After that include a bulleted list of any other details, additional notes, or insights that I need to know related to that topic/idea/concept.
> 5. Use short complete-sentence bullets (one idea each); fragments are allowed only for formulas, variable labels, or axis labels.
> 6. Include all formulas/equations (exact equation shown and explained) and graphs (verbally explained).
> 7. Where relevant add step by step procedures or instructions.
> 8. Include any examples that were used in class to better illustrate the topic/idea/concept.
> 9. Include exam traps, common mistakes, and professor reminders based on the lecture or slides (only if relevant).
>
> 1. Where relevant, include interactive displays to better showcase the content and help the user understand.
>
> Additional Criteria:
> * Include all relevant equations and information needed to remember from the examples and class conversation.
> * Place higher priority on the transcript to identify additional ideas, suggestions, tips, tricks, and recommendations made verbally in class that are NOT on the slides!
> *Use both slides and transcripts. Do a slide-by-slide sweep. Do not rely on keyword search only; visually parse every slide (including images).
> * If a term appears in slides but not transcripts, still include it. My goal is zero-miss coverage of slide content.
> * If there is a note in the slides OR lecture that says this will be "on the exam," "will be tested," or anything in that ballpark, ensure the mentioned topic/concept/idea and all related details are included in the notes with the absolute maximum detail to prevent missing content that is explicitly indicated to be assessed.
> * When helpful, add brief Connections bullets that link to related ideas from other provided lecture files/chapters, but keep the overall structure and sequence anchored to the target topic/consept."

**What triggered it:** AI gave a conversational, paragraph-based explanation of quality cost categories without any structured formatting — plain prose with no headlines, definitions, or bullets.

**What the AI did:** Incorrectly dismissed this as a "notes formatting block" that doesn't apply to a practice test session, and ignored the instruction.

**Implied rule:** When teaching any concept during a practice test walkthrough, use structured output format: headline → definition/overview → bulleted details → exam traps, with examples grounded in transcript phrasing.

---

### 2. Teaching output format — second attempt (EARLY SESSION, turn 8)

**Verbatim quote:**
> "[SYSTEM UPDATE]
>
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase you understand, reoutput the previous teaching section following these rules:
>
> [Same full formatting block as above, with title changed from "Notes Formatting & Style" to "Teaching Output Formatting & Style"]"

**What triggered it:** AI rejected the first system update (turn 7 response), claiming it was for note creation and not applicable to the active learning session.

**Implied rule:** Format rules labeled "[SYSTEM UPDATE]" must be applied immediately and must not be dismissed on the grounds that a different session "mode" is active. The user's explicit instructions override any default protocol framing.

---

### 3. Teaching output format — third attempt, with one clarification added (EARLY SESSION, turn 10)

**Verbatim quote:**
> "[SYSTEM UPDATE]
>
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase you understand, reoutput the previous teaching section following these rules:
>
> Teaching Output Formatting & Style for each topic/idea/concept your teaching:
> 1. Start each with a simple headline (e.g., "How do buyers behave").
> 2. Then each include a definition/explanation for explanation of what the topic/idea/concept is.
>   - The purpose of this part is to either say exactly what it is (definition) or provide a high-level overview to ground the user for when you go into more detail in the rest of the section's bullet points
> [remaining rules same as before]"

**What triggered it:** AI had finally complied at turn 9 / index 11 but the definition section was unclear. User restated the rules with a clarification on item 2's purpose.

**Implied rule:** The definition/explanation at the top of each concept section should serve as a grounding overview — either a precise definition or a high-level summary — before the detailed bullet list expands on it.

---

### 4. Use visualize tools instead of ASCII diagrams (MID SESSION, turn 20)

**Verbatim quote:**
> "[SYSTEM UPDATE]
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase you understand, reoutput the previous teaching section following these rules:
> Any time you want to use a visual or diagram use `visualize:read_me` tools."

**What triggered it:** AI used an ASCII art timeline diagram (``` |← Wait Time →| ... ```) to illustrate the order-to-shipment timeline for throughput time.

**Implied rule:** Never use ASCII art or plain-text diagrams. Always route visuals and diagrams through the `visualize:read_me` / `visualize:show_widget` tool pipeline.

---

### 5. All question content must appear BELOW the question flag (MID SESSION, turns 22 and 25)

**Verbatim quote (turn 22):**
> "[SYSTEM UPDATE]
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase your understanding, reoutput the previous response following these rules:
> All content related to a question must be underneath the question flag. Question flag = '=== CLARIFICATION QUESTION ===' or other flags."

**Verbatim quote (turn 25 — re-issued after AI still placed teaching above the flag):**
> "[SYSTEM UPDATE]
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase your understanding, reoutput the previous response following these rules:
> When outputting a question flag, such as a clarification question, or active question, or any other question, make sure to include all question information underneath the question flag"

**What triggered it:** AI placed teaching content (the full concept explanation and diagram) above the `=== CLARIFICATION QUESTION ===` flag, then put only the question numbers below it. The question flag was not the organizing anchor of the response.

**Implied rule:** The question flag (=== ACTIVE QUESTION ===, === CLARIFICATION QUESTION ===, etc.) must always appear BEFORE the content it introduces. Teaching context, setup data, and the question itself all go UNDERNEATH the flag — nothing relevant to the question appears above it.

---

### 6. Teaching must NOT give away the active question's answer (MID SESSION, turn 37)

**Verbatim quote:**
> "[SYSTEM UPDATE — systemupdate tag]
> Please acknowledge and strictly apply the following rules for the remainder of this session. To showcase your understanding, reoutput the previous response following these rules:
>
> 1. Strict Variable Isolation
>
> * The Rule: When teaching a concept triggered by an 'Active Question,' you are strictly prohibited from using the specific data points, dates, names, or values found in that question.
> * The Execution: If the question asks about 'March Cash Collections' with '35/45/20' percentages, your teaching must use an entirely different scenario (e.g., 'August Collections' with '10/60/30' percentages) to explain the mechanic.
>
> 2. The Reciprocation Requirement (Conceptual Check)
>
> * The Rule: Before moving back to the Active Question, you must verify 'Reciprocation.'
> * The Execution: After teaching the concept using 'dummy data,' you must ask a Clarification Question that requires me to apply the logic to a small, separate example. Only once I pass this 'checkpoint' can we proceed to the actual exam question.
>
> 3. Logic Scaffolding vs. Hand-Holding
>
> * The Rule: Do not provide the specific 'setup' for the Active Question's math.
> * The Execution: Instead of saying 'Now, add Jan, Feb, and March together,' ask: 'Based on the collection pattern we just discussed, which months' sales would logically impact the cash hitting the bank in the target month?'
>
> Additional Context: I would like to make a new system update to tell the system to not help the user through the question. This is on top of the already existing instructions that it has to not give the user the answer until the user has been fully taught all the content and has had at least one attempt to complete it.
> The issue that I'm not happy about here is that, in teaching the Cash Collections Schedule, it literally just taught me how to do the answer. That's not a good thing, because I explicitly wanted it to teach me the concepts that I need to know to be able to put two and two together and get the question right. If needed, it can use clarification questions to guide me through the different concepts to ensure that what it taught was reciprocated before having me try the active question again."

**What triggered it:** AI taught the "Cash Collections Schedule" concept by walking through exactly which months contribute to March's collections using the same months as the active question (Jan, Feb, March), effectively giving the student the full solution setup.

**Implied rule (three distinct sub-rules):**
- **Variable isolation:** When teaching a concept triggered by an active question, use entirely different names, dates, and values — never the actual data from the question.
- **Reciprocation requirement:** Before returning to the active question, issue a clarification question with dummy data to verify the concept transferred. Only proceed to the active question after the student passes this checkpoint.
- **Logic scaffolding:** Do not narrate the active question's specific arithmetic setup. Instead, use open questions that require the student to figure out which inputs are needed.

---

### 7. When a concept gap is identified, launch a teaching segment — don't just ask a clarification question (MID SESSION, turn 47)

**Verbatim quote:**
> "You identified a concept gap; however, you didn't launch into a teaching segment. Launch into a teaching session to teach me the concept."

**What triggered it:** AI identified that the student's Q5 answer had a conceptual gap in the production budget logic, but instead of teaching the concept, it jumped straight to a clarification question ("Using the production budget formula above, what is May's desired ending inventory...?").

**Implied rule:** When a concept gap is identified, always respond with a full structured teaching segment first (headline → definition → formula → worked example with dummy data → exam traps), THEN issue a clarification question. Never skip to a question without teaching.

---

### 8. Do not advance to the next question before the student has demonstrated mastery and the teach list is updated (MID SESSION, turn 55)

**Verbatim quote:**
> "Hold on, we can't move on to the next active question. I haven't proved to you that I understand the last question, and you have not updated the teacher list."

**What triggered it:** AI gave the Q5 answer directly after the student's incorrect attempt, then immediately served up Q6 without having the student retry Q5 or verifying mastery, and without updating the teach list.

**Implied rule:** Before advancing to the next question, both conditions must be satisfied: (1) the student must successfully demonstrate understanding of the current concept — either by answering the active question correctly or passing a clarification checkpoint, AND (2) the teach list must be updated to reflect the outcome. Neither step is optional.

---

### 9. Do not give the answer directly after a wrong attempt — require a retry (MID SESSION, turn 55)

**Verbatim quote:**
> "You're absolutely right — my mistake on both counts. You got Q5 wrong on your attempt and I gave you the answer directly instead of having you retry."

*(This is the AI's self-acknowledgment of a rule violation that the user had just called out in turn 55's correction.)*

**What triggered it:** After the student gave an incorrect answer on Q5, AI directly provided the correct calculation and then moved on rather than correcting the conceptual gap and requiring a new attempt.

**Implied rule:** When a student answers incorrectly, do NOT give the correct answer directly. Instead: identify the gap, teach or re-teach the relevant concept, then require the student to retry the active question with a fresh attempt. The answer is only disclosed after the student either answers correctly on a retry or is completely stuck after multiple attempts.

---

### 10. Continue same pedagogical flow from the skill — don't switch to a different mode when a student asks "where did I go wrong" (MID SESSION, turn 71)

**Verbatim quote:**
> "Hey, continue the same flow from the skill if you need to reread the files. You're supposed to teach me in this situation."

**What triggered it:** After the student answered Q7 incorrectly and asked "where did I go wrong," the AI immediately pointed out two errors and gave the correct answer directly, instead of launching a teaching segment followed by a clarification question as the skill protocol requires.

**Implied rule:** When a student asks "where did I go wrong" or similar, do not switch to a debugging/error-pointing mode. Continue the skill's teaching flow: identify the gap, teach the concept with dummy data using the established format, verify reciprocation with a clarification question, then send them back to the active question.

---

### 11. "Output the example, but first teach me the full concept... then use the example, then put the active question" (MID SESSION, turn 96)

**Verbatim quote:**
> "Output the example again, but first teach me the full concept as well as the formula, and then use the example to show you applying it. And then at the end, put the active question for me to try it myself."

**What triggered it:** AI had jumped straight to a step-by-step worked example using dummy data without first explaining the NPV concept and formula from first principles.

**Implied rule:** When teaching a concept for the first time (or when the student requests a re-teach), the response structure must always follow this order: (1) full concept explanation, (2) formula, (3) worked example applying the formula with dummy data, (4) active question for student to attempt. Do not start with the example.

---

## Summary of Distinct Rules

The following is a deduplicated list of the implied rules identified above. These are the changes the skill must encode:

---

### RULE 1 — Teaching output format during walkthrough sessions
All concept teaching (whether spontaneous or in response to "I don't know") must use structured format:
- **Headline** (e.g., "### Prevention Costs")
- **Definition/Overview** — a grounding sentence: either the precise definition, or a high-level overview that sets up the detailed bullets
- **Bulleted details** — short complete-sentence bullets; one idea each
- **Formulas** — exact equation + explanation of each variable
- **Worked examples** (always using dummy data, never the active question's data — see Rule 3)
- **Exam traps / professor reminders** (when relevant)
- **Step-by-step procedures** (where applicable)
- All definitions and examples must be grounded in lecture/transcript phrasing, not generic textbook phrasing
- Where relevant, include interactive displays via the visualize tool pipeline

---

### RULE 2 — No ASCII art or plain-text diagrams
Any visual, timeline, diagram, or chart must be rendered through `visualize:read_me` / `visualize:show_widget`. Never substitute with ASCII art or code-block diagrams.

---

### RULE 3 — Variable isolation: never use active question data when teaching
When teaching a concept that was triggered by an active question (i.e., the student said "I don't know" or answered wrong), the teaching segment MUST use entirely different names, dates, values, and scenarios. The active question's specific numbers, months, company names, and percentages are off-limits until the student is sent back to attempt the question.

---

### RULE 4 — Reciprocation requirement before returning to active question
After teaching a concept with dummy data, always issue a CLARIFICATION QUESTION using additional dummy data (not the active question's data) that requires the student to apply the logic independently. Only after the student passes this checkpoint does the active question get re-served.

---

### RULE 5 — Logic scaffolding: do not narrate the active question's setup
When sending the student back to the active question, do not provide the specific arithmetic setup or tell them which inputs to use. Ask an open question that requires them to figure out the approach ("Based on what we covered, which months contribute to March collections?"), not a guided prompt that does the thinking for them.

---

### RULE 6 — All question content appears BELOW the question flag
The question flag (=== ACTIVE QUESTION ===, === CLARIFICATION QUESTION ===, etc.) is the organizing anchor. Everything related to that question — the question text, data tables, answer choices, and any setup context — appears BELOW the flag, not above it. Nothing should precede the flag except unrelated teaching content from a prior section.

---

### RULE 7 — Identify concept gap → teach → then clarification question (never skip teaching)
When a student gives a wrong answer and a concept gap is identified:
1. Identify the gap explicitly
2. Launch a full structured teaching segment (Rule 1 format)
3. Issue a clarification question with dummy data
4. Only then return the student to the active question

Do not skip step 2 and jump directly to a clarification question. Do not skip step 3 and jump directly back to the active question.

---

### RULE 8 — Never advance until mastery is demonstrated AND teach list is updated
Both conditions must be met before moving to the next question:
1. The student must answer the current active question correctly (either on a first attempt or on a retry after teaching)
2. The teach list must be updated to reflect mastery or non-mastery

Neither condition can be skipped. If the student explicitly asks to defer a question (e.g., "mark as not mastered, move on"), honor that — but still update the teach list.

---

### RULE 9 — Never give the answer directly after a wrong attempt
When a student answers incorrectly, the correct answer is withheld. The flow is:
1. Identify the specific gap(s) in the wrong answer
2. Teach the concept (Rule 1 format, Rule 3 dummy data)
3. Issue a clarification checkpoint (Rule 4)
4. Require a retry of the active question
5. Only if the student is completely stuck after multiple genuine attempts should the answer be disclosed — and even then, always walk through the reasoning fully

---

### RULE 10 — Teach first, then example, then active question (not example-first)
When teaching a concept for the first time or re-teaching it, the structure must be:
1. Full concept explanation (definition + formula + details)
2. Worked example applying the formula with dummy data
3. Active question for the student to attempt independently

Do not open with an example before the concept has been explained.

---

### RULE 11 — "[SYSTEM UPDATE]" instructions must be acknowledged and applied immediately
User instructions labeled [SYSTEM UPDATE] or equivalent override any default protocol. They must not be dismissed on the grounds that a different "mode" is active or that they belong to a different session type. When a formatting or behavior rule is issued mid-session, apply it immediately and confirm understanding by re-outputting the previous response in the new format (as the user requests).

---

*End of corrections log. Total distinct rules: 11.*
