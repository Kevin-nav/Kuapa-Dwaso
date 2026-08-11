# Notes on the Judges' Feedback and Recommended Next Steps

**Kevin Amisom Nchorbuno**
27 July 2026
Working notes for the team. Nothing here is final.

## Where I landed

I have read the judges' comments several times and reviewed what we have actually built. My conclusion is that we are not short on features. Intake, inventory, farmer receipts, buyer orders, dispatch, notifications, payments, disputes and admin oversight all exist in some form.

What is missing is a clear account of how the business physically works, and software that holds people to that account. The judges could not tell what happens to a bag of maize after a farmer drops it off: who owns it, who is liable if it rots, how long it may sit there, or how a warehouse ever pays for itself. That is a genuine gap, and we do not close it by shipping more screens.

The recommendations below are mine. The team still has to choose the first crop, the first communities, the destination market, the first warehouse arrangement, storage periods, grading standards and pricing. I have left those blank deliberately so we can settle them together, with reasons attached.

## 1. Stay with the warehouse and agent model

We should not quietly shrink Kuapa Dwaso into a listings site. The warehouse is the point of the business. It is where trust becomes physical: produce is inspected and accepted, quantity and condition are recorded, the farmer retains ownership while we take documented custody, storage requirements and a safe holding window are set, the produce is monitored while it sits, buyers purchase from stock someone has actually examined, orders are built against real demand, transport custody is signed over, and every cedi of sale, charge, claim and payout traces back to evidence.

Remove that and we are one more app asking farmers to trust a stranger online.

What we should do is narrow the launch hard: one crop, two at most; a handful of communities; one warehouse or aggregation site; one buyer segment; one destination market. We decide those after comparing real supply, real buyer demand, handling requirements, whether storage makes sense for the crop, transport economics and loss risk.

On buyers, the first version should target people who buy repeatedly rather than everyone: market traders, wholesalers, processors, institutions. Repeat orders are what make aggregation and scheduled dispatch viable. Which segment we pursue first is still open.

## 2. Two reasons produce comes to us

We currently treat storage as one thing. It is not. A farmer either wants a quick sale or wants the produce held safely for a period. These are different products with different economics.

**Quick sale.** We record the storage, handling, insurance, transport and service charges and deduct them from the sale proceeds on completion. This cannot mean the produce sits in our shed indefinitely with nobody paying anything. Every crop needs a baseline safe holding window and a defined outcome if it has not sold within it.

Before we accept anything, the farmer must see and acknowledge the sale arrangement, the opening asking price or pricing rule, the charges, the holding window, the review date, what happens if it does not sell, what requires their approval, and when we may deduct.

**Prepaid storage.** For produce that genuinely keeps, and where the farmer wants it held, the farmer should pay for an initial storage period upfront, even if they also intend for us to sell it later. Sold in a defined unit: a week, a month, or whatever suits the crop.

Before the period expires, the farmer can renew, instruct us to sell, collect the produce, approve a further preservation step, or use an exception process if it cannot remain. The app reminds them before the clock runs down. Unpaid charges must never accumulate silently, and no amount of additional payment may keep produce beyond the point where it is safe.

## 3. Every crop needs a storage profile

Before we accept a crop, someone must sign off a profile for it: minimum intake quality, maturity categories, acceptable moisture range where relevant, required packaging, storage method, inspection frequency, baseline safe storage time with warning and critical thresholds and a hard maximum under normal conditions, available preservation options, the conditions that force rejection, sale, withdrawal, processing or disposal, and the evidence an insurer will require if it goes wrong.

The baseline is not an expiry date. The actual next review date may be much sooner depending on how the produce arrived: a batch accepted close to full maturity needs attention sooner than the same crop accepted earlier. The software should derive the next inspection date from the crop policy and the agent's findings, not from a fixed calendar.

We build the first version of these profiles after consulting farmers, buyers, warehouse operators, extension officers, our eventual insurer, and the relevant food safety and plant protection bodies.

## 4. Intake must be built per crop

A single generic form is how we ended up with intake records that say "looks fine." That is useless to us, to the farmer, and to an insurer three weeks later.

The system should ask which crop it is first, present the approved checklist for that crop, and refuse to complete until every required field is answered. Depending on the crop, that may cover maturity stage, whether it is overripe or approaching it, whether it is dry enough or above the safe moisture range, bruising, cuts, cracks or crushing, insect activity or pest damage, mould, rot, disease or off odours, contamination or foreign material, variety, size band, colour or ripeness stage, packaging and bag condition, accepted quantity, rejected quantity with a reason, the required storage method, the baseline storage period, the next inspection date, and any immediate action needed.

