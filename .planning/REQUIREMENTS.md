# Requirements: v1.5 Bug Fixes & Stability

## Encryption Fix

- [ ] **ENC-01**: GitHub secrets encryption uses libsodium crypto_box_seal (replacing broken tweetnacl implementation that caused 422 errors)
- [ ] **ENC-02**: libsodium-wrappers loads correctly at runtime in ESM context (via createRequire CJS fallback)
- [ ] **ENC-03**: tweetnacl and tweetnacl-util dependencies removed from package.json

## Template Fixes

- [ ] **TPL-01**: Generated web projects include @testing-library/dom as explicit devDependency (peer dep of @testing-library/react v16)
- [ ] **TPL-02**: Generated mobile projects use @testing-library/react-native/extend-expect instead of deprecated @testing-library/jest-native
- [ ] **TPL-03**: Generated mobile projects use jest-jasmine2 test runner for Jest 30 + Expo SDK 53 compatibility

## Documentation

- [ ] **DOC-01**: PROJECT.md key decisions updated to reflect libsodium-wrappers, createRequire, jest-jasmine2, and react-native extend-expect decisions

## Out of Scope

- Performance optimizations (cached npm install, parallel validation) — future enhancement
- Watch mode for template development — future enhancement
- Multi-region deployment support — future version

## Traceability

| Requirement | Phase |
|-------------|-------|
| ENC-01 | 15 |
| ENC-02 | 15 |
| ENC-03 | 15 |
| TPL-01 | 15 |
| TPL-02 | 15 |
| TPL-03 | 15 |
| DOC-01 | 15 |

---
*Created: 2026-01-31*
