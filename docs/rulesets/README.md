# Protect the dev branch

`protect-dev.json` is an importable GitHub repository branch ruleset.

## Enable it

1. Download `protect-dev.json` using GitHub's Download raw file button.
2. Open repository Settings > Rules > Rulesets.
3. Select New ruleset > Import a ruleset, select the JSON, and review it.
4. Confirm the target is `dev` and enforcement is Active, then select Create.

It requires a pull request, one approval, dismissal of stale approvals when new commits are pushed, and resolved review conversations. It blocks deletion and force pushes. No bypass actors are configured.

One approval needs another collaborator with write access; a PR author cannot approve their own PR. If you are working alone, set Required approvals to 0 while keeping the pull request requirement.

Required status checks are not configured yet because the repository does not have a build workflow. After adding CI and seeing it run, add its actual check name to the ruleset.

## Make dev the default branch

Open repository Settings > General > Default branch, switch from `main` to `dev`, and confirm. `dev` was created from `main`; the Check-in 1 pull request targets `dev`. The default branch remains `main` until this setting is changed. This does not rename or delete `main`.
