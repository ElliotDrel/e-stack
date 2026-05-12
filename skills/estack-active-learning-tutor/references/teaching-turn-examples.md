# Teaching Turn — Worked Examples

Three fully written example Teaching turns. Read these before your first teaching segment so the shape of a good Teaching turn is concrete in context.

Each example shows:
- The active question (header only — for example purposes; not part of the teaching turn body)
- The student's prompt that triggered the teaching turn
- The teaching turn body, written as an actual response
- A "why this passes the success criterion" annotation

The success criterion (from `SKILL.md` TURN TYPES > Teaching): a peer who never saw the active question could read the body in isolation and learn the concept fully. Every sentence is concept-general — applicable to any analogous problem on this concept.

---

## Example 1 — MCQ logical-trap, cold start ("teach me X")

<active-question> *(for context only — does not appear in the teaching turn body)*

> Which of the following describes the choice a risk-averse decision-maker would make?
>
> A) Always choose the prospect with the highest expected value, regardless of variance.
> B) Always choose the prospect with the lowest variance, regardless of expected value.
> C) Among prospects with the same expected value, choose the one with the lowest variance.
> D) Among prospects with the same variance, choose the one with the lowest expected value.

</active-question>

<student-prompt>
"idk teach me risk"
</student-prompt>

<teaching-turn-body>

### Risk preferences

In decision theory, **risk preferences** classify how a decision-maker trades expected value against the variability of outcomes. Three preference types describe how a person ranks gambles whose payoffs differ in spread.

- **Expected value (EV)** is the probability-weighted average of the possible payoffs of a prospect. EV measures the *center* of the distribution.
- **Variance / standard deviation (SD)** measures the *spread* of the payoffs around the EV. In risk theory, variance is the standard quantitative proxy for "how risky" a prospect is.
- **Risk-averse** decision-makers experience the spread as a cost. Given two prospects with the *same* expected value, a risk-averse person prefers the one with lower variance. Given two prospects with the *same* variance, they prefer the one with higher expected value. The ordering is: lower spread is better, all else equal.
- **Risk-neutral** decision-makers care only about expected value. They are indifferent to variance and rank prospects purely by EV.
- **Risk-loving** decision-makers experience the spread as a benefit. Given equal EV, they prefer higher variance.

**Formula sketch.** Expected value of a prospect with payoffs `x_i` and probabilities `p_i`:

```
EV = Σ p_i · x_i
```

Variance of the same prospect:

```
Var = Σ p_i · (x_i − EV)²
```

Standard deviation is the square root of variance and lives in the same units as the payoffs.

**The trap to watch for.** The defining behavior of risk-aversion is conditional: it is the choice between prospects of **equal expected value**. Many exam questions describe a risk-averse person and offer gambles with *different* expected values, betting that the student will assume "risk-averse means always pick the lower variance." That is a stronger claim than the definition — risk-aversion does not mean ignoring EV. A risk-averse person can still take a higher-variance gamble if the expected value gain is large enough.