Photographs should be mandatory from set angles or stages. The record carries the agent, the warehouse, the time, the scale or measuring equipment used, the farmer's acknowledgement, and anything we turned away.

This gives the agent enough structure to perform a real inspection rather than a guess, and gives us a defensible starting point if the produce later deteriorates.

One related point: Grades A, B and C should summarise recorded observations, not replace them. A grade must trace back to criteria that a buyer and a storekeeper both understand.

## 5. Preservation, handled carefully

For produce such as properly dried grain, offering approved preservation services makes sense and is likely valuable to farmers.

What I am firmly against is agents selecting and applying chemicals on their own judgement. Any treatment or fumigation must be permitted for that crop, that storage method and that intended food use; registered or approved by the appropriate Ghanaian authorities; recommended through an approved storage procedure; applied by a trained and where necessary certified person; used at label dose under the required sealed or controlled conditions; recorded down to product, batch or registration details, quantity, applicator, date, location and reason; supported by the correct protective equipment and safety controls; followed by the required ventilation, re-entry, withholding or release interval; disclosed to the owner and where relevant the buyer; acceptable to our insurer; and closed out with the required inspection, residue or quality check.

Before any of that, we use the non-chemical options: proper drying, cleaning, safe moisture, sealed or hermetic storage, pallets, separation of old and new stock, sanitation, pest monitoring and adequate packaging.

The Ministry of Food and Agriculture's postharvest guidance says much the same: control moisture, monitor regularly, consider hermetic options, and use only recommended food-grade chemicals at label dose with professional advice. Its integrated pest management plan adds registered products, inspection at the storage gate, application records, training, protective equipment and advice from the Plant Protection and Regulatory Services Directorate. The FDA has separately warned aggregators and retailers about unapproved preservation substances and unsafe handling.

In software terms, this means no free-text "chemical used" field. A treatment is an authorised event attached to a batch, with an approval, a named qualified applicator, a checklist, a safety interval, evidence and a follow-up inspection. Buyers cannot receive treated produce until the release condition is met.

Which methods and products we offer is decided crop by crop with qualified and regulatory input, not here.

## 6. Insurance and the limits of our liability

Protection against our own custody failures should be built into warehouse pricing by default, not offered as an optional extra that farmers are nudged into declining. A farmer who saves a few cedis by dropping cover is a farmer who may one day be ruined by our mistake, and we would deserve the reputation that follows.

To be clear, I am not proposing that we pay for every loss out of pocket or cover every possible cause of deterioration. I am proposing that a licensed insurer carries the defined risks while we manage the evidence and run the claim on the farmer's behalf.

Where I believe the lines sit:

- We are responsible for preventable loss in our custody caused by failures of our staff, equipment, security, storage environment, inspection process or response.
- A transporter is responsible for loss in their custody, subject to the transport agreement and cover.
- The farmer carries pre-existing or inherent conditions that were recorded or disclosed, or that we plainly could not have caused.
- The farmer also carries loss where they chose to continue storing against documented advice, subject to the final agreement and the law.
- Named events such as fire or flood fall under whichever policy covers them.
- Anything genuinely unclear goes to a documented investigation.

Even with cover bundled into a single price, the farmer must still be shown what is included, what is excluded, how claim value is calculated, and how to report a problem.

The insurer will need to help us define insurable events, exclusions, required inspection intervals, acceptable storage procedures, evidence standards, notification deadlines, valuation and depreciation, any deductible, who reviews claims, and payment timelines.

All of this depends on the software keeping the chain intact: intake inspection, photographs, accepted and rejected quantities, storage requirements, every scheduled inspection including missed ones, condition changes, responsibility, movements between storage areas, treatments, loading evidence, custody transfers and incident reports.

## 7. Route to owning warehouses

Phased and deliberate.

First, prove the market exists in an area: enough farmers, buyers who return, dispatches that make sense, and margins that survive contact with reality. During that period we operate from a properly assessed leased or partner facility, under our own procedures.

Once a corridor has the evidence, we approach a bank, build our own warehouse there, hire our own manager and agents, and control service quality directly.

```text
Validate farmers, crop, buyers, destination
→ run a pilot from a leased or partner site
→ measure throughput, utilisation, losses, revenue, costs, repeat demand
→ confirm the corridor can carry construction and debt
→ secure financing
→ build and operate our own warehouse
```

