.PHONY: test build deploy diff destroy typecheck install install-cdk bundle

# Wrap AWS-calling commands in aws-vault-op, which pulls the file-backend
# passphrase and MFA TOTP from 1Password before invoking aws-vault. Falls back
# to plain aws-vault if the wrapper isn't installed. MFA is enforced via
# ~/.aws/config. Override with AWS_VAULT= to bypass (e.g. in CI where
# credentials come from the environment).
ifeq ($(shell command -v aws-vault-op 2>/dev/null),)
$(warning aws-vault-op not found — falling back to aws-vault (expect passphrase + MFA prompts))
AWS_VAULT_CMD := aws-vault
else
AWS_VAULT_CMD := aws-vault-op
endif

AWS_VAULT ?= $(AWS_VAULT_CMD) exec liftmark-validator-deploy --

# ── App dependencies ──
install:
	npm install

# ── CDK dependencies ──
install-cdk:
	cd cdk && npm install

# ── Tests ──
test:
	npx vitest run

test-watch:
	npx vitest

typecheck:
	npx tsc --noEmit

# ── Bundle Lambda code ──
bundle:
	npx esbuild src/handler.ts \
		--bundle \
		--platform=node \
		--target=node20 \
		--outfile=dist/handler.js \
		--format=cjs

# ── CDK commands ──
build: bundle
	cd cdk && $(AWS_VAULT) npx cdk synth

diff: bundle
	cd cdk && $(AWS_VAULT) npx cdk diff --strict

deploy: bundle
	cd cdk && $(AWS_VAULT) npx cdk deploy --require-approval any-change

destroy:
	cd cdk && $(AWS_VAULT) npx cdk destroy
