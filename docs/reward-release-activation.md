# Shopping-Bonus Release Activation

The application now has a cron-only `POST /api/scheduled/release-shopping-bonuses` endpoint. Each invocation selects only pending reward holds whose `releaseAt` timestamp has passed and performs an idempotent claim before crediting the beneficiary’s **Shopping Bonus** balance.

No scheduled job has been created in the current unpublished environment. After the next checkpoint is published, create one project-owned invocation against this endpoint at a sensible recurring cadence, such as every hour. The handler requires the platform’s cron identity and task identifier; ordinary browsers and API callers receive `403`.

The schedule must be tracked in the `referralRewardSettings.rewardReleaseScheduleTaskUid` field when activation is performed, so it can later be paused, inspected, or deleted safely. Do not invoke the endpoint manually to release rewards outside the configured return-window policy.