Registration numbers in an area are not evidence; plenty of people will sign up for something free. The admin app must tell us whether a corridor is genuinely ready.

## 8. The admin app must explain the business

The judges could see records and operational totals. They could not see whether the company, a warehouse or a corridor is going anywhere. That is fair criticism.

The financial view must keep separate things separate: produce value belonging to farmers, our own revenue, insurance premiums and costs, transport and other pass-through amounts, cash actually received, accrued charges and obligations, payouts owed to farmers, claims and expected recoveries, real operating expenses, and forecasts clearly labelled as forecasts.

At network level: gross produce value processed, revenue by source, gross and contribution margin, cash collected, unpaid receivables, farmer payouts due and paid, premiums and claims, active farmers, repeat buyers, fulfilled orders, rejection, spoilage and shrinkage rates, and average time to pay and to pay out.

Per warehouse or corridor: capacity and average utilisation, throughput, quantities received, sold, withdrawn, spoiled and under claim, revenue and operating cost, contribution margin per unit, per order and per dispatch, cost lines for agents, facility, utilities, maintenance, security, treatment and insurance, storage fee collection, repeat buyer demand, ageing of unsold stock, order fill rate, inspection compliance, loss and claims ratio, and low-season performance.

Before we recommend building anything, the app should compare the corridor's real numbers against an investment model: construction cost, loan size and repayment, occupancy and throughput required versus achieved, debt service coverage, a low-season scenario, working capital and emergency reserve, payback period, and the number of months of reliable operating history available.

It should then state plainly whether the corridor is ready and why, rather than presenting an attractive chart.

## 9. Managers and agents are different jobs

Agents perform assigned work: farmer support, intake, scheduled inspections, preparing inventory, loading and capturing evidence.

Managers assign and monitor that work, review inspection exceptions, perform or delegate random rechecks, verify scales and equipment, review full stock counts, approve sensitive adjustments up to a limit, follow up missed inspections, escalate incidents and possible claims, and report on the warehouse.

The person holding routine custody cannot be the only person checking their own results. The system should select batches for manager reinspection, randomly or by risk, and retain both records. A manager must never be able to silently overwrite an agent's entry.

## 10. Fix staff invitations first

We should resolve the invitation flow before building inspection compliance on top of it, because identities can currently break.

The problem: someone invited by email may wish to sign in by phone, which risks a duplicate identity or a lost role and warehouse assignment.

How it should work: an authorised admin enters the person's name, delivery address, intended role and warehouse. The system issues a secure, expiring, single-use invitation. The recipient opens the link, selects an allowed authentication method including phone where appropriate, and once they authenticate the backend redeems the token and links that Firebase identity to the intended Kuapa Dwaso user. The correct manager or agent assignment is created or activated. If the phone number or identity already belongs to an existing account, the invitation attaches to that account rather than creating a second one. The invitation is then marked redeemed and cannot be reused. Sensitive roles complete any additional verification or second factor.

The token, the role and the warehouse assignment grant authorisation. The channel we happened to use for delivery should not lock someone into that login method permanently.

## 11. Inspections and the scheduling layer behind them

A single weekly schedule for everything is too blunt. Weekly may suit stable produce. Perishables, anything near its baseline limit, anything already showing warning signs, anything treated, and anything staged for dispatch need more frequent attention.

The software should take the crop policy and the intake findings and calculate the first inspection deadline; create the task for the agent; remind them before it is due; escalate to the manager when overdue; present the checklist for that crop; require quantity, condition, photographs and reason codes; compare against the previous inspection; raise an exception when deterioration or variance crosses the threshold; schedule the next inspection; notify whoever needs to know, whether farmer, manager, admin, buyer or the claims process; and retain all of it for audits and claims.

Each inspection record should carry the quantity inspected, the quantities available, reserved, damaged, spoiled or missing, grade and condition changes, crop-specific observations, the state of the storage area, any pest or contamination evidence, treatment status and safety interval where relevant, photographs, inspector and timestamp, recommended action, whether manager review is required, and the next inspection date.

## 12. Communication should follow the work

I would not start with open chat. I would start with the workflow.

Every farmer, buyer, transporter, agent, manager and admin should be able to answer six questions without asking anyone: what happened, what needs my attention, what do I do next, when is it due, what evidence or decision is required, and who is handling the exception.

