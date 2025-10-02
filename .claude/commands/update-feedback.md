# GitHub Issue Workflow for Issue #$ARGUMENT$

## Setup Phase
1. Fetch latest branches: `git fetch origin`
2. Get issue details 
   - Fetch issue title: `gh issue view $ARGUMENT$ --json title -q .title`

## Analysis Phase
1. Read the full issue content and ALL comments using: `gh issue view $ARGUMENT$ --comments`
2. Read the full PR attached to the Issue and ALL comments
3. Analyze the Manual Testing Required

## Obtain feedback phase
1. use @qa-criteria-validator agent to provide feedback over the manual test requiered and the uses cases described in the issue over the deployment url
3. Add the feedback as a comment in the PR

## Decision over feedback
1. if the report from @qa-criteria-validator is all success update the issue with a message saying "ISSUE READY TO MERGE" 
2. if the report from @qa-criteria-validator has missing fixes comment the PR with the feedback
