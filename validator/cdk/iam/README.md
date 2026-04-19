# Deploy User IAM Policy

`deploy-user-policy.json` is the inline policy attached to the IAM user `liftmark-deploy` (account `341556346945`). It grants only `sts:AssumeRole` on the four CDK v2 bootstrap roles in `us-west-2`, gated on MFA. All real permissions live in the bootstrap roles themselves, which CDK maintains.

## Applying

AWS Console → IAM → Users → `liftmark-deploy` → Permissions → Create inline policy → paste the JSON → name it `CdkAssumeBootstrapRoles`.

Or via CLI from an admin session:

```bash
aws iam put-user-policy \
  --user-name liftmark-deploy \
  --policy-name CdkAssumeBootstrapRoles \
  --policy-document file://deploy-user-policy.json
```

## Prerequisites

- Bootstrap roles must trust the account root (default for `cdk bootstrap` without `--trust` overrides).
- User must have MFA configured and be accessed via aws-vault (or another MFA-prompting flow).