In practice: a shared timeline per batch, order, dispatch, payout and dispute, filtered by permission; a role-specific action inbox; in-app notifications that act when tapped; short SMS for urgent, time-sensitive items; reminders and escalation when actions are missed; acknowledgement on the records that matter, such as intake receipts and delivery outcomes; and messaging tied to an entity, opened only when an order, batch, dispatch, claim or dispute genuinely requires a conversation.

The landing page needs the same treatment. At present every visitor is funnelled into one path. Farmers, buyers, warehouse partners, transporters, staff and admins should each receive an explanation aimed at them and then a route into the correct interest form, onboarding, invitation or login.

## 13. What we have, and what to add

Already in the codebase: farmer and buyer profiles, agents and warehouse assignments, intake and evidence, receipts and inventory batches, reservations, buyer orders and payment status, storage fees, sale deductions and payouts, dispatch and transporter workflows, notifications and SMS delivery records, disputes and evidence, audit logs and admin permissions.

None of that needs replacing. It needs connecting and extending with crop storage and inspection policies, crop-specific intake and inspection forms, treatment authorisation and safety release records, scheduled inspection tasks with escalation, a manager responsibility layer, receipt and action acknowledgement, a user-facing timeline, role-specific action inboxes, insurance incidents and claim management, delivery acceptance with structured rejection, improved financial and corridor reporting, and the corrected invitation redemption.

## 14. Decisions still outstanding

- Which one or two crops do we start with?
- Which communities supply the first warehouse?
- Which destination market?
- Who is the primary buyer, and what quantities and grades do they buy repeatedly?
- What is the baseline and maximum storage time per crop, and what shortens it?
- Which preservation methods are both permitted and worth offering?
- What inspections and evidence will the insurer require?
- Where exactly does our fault end and the transporter's, the produce's own nature, or the farmer's begin?
- What do we charge for quick-sale handling and for prepaid storage?
- What operating evidence justifies building?
- Which metrics and thresholds determine that a corridor is ready?

Once we have worked through these, this document should be updated with the option chosen, the alternatives considered, the reasoning, the evidence from farmers, buyers, warehouse specialists, transporters, insurers and regulators, and the resulting changes to the product and to operations.

## 15. What I would say back to the judges

That the answer to their feedback is specificity, not more features.

We name a crop, a production area, a buyer type, a destination market and a warehouse arrangement. The warehouse remains the physical trust point, and the software enforces crop-specific intake, storage limits, scheduled inspections, manager oversight, custody transfers, insurance evidence and structured exceptions.

Quick-sale produce: charges are deducted from proceeds. Stored produce: prepaid periods with real safety limits and a renewal or exit decision at the end. Where preservation makes sense, we offer it under trained, regulated and fully recorded procedures.

Cover for losses caused by our own custody failures is included in the warehouse price. We manage the evidence and the claim; a licensed insurer carries the risk.

We validate each corridor from a leased or partner site before borrowing to build, and the admin app presents the evidence that justifies the loan.

And we build a coordination layer across the landing page and every role, so that shared events, assigned actions, deadlines, acknowledgements, escalations and exceptions are visible to the people who need them.

That is where I have got to. I expect the team to push back on much of it, and the crop, market, pricing, storage, preservation and liability decisions remain ours to make together.

## References for the policy work

- [MoFA: Appropriate Postharvest Practices for Improved Grain Storage](https://mofa.gov.gh/site/index.php/publications/production-guides/509-appropriate-postharvest-practices-for-improved-grain-storage)
- [MoFA: Integrated Pest Management Plan](https://mofa.gov.gh/site/images/pdf/2.Ghana_IPMP_P178132_FSRP2_8Feb2022.pdf)
- [Ghana FDA: warning on unsafe and unapproved preservation practices](https://fdaghana.gov.gh/food-and-drugs-authority-ghana-elected-chair-of-the-first-medical-device-assessment-technical-committee-mda-tc-of-the-african-medical-devices-forum-amdf-in-maputo-2-2-2/)
- [Ghana FDA: regulatory functions](https://fdaghana.gov.gh/functions-of-fda-ghana/)
- [Ghana Commodity Exchange: certified warehousing, grain testing, fumigation, stock management](https://www.gcx.com.gh/services/)
- [National Insurance Commission of Ghana](https://nicgh.org/about-us/overview/)
- [GIRSAL Agricultural Credit Guarantee Scheme](https://www.girsal.com/agricultural-credit-guarantee-scheme/)
