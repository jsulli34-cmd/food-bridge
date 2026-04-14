# Food Bridge Guide Outline (Act Phase Submission)

## 1) Big Idea and Challenge Context
- Community problem: food insecurity and coordination gaps across donors, pantries, and neighbors.
- Why communication matters as much as supply.
- South Bend focus and intended user groups.

## 2) Investigation Summary
- What we learned from prior prototype feedback.
- Existing strengths from prototype v1:
  - Role switching
  - Map + organization details
  - Alerts and shared bulletin
- Gaps identified:
  - Messaging was not direct
  - Placeholder data reduced authenticity
  - Need level was not visible on map

## 3) Solution Overview (Beta Version)
- Product concept: lightweight bridge app for local food distribution communication.
- Core workflows:
  - Donor identifies high-need sites and sends direct coordination message
  - Organization updates status and receives direct messages
  - Person in need checks stable/open locations and asks questions

## 4) Key Features and How They Integrate Course Concepts
### 4.1 Map + Place Directory
- Real South Bend-area partners listed with website, hours, wishlist.
- Filter by type (food bank, pantry, meals, redistribution).

### 4.2 Need-Status Signaling
- Four status levels: Critical, High, Moderate, Stable.
- Status displayed in list, detail panel, and map marker color.
- Role-based relevance: donors prioritize critical/high sites.

### 4.3 Role-Based Alerts
- Alerts generated from live status values and selected role.
- Demonstrates user-centered information design.

### 4.4 Direct Messaging (Beta)
- Role-to-role messages (not just global board).
- Inbox/sent/all views support testing multiple user perspectives.

## 5) Technical Design Decisions
- Why static architecture for class beta (speed, low cost, easy deployment).
- LocalStorage as temporary state layer for status + messages.
- Trade-offs versus full-stack backend.

## 6) Testing and Evaluation Plan
- Scenario tests by user type.
- Functional checks:
  - Status update propagation
  - Alerts refresh accuracy
  - Message routing by role
  - Map/list/filter consistency
- Team feedback log format for iteration.

## 7) Reflection on Successes and Failures
- Successes in implementing core concept quickly.
- Remaining limitations and what failed/was deferred.
- Lessons learned from iterative prototype development.

## 8) Next Iteration Roadmap
- Authentication + organization accounts.
- Shared backend database for cross-device messaging/status.
- Verified hours/contact data pass with local partners.
- Optional advanced map layers and analytics.

## 9) Conclusion
- How beta demonstrates meaningful progress from investigation to action.
- Evidence of impact potential for South Bend food access coordination.
