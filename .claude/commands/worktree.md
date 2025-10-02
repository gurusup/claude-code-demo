<github_isssue>
#$ARGUMENTS
</github_isssue>
1- git worktree add ./.trees/feature-issue-$ARGUMENTS -b feature-issue-$ARGUMENTS
2- cd .trees/feature-issue-$ARGUMENTS
5- activate plan mode on
6- analyze the github issue #$ARGUMENTS and determine with the @project-coordinator subagent what subagents from the folder @.claude/agents should be involved in implement this issue. @project-coordinator should determine if the agents can run in parallel if there is no overlaping on tasks, even run parallel instances of the same agent if is needed or possible, ALWAYS show the plan to the user to confirm
7- at the end after the confirmation of the user, commit the changes and push them to the branch