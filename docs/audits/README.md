# Open audits

This directory contains unresolved audit findings retained for team review and remediation. Each
report identifies its source revision, evidence, limitations, and acceptance criteria. An open
finding is not an implemented change or a release sign-off.

| Audit                                                           | Status                                      | Scope                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [2026-11-06 custom-code audit](2026-11-06-custom-code-audit.md) | Resolved in code; Test verification pending | Security, performance, architectural consistency, dependency advisories, and upstream divergence |

When fixing a finding, record the PR/commit and validation evidence in its resolution field. Update
the relevant current implementation or operator guide when behavior changes. Once the report has no
unresolved findings, remove the completed report and its index links; Git history retains the review
record. Do not accumulate resolved audit histories here.