**Quick illustrative scenario** *(invented, not the active question's setup):*

A risk-averse investor faces two assets. Asset Q yields $200 for sure. Asset R yields $400 with probability 0.5 and $0 with probability 0.5. EV of Q = $200; EV of R = $200. The variance of Q is 0; the variance of R is positive. A risk-averse investor picks Q.

</teaching-turn-body>

<annotation>
The body never references the active question's option labels (A, B, C, D), never narrates "the trap" relative to the active question's specific options, and never says "the answer is C." The illustrative scenario uses different names ($200/$400, Asset Q/R) than anything in the active question. A peer who never saw the active question could read this and independently identify which option captures the risk-averse rule.
</annotation>

---

## Example 2 — Multi-step calculation, wrong attempt

<active-question> *(for context only)*

> A company expects March sales of 1,200 units. Its policy is to hold ending finished-goods inventory equal to 25% of next month's sales. Beginning March inventory was 280 units. April sales are forecast at 1,400 units. How many units must be produced in March?

</active-question>

<student-prompt>
"I tried 1,200 + 280 = 1,480. That's wrong, isn't it? I'm lost."
</student-prompt>

<teaching-turn-body>

### Production budget

The **production budget** answers a single question: how many units does a manufacturer have to *produce* in a given period to (a) satisfy the period's sales and (b) leave the desired ending inventory on hand for the next period? Inventory at the start of the period reduces the production requirement; desired inventory at the end of the period adds to it.

- **Budgeted unit sales** are the units forecast to be sold during the period. They are the "demand" the budget must meet.
- **Desired ending finished-goods inventory** is the policy-driven cushion the firm wants on hand at the close of the period. A common policy is "X% of next period's budgeted sales," because future sales drive future production lead times.
- **Beginning finished-goods inventory** is the units on hand at the start of the period, carried over from the prior period's ending inventory. Those units are already produced — they reduce what production must contribute this period.

**The formula:**

```
Production (units) = Budgeted sales (units)
                   + Desired ending inventory (units)
                   − Beginning inventory (units)
```

**Why the formula has that shape.** Sales drain inventory; production refills it. To end with the desired cushion, the firm needs to produce enough to (1) replace what sales took, and (2) build the cushion up to (or down to) the desired ending level. Beginning inventory is a head start — units already on the shelf don't have to be produced.

**The trap to watch for.** Two patterns trip students up:

1. Confusing "ending inventory of *this* period" with "next period's sales." The policy is usually expressed as a percentage of *next period's* sales, but the policy is referring to the inventory at the *end of this period*. The percentage of next period's sales gives you the ending-inventory-this-period number directly.
2. Adding rather than subtracting beginning inventory. Beginning inventory is already on hand — it's a credit against required production, not an addition to it.

**Quick illustrative scenario** *(invented values):*

A bakery forecasts August sales of 600 cakes. Its policy is to hold ending inventory equal to 30% of September's forecast sales. September sales are forecast at 800 cakes. Beginning August inventory is 150 cakes.

- Desired ending inventory = 30% × 800 = 240 cakes.
- Production = 600 (sales) + 240 (desired ending) − 150 (beginning) = **690 cakes**.

</teaching-turn-body>

<annotation>
The body teaches the production-budget formula without using March, April, 1,200, 1,400, 280, or 25%. It explains both the structure of the formula and the two most common mistakes (one of which the student just made — adding beginning inventory instead of subtracting it). The student now has the conceptual material to redo the active question themselves. The illustrative scenario uses August/September/cakes/600/800/150 — entirely different values.
</annotation>

---

## Example 3 — "I don't get it" cold start, calculation-heavy concept

<active-question> *(for context only)*

> A project costs $50,000 today and is expected to return $18,000 per year for 4 years. The firm's required rate of return is 9%. What is the project's NPV?

</active-question>

<student-prompt>
"I don't get it. What even is NPV?"
</student-prompt>

<teaching-turn-body>

### Net present value (NPV)

**Net present value** is the dollar value today of the future cash flows a project generates, *minus* the cost of the project. It answers: "After accounting for the time value of money, does this project make me richer or poorer?"

- **Time value of money** is the principle that a dollar received in the future is worth less than a dollar today, because today's dollar can be invested. The further out a future dollar is, the less it is worth right now.
- **Discount rate** is the per-period rate used to translate a future dollar into today's dollar. It typically equals the firm's required rate of return — the minimum yield the firm demands of any project given its risk and the firm's cost of capital.
- **Present value of one future cash flow** is that cash flow divided by `(1 + r)^t`, where `r` is the discount rate per period and `t` is the number of periods until the cash flow is received.
- **NPV** sums the present value of every future cash flow the project produces and subtracts the project's up-front cost (which is already in today's dollars and so is not discounted).

**The formula:**

```
NPV = − C₀ + Σ (CF_t / (1 + r)^t),  for t = 1 to N
```

Where:
- `C₀` is the initial investment (a positive number subtracted at the front, or written as a negative cash flow at t=0)
- `CF_t` is the net cash flow received at the end of period `t`
- `r` is the discount rate per period
- `N` is the number of periods over which the project runs

**The decision rule.** A project with **NPV > 0** adds value — the discounted future cash flows more than cover the cost. A project with **NPV < 0** destroys value. A project with **NPV = 0** breaks even at the required rate.

**The trap to watch for.** Two recurring errors:

1. Forgetting to subtract the initial investment. The "P" in NPV is the present *value* of inflows; the "N" (net) is what makes it net of the cost. Computing only the discounted cash inflows gives you PV, not NPV.
2. Discounting the initial investment. The initial cost is paid today (t=0) and is already in today's dollars — it does not get divided by `(1 + r)`.

**Quick illustrative scenario** *(invented values):*

A project costs $1,000 today and pays $600 at the end of year 1 and $700 at the end of year 2. Required rate is 10%.

- PV of year 1 cash flow = 600 / 1.10 = $545.45
- PV of year 2 cash flow = 700 / (1.10)² = $578.51
- NPV = −1,000 + 545.45 + 578.51 = **$123.96**.

The project's NPV is positive, so it adds value at the 10% required rate.

</teaching-turn-body>

<annotation>
The body never uses $50,000, $18,000, 4 years, or 9%. It explains the concept end-to-end (definition, mechanics, formula, decision rule, two common traps) and walks a single 2-period dummy example to make the discounting mechanics concrete. The student now has every piece they need to set up and solve the active question themselves. The illustrative scenario's numbers are deliberately small and clean ($1,000 / $600 / $700 / 10%) to keep arithmetic from competing with the concept.
</annotation>

---

## Pattern summary

Across all three examples, the Teaching turn body:

1. **Names the concept** as a heading.
2. **Defines** the concept and its component pieces.
3. **States the formula** when the concept has one, with variables labeled.
4. **Explains the structure** — why the formula has its shape, what the decision rule is.
5. **Calls out the traps** — the recurring exam mistakes for this concept, framed independently of the active question.
6. **Walks one dummy illustration** (only when the concept benefits from concrete arithmetic; for purely conceptual topics this can be skipped).

What never appears in the body:

- The active question's specific variable values.
- The active question's option labels.
- A sentence that maps a concept piece to the active question ("so for option B, this means...").
- The correct answer or the reasoning chain that distinguishes the correct answer from distractors.

Those moves all belong to the **Scoring turn** that comes after the student attempts.
