# SMS Notifications Recommendations

This document outlines recommendations for new areas where SMS notifications would improve the user experience and platform operations.


## 2. Recommended Additions for SMS Notifications

Based on our review of the application lifecycle, here are high-value additions for SMS notifications categorized by flow:

### 1. Account Creation & Onboarding ("First Accounts")
* **Farmer Registration / Profile Welcome**:
  * **Context**: When a warehouse agent creates a farmer profile ([farmers.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/farmers.ts#L50)) or the farmer self-registers.
  * **SMS Message**: *"Welcome to Kuapa Dwaso, [Name]! Your unique Farmer Code is [Code]. Please present this code when delivering produce to any warehouse."*
* **Buyer Registration Welcome**:
  * **Context**: When a buyer account is created or approved.
  * **SMS Message**: *"Welcome to Kuapa Dwaso, [Name]! Your buyer profile is active. You can now submit orders for fresh produce."*
* **Account Verification Status Update**:
  * **Context**: When an admin approves or rejects a farmer profile ([farmers.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/farmers.ts#L144)) or buyer profile ([buyers.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/buyers.ts#L149)).
  * **SMS Message**: *"Your Kuapa Dwaso farmer verification is complete. Your account is verified and ready for intake."* or *"Your profile registration could not be verified: [Reason]. Please contact your warehouse agent."*
* **One-Time Passcode (OTP) Fallback**:
  * **Context**: When users sign up or require phone verification (supporting Firebase MFA flows with native provider backup).
  * **SMS Message**: *"Your Kuapa Dwaso verification code is [Code]. It expires in 5 minutes."*

### 2. Dispute Resolution
* **Dispute Created Alert**:
  * **Context**: When a dispute is created ([disputes.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/disputes.ts#L74)) (e.g. over storage receipt details or order conditions).
  * **SMS Message**: *"A dispute has been opened for your [Entity Type] (ID: [Entity ID]). Details: [Summary]. Our team is investigating."*
* **Dispute Status/Resolution Update**:
  * **Context**: When a dispute status changes to `under_review` or `resolved` ([disputes.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/disputes.ts#L138)).
  * **SMS Message**: *"Dispute on [Entity Type] has been resolved. Resolution: [Resolution Details]."*

### 3. Storage Fee Reminders
* **Storage Fee Ledger Accruals**:
  * **Context**: Weekly or monthly crons that notify farmers of accrued storage charges on their stored batches ([storageFees.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/storageFees.ts#L27)).
  * **SMS Message**: *"Reminder: Storage fees of GHS [Amount] have accrued on your stored produce ([Crop Type]) as of [Date]."*

### 4. Logistics Changes
* **Transporter Unassigned Alert**:
  * **Context**: When an admin unassigns a transporter from a planned dispatch ([dispatches.ts](file:///c:/Users/Kevin/Projects/ML/agriculture/convex/dispatches.ts#L545)).
  * **SMS Message**: *"You have been unassigned from the dispatch to [Destination]. Reason: [Reason]."*
* **Dispatch Delay/Transit Interruption**:
  * **Context**: When dispatch status changes to `issue_reported` (e.g. breakdown, delay) during transit.
  * **SMS Message**: *"Notice: There is a delivery delay on your dispatch to [Destination]. Current Status: Issue Reported. We are working on a resolution."*
