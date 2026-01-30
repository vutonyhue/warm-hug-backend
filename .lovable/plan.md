

# Kế hoạch: Đổi scope từ @fun-ecosystem sang @fun-ecosystem1

## Tổng quan

Cập nhật tên organization trong tất cả các files để khớp với npm organization mới `fun-ecosystem1`.

---

## Files cần sửa

| File | Thay đổi |
|------|----------|
| `packages/chat/package.json` | `"name": "@fun-ecosystem/chat"` → `"@fun-ecosystem1/chat"` |
| `packages/chat/src/constants.ts` | `CHAT_SDK_NAME = '@fun-ecosystem/chat'` → `'@fun-ecosystem1/chat'` |
| `packages/chat/src/index.ts` | Comment header |
| `packages/chat/README.md` | Các references trong docs |
| `packages/chat/CHANGELOG.md` | Tên package trong changelog |
| `.github/workflows/sync-chat-sdk.yml` | `destination-github-username: 'fun-ecosystem'` → `'fun-ecosystem1'` (nếu con tạo GitHub org cùng tên) |

---

## Chi tiết thay đổi

### 1. packages/chat/package.json
```json
{
  "name": "@fun-ecosystem1/chat",
  ...
}
```

### 2. packages/chat/src/constants.ts
```typescript
export const CHAT_SDK_NAME = '@fun-ecosystem1/chat';
```

### 3. packages/chat/README.md
```markdown
# @fun-ecosystem1/chat

...

npm install @fun-ecosystem1/chat
pnpm add @fun-ecosystem1/chat

import { ... } from '@fun-ecosystem1/chat';
```

### 4. packages/chat/CHANGELOG.md
```markdown
All notable changes to `@fun-ecosystem1/chat` will be documented...
- Initial release of @fun-ecosystem1/chat
```

### 5. .github/workflows/sync-chat-sdk.yml
```yaml
destination-github-username: 'fun-ecosystem1'  # Nếu con cũng tạo GitHub org cùng tên
```

---

## Lưu ý

- **npm organization**: `fun-ecosystem1` đã sẵn sàng trên npmjs.com ✅
- **GitHub organization**: Con cũng nên tạo `fun-ecosystem1` trên GitHub để đồng bộ repo (hoặc giữ username hiện tại `MinhTriDiamond` nếu muốn)
- Sau khi cập nhật, con có thể publish với lệnh:
  ```bash
  cd packages/chat
  npm run build
  npm publish --access public
  ```

---

## Kết quả

Package sẽ được publish với tên: `@fun-ecosystem1/chat`

Cài đặt trong các app khác:
```bash
npm install @fun-ecosystem1/chat
```

