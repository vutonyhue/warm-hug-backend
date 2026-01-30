

# Kế hoạch: Publish @fun-ecosystem/chat lên npm

## Tổng quan

Thiết lập quy trình publish package `@fun-ecosystem/chat` lên npm registry, tương tự như đã làm với `@fun-ecosystem/sso-sdk`. Bao gồm:

1. **Bổ sung files cần thiết** cho package
2. **Tạo GitHub workflow** để tự động publish
3. **Cấu hình sync workflow** để đồng bộ code ra repo riêng

---

## Cấu trúc files cần tạo/sửa

```text
packages/chat/
├── src/
│   └── constants.ts          # ← MỚI: Version constant
├── .github/
│   └── workflows/
│       └── publish.yml       # ← MỚI: Publish workflow
├── .npmignore                # ← MỚI: Ignore files khi publish
├── LICENSE                   # ← MỚI: MIT License
├── CHANGELOG.md              # ← MỚI: Version history
├── package.json              # ← SỬA: Thêm scripts và metadata
├── README.md                 # ← Đã có
├── rollup.config.js          # ← Đã có
└── tsconfig.json             # ← Đã có

.github/workflows/
└── sync-chat-sdk.yml         # ← MỚI: Sync to standalone repo
```

---

## Chi tiết Implementation

### 1. Tạo constants.ts (version tracking)

```typescript
// packages/chat/src/constants.ts
export const CHAT_SDK_VERSION = '1.0.0';
export const CHAT_SDK_NAME = '@fun-ecosystem/chat';
```

### 2. Cập nhật package.json

Thêm các fields cần thiết cho npm publish:

```json
{
  "name": "@fun-ecosystem/chat",
  "version": "1.0.0",
  "description": "Chat module for Fun Ecosystem - provides messaging, groups, voice messages, and realtime features",
  "type": "module",
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "type-check": "tsc --noEmit",
    "test": "vitest --passWithNoTests",
    "prepublishOnly": "npm run build",
    "release:patch": "npm version patch && npm publish --access public",
    "release:minor": "npm version minor && npm publish --access public",
    "release:major": "npm version major && npm publish --access public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/fun-ecosystem/chat-sdk"
  },
  "bugs": {
    "url": "https://github.com/fun-ecosystem/chat-sdk/issues"
  },
  "homepage": "https://github.com/fun-ecosystem/chat-sdk#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 3. Tạo .npmignore

```text
# Source files (dist is included)
src/
*.ts
!*.d.ts

# Config files
tsconfig.json
rollup.config.js
vitest.config.ts
.eslintrc*

# Dev files
.github/
*.test.ts
*.spec.ts
__tests__/

# Editor
.vscode/
.idea/

# Misc
*.log
.DS_Store
```

### 4. Tạo LICENSE (MIT)

```text
MIT License

Copyright (c) 2024 Fun Ecosystem Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 5. Tạo CHANGELOG.md

```markdown
# Changelog

All notable changes to `@fun-ecosystem/chat` will be documented in this file.

## [1.0.0] - 2024-XX-XX

### Added
- Initial release
- ChatProvider with Dependency Injection pattern
- ConversationList component with search
- MessageThread with realtime updates
- ChatInput with media upload support
- Voice Message support (VoiceRecordButton, VoicePreview, VoicePlayer)
- useVoiceRecorder hook for audio recording
- Group conversation management
- Message reactions and read receipts
- Typing indicators
- Chat privacy settings
```

### 6. Tạo GitHub Workflow: publish.yml

