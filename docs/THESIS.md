# Two-year thesis: adaptive planning in production agents, 2028

Today's agents are written as scripts with a language model inside. In two years that framing will look like running a production service as a shell script. The unit of reliability will no longer be the *plan* but the *assumption ledger*: an explicit, inspectable record of what the agent believes about the world, why, and what would falsify it.

Three shifts follow. First, **change detection becomes infrastructure**. Agents will subscribe to signals tied to the assumptions their plans depend on, the way services subscribe to health checks, rather than polling or re-prompting. Re-planning on a timer is the agent equivalent of restarting a server every hour: it works until the day it makes things worse.

Second, **revision becomes a governed operation**, like a deploy. Every change of mind will carry a diff, a rationale, a risk assessment, and a rollback, and will pass gates (validators, dry-runs, hysteresis, approval for irreversible actions). The failure that matters is not the agent that doesn't adapt but the one that adapts *confidently on a false alarm*.

Third, **trust will be earned through traces, not demos**. Buyers will ask "show me the last ten times it changed its mind and why", and event-sourced, replayable histories will be a procurement requirement and a compliance artifact.

The agents that win won't be the ones that plan best. They'll be the ones that know most precisely when their plan has stopped being true, and prove it.
