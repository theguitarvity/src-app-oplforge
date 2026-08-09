# Application identity assets

Run `pnpm exec electron scripts/generate-icons.ts` after changing the versioned `icon.png` source. The command produces deterministic PNG sizes under `build/generated/` and verifies the committed Windows ICO before packaging.
`icon.png` (512×512 RGBA) is the versioned master raster asset. `icon.ico` is the checked Windows
multi-resolution resource. Release validation verifies both before packaging.

Generated assets must be reproducible from committed inputs. Windows builder/NSIS fields reference
these paths explicitly and runtime uses the package `com.oplforge.app` App User Model ID.
