# Rewards Automation Activation

The rewards dashboard includes two deterministic, cron-only server endpoints: the existing pending Shopping Bonus release endpoint and `POST /api/scheduled/monthly-vendor-rewards` for the previous calendar month’s approved-vendor ranking, held leaderboard grants, and qualifying zero-return commission overrides.

No scheduled job has been created in the unpublished environment. After a checkpoint is published, create project-owned schedules and store their returned task identifiers in the relevant settings row. The monthly vendor evaluator must run after month-end; its handler refuses ordinary browser calls and skips any cron identity that does not match `rewardsAutomationSettings.monthlyVendorRewardsScheduleTaskUid`.

This ensures repeat deliveries are harmless, awards remain non-withdrawable Shopping Bonus, and the 48-hour return window is retained before leaderboard grants are released.
