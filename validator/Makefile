.PHONY: test build deploy diff destroy typecheck install install-cdk bundle

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
	cd cdk && npx cdk synth

diff: bundle
	cd cdk && npx cdk diff

deploy: bundle
	cd cdk && npx cdk deploy --require-approval any-change

destroy:
	cd cdk && npx cdk destroy
