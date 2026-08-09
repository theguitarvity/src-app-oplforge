# Public release procedure

1. Update `release-manifest.json`; derive `package.json.version` using `1.A.(B*1000+C)`.
2. Run `pnpm exec tsx scripts/validate-release.ts v1.A.B.C`, lint, tests and build on Node 22.
3. Commit, then create the exact annotated tag `v1.A.B.C`. Branch builds are unsigned smoke artifacts only.
4. Configure Windows certificate secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`). Public jobs fail closed when secrets or native signature verification are unavailable.
5. The tag workflow builds the x64 NSIS installer and updater metadata, rejects unexpected files, verifies signatures and publishes one stable release.
6. Test installed N → N+1 on a clean Windows VM before promoting the release. Preserve the inventory and checksums as evidence.
7. To roll back, mark the bad release unavailable and publish a strictly newer mapped version containing the correction; never replace immutable artifacts under an existing tag.
