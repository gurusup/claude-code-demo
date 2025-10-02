# GitHub Issue Workflow for Issue #$ARGUMENT$

## Setup Phase
1. Fetch latest branches: `git fetch origin`
2. Get issue details 
   - Fetch issue title: `gh issue view $ARGUMENT$ --json title -q .title`

## Worktree Phase (if you are not now in a ./tree folder)
1. git worktree add ./.trees/feature-issue-$ARGUMENTS -b feature-issue-$ARGUMENTS
2- cd .trees/feature-issue-$ARGUMENTS

## Analysis Phase
1. Read the full issue content and ALL comments using: `gh issue view $ARGUMENT$ --comments`
2. Analyze the requirements and context thoroughly

## Implementation Phase
1. Execute the plan step by step, remember to build test before the implementation and run the test suite constanly to get quick feedback.
2. Create always unit tests
3. Ensure consistency with existing code in the branch
4. Run local builds and tests suite before git commit & push
5. Never implement the manual tests
6. Create the PR or update the existing one
7. Report status of completenes:

<results>

  # Summary of the requirements implemented:
	- req 1
        - req 2
	- ...

  # Requirements pending
	- req 1
        - req 2
	- ...
  # Test implemented and their run status
     ok    github.com/gurusup/gurusup-backend/src/tests/domain/core/test_user_notification.py       31.604sm

  # Proof that all build passes
     ok    github.com/gurusup/gurusup-backend       90.604sm
  
  # Overall status: [Needs More Work/All Completed]
  # PR: github-pr-url
</result>

8. Stay tuned to the pr until the deploy is done successfully using `gh pr view {pr_number} --json statusCheckRollup,state,mergeable,url)`
9. If some verification fails check the problems and implement the fixes updating the PR and try again in loop until have all verifications in success

## Important Notes
- The All completed is the desired status and we can only arrive if we have implemented all the requirements and all the test suite are implemented and green otherwhise we need more work until that happends
- Always use `gh` CLI for GitHub operations
- Keep detailed records of all actions as PR/issue comments
- Wait for explicit confirmation before proceeding with major changes

## Final checks
- After create the PR review that the validations in the pipeline are success, if they are pending wait until they are success checking using `gh pr view {pr_number} --json statusCheckRollup,state,mergeable,url)` 
- If the validations are failed, review the issues or ask for them to me
- After have the issues, implement the fixes and push again to the PR until all the validations are success, continue in loop until have them all in green
- Once all is green, update the issue with a comment of what is implmented and your labour is finished