```yaml
# packages/chat/.github/workflows/publish.yml
name: Publish @fun-ecosystem/chat to npm

on:
  release:
    types: [created]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version bump type'
        required: true
        default: 'patch'
        type: choice
        options:
          - none
          - patch
          - minor
          - major

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test --if-present

      - name: Build
        run: npm run build

      - name: Configure Git
        if: github.event_name == 'workflow_dispatch'
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"

      - name: Bump version
        if: github.event_name == 'workflow_dispatch' && github.event.inputs.version != 'none'
        run: |
          npm version ${{ github.event.inputs.version }} --no-git-tag-version
          NEW_VERSION=$(node -p "require('./package.json').version")
          sed -i "s/export const CHAT_SDK_VERSION = '.*'/export const CHAT_SDK_VERSION = '$NEW_VERSION'/" src/constants.ts
          echo "📦 Updated to version $NEW_VERSION"

      - name: Commit version bump
        if: github.event_name == 'workflow_dispatch' && github.event.inputs.version != 'none'
        run: |
          NEW_VERSION=$(node -p "require('./package.json').version")
          git add package.json src/constants.ts CHANGELOG.md
          git commit -m "chore(chat): release v$NEW_VERSION"
          git tag "chat-v$NEW_VERSION"
          git push --follow-tags

      - name: Check if version exists
        run: |
          VERSION=$(node -p "require('./package.json').version")
          if npm view @fun-ecosystem/chat@$VERSION version 2>/dev/null; then
            echo "⚠️ Version $VERSION already exists!"
            exit 1
          fi
          echo "✅ Version $VERSION is available"

      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  notify:
    needs: publish
    runs-on: ubuntu-latest
    if: success()
    steps:
      - name: Notification
        run: echo "✅ @fun-ecosystem/chat published successfully!"
```

### 7. Tạo Sync Workflow (trong main repo)

```yaml
# .github/workflows/sync-chat-sdk.yml
name: Sync Chat SDK to Standalone Repo

on:
  push:
    branches:
      - main
    paths:
      - 'packages/chat/**'

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Fun Profile repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Push Chat SDK to standalone repo
        uses: cpina/github-action-push-to-another-repository@main
        env:
          SSH_DEPLOY_KEY: ${{ secrets.CHAT_SDK_DEPLOY_KEY }}
        with:
          source-directory: 'packages/chat'
          destination-github-username: 'fun-ecosystem'
          destination-repository-name: 'chat-sdk'
          target-branch: main
          commit-message: 'Sync from Fun Profile - ${{ github.sha }}'
```

### 8. Cập nhật index.ts (export constants)

```typescript
// Thêm vào packages/chat/src/index.ts
export { CHAT_SDK_VERSION, CHAT_SDK_NAME } from './constants';
```

---

## Các bước sau khi tạo files

### Chuẩn bị npm Account

1. **Đăng nhập npm**: `npm login`
2. **Tạo organization** `@fun-ecosystem` trên npmjs.com (nếu chưa có)

### Chuẩn bị GitHub

1. **Tạo repo** `fun-ecosystem/chat-sdk` (để sync code)
2. **Thêm secrets** vào repo:
   - `NPM_TOKEN`: Token từ npm account
   - `CHAT_SDK_DEPLOY_KEY`: SSH key để push to chat-sdk repo

### Publish thủ công lần đầu

```bash
cd packages/chat
npm run build
npm publish --access public
```

---

## Files tạo mới

| File | Mô tả |
|------|-------|
| `packages/chat/src/constants.ts` | Version tracking |
| `packages/chat/.npmignore` | Ignore khi publish |
| `packages/chat/LICENSE` | MIT License |
| `packages/chat/CHANGELOG.md` | Version history |
| `packages/chat/.github/workflows/publish.yml` | Auto publish workflow |
| `.github/workflows/sync-chat-sdk.yml` | Sync to standalone repo |

## Files cần sửa

| File | Thay đổi |
|------|----------|
| `packages/chat/package.json` | Thêm scripts, metadata, publishConfig |
| `packages/chat/src/index.ts` | Export constants |

---

## Cách sử dụng sau khi publish

```bash
# Install từ npm
npm install @fun-ecosystem/chat

# Hoặc với pnpm
pnpm add @fun-ecosystem/chat
```

```typescript
// Import trong app khác
import {
  ChatProvider,
  ConversationList,
  MessageThread,
  useConversations,
  CHAT_SDK_VERSION,
} from '@fun-ecosystem/chat';

console.log(`Using Chat SDK v${CHAT_SDK_VERSION}`);
```

