- this is related to one of the system insttuctions: We need to add a clause that, in the active clarification question (like after the flag), I need to have all the info I need. If I just look at that section, I'll be able to answer the question. I've noticed that the AI has been putting content in the body and then asking questions about it in the footer. That doesn't work. Assume the user can only look at the body and the footer independently of each other. 

---

# issue 1:

## Transcript excerpt: ```
assistant 1: "Exactly right. Now you've got the concept.

=== ACTIVE QUESTION ===

**Question 4** — What is the total cash collected in March?

| | January | February | March | April |
|---|---|---|---|---|
| Total sales | $50,000 | $60,000 | $40,000 | $30,000 |

Collection pattern: 35% same month, 45% one month later, 20% two months later.

Based on what we just covered — which months' sales contribute to March cash collections, and what percentage applies to each? Don't calculate yet, just identify the months and their rates."
user 1: "40,000 times 35% plus 45% times 60,000 plus 20% times 50,000"
assistant 2: "Perfect setup — and that gives you $51,000, so the answer is D.=== ACTIVE QUESTION ===

**Question 5**

Fiwrt Corporation manufactures and sells stainless steel coffee mugs. Expected mug sales (in units) for the next three months are as follows:

| | October | November | December |
|---|---|---|---|
| Budgeted unit sales | 30,000 | 36,000 | 34,000 |

Fiwrt likes to maintain a finished goods inventory equal to 30% of the next month's estimated sales. How many mugs should Fiwrt plan to produce during the month of November?

- A) 35,400 mugs
- B) 26,800 mugs
- C) 36,000 mugs
- D) 34,300 mugs"
user 2: "34000*0.3 (30% of the next month's estimated sales) + 36000*0.7 (mugs to produce in Nov for sales this month assuming he produced 30% of the mugs already in October) = how many mugs he should produce in November"
assistant 3: "You landed on the right number (35,400 = A), but the reasoning has a conceptual gap that will hurt you on a different version of this question. Let me diagnose it.

You said "36,000 × 0.7 = mugs to produce for this month's sales, assuming 30% were already made in October." That logic doesn't hold — the production budget doesn't work by splitting a month's sales between what was pre-built and what gets built now.

The correct framework is a formula your professor uses explicitly:

> **Required Production = Budgeted Sales + Desired Ending Inventory − Beginning Inventory**

Think of it like a stock shelf. At the start of November you already have some mugs sitting there (beginning inventory). By the end of November you need a fresh buffer sitting there (ending inventory). And in between, you need to sell 36,000.

So the question becomes: how many do you need to *make* in November to make all that work?

Before I show you the full setup, answer this:

=== CLARIFICATION QUESTION ===

Using the production budget formula above:

1. What is the desired **ending inventory** for November, and how do you know?
2. What is the **beginning inventory** for November, and how do you know?"
```
# Issue description and intended behavior:
- I didn't like the behavior in assistant message three. What I didn't like is how it told me just what the correct formula was. It identified that I had a conceptual issue, which was a really good job. It did everything correctly there, but what it missed was that it didn't correctly start a teaching segment. It identified that I had a gap, but it didn't teach me. It instead resorted to just telling me the one tiny detail that I needed to know that I missed and then was going to move on. It should have launched into a full teaching session to teach me that whole concept. 