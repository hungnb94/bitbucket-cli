# Auth Feature — Design Spec

**Date:** 2026-05-29
**Status:** Approved

---

## Overview

Authentication module for the Bitbucket CLI tool. Supports login via Atlassian API token (replaces deprecated App Passwords — removed July 28, 2026), logout, and `whoami`. Credentials stored locally via `conf` library with environment variable override for CI use.

---

## Commands

```
bitbucket auth login     # interactive prompt, validates token, saves config
bitbucket auth logout    # prompts confirmation, deletes config
bitbucket auth whoami    # prints current user info from Bitbucket API
```

---

## Login Flow

```
$ bitbucket auth login

ℹ  Bạn cần tạo API token trên Atlassian trước khi tiếp tục.

   Truy cập: https://id.atlassian.com/manage-profile/security/api-tokens

   Bước tạo token:
     1. Chọn "Create API token with scopes"
     2. Đặt tên và ngày hết hạn
     3. Chọn ứng dụng: Bitbucket
     4. Chọn scopes theo hướng dẫn bên dưới
     5. Sao chép token ngay — token chỉ hiển thị một lần

   Scopes tối thiểu cần cấp:
     ✓ User: Read                (để lấy thông tin tài khoản)
     ✓ Repositories: Read        (để đọc repo, xem diff)
     ✓ Pull requests: Read       (để list/view PR, comment)
     ✓ Pull requests: Write      (để approve/decline/merge PR)

   Scopes tuỳ chọn:
     • Repositories: Write       (nếu muốn tạo PR sau này)
     • Pipelines: Read           (nếu muốn xem CI/CD)

? Bitbucket username: johndoe
? API token: **********************
? Default workspace: my-team
? Default repo (optional): my-project

  Đang xác minh credentials...
✓ Xác minh thành công — chào john.doe@example.com
✓ Credentials đã lưu vào ~/.config/bitbucket-cli/config.json
```

On failure:
```
✗ Xác minh thất bại — 401 Unauthorized
  Kiểm tra lại username và API token, sau đó chạy lại bitbucket auth login
```

---

## Logout Flow

```
$ bitbucket auth logout

? Xoá credentials đã lưu? (y/N) y
✓ Đã xoá ~/.config/bitbucket-cli/config.json
```

---

## Whoami

```
$ bitbucket auth whoami

  Username:     johndoe
  Email:        john.doe@example.com
  Display name: John Doe
  Account ID:   557058:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

If not logged in:
```
✗ Chưa có credentials. Chạy: bitbucket auth login
```

---

## Config Storage

File: `~/.config/bitbucket-cli/config.json` (permissions: `600`)

```json
{
  "username": "johndoe",
  "apiToken": "xxxxxxxxxxxx",
  "defaultWorkspace": "my-team",
  "defaultRepo": "my-project"
}
```

Environment variable override (takes precedence over config file, useful for CI):
- `BITBUCKET_USERNAME`
- `BITBUCKET_API_TOKEN`

---

## Project Structure

```
src/
├── commands/
│   └── auth.ts           # commander subcommands: login, logout, whoami
├── auth/
│   ├── index.ts          # public API export
│   ├── credentials.ts    # validate token against Bitbucket API (/user endpoint)
│   └── config.ts         # read/write config via conf library
└── api/
    └── bitbucket.ts      # HTTP client — loads credentials from auth module
```

---

## Module Interface

```typescript
// src/auth/config.ts
getCredentials(): Credentials | null
saveCredentials(creds: Credentials): void
clearCredentials(): void

// src/auth/credentials.ts
validateCredentials(creds: Credentials): Promise<UserInfo>

// src/auth/index.ts
export { getCredentials, saveCredentials, clearCredentials, validateCredentials }
export type { Credentials, UserInfo }
```

```typescript
type Credentials = {
  username: string
  apiToken: string
  defaultWorkspace: string
  defaultRepo?: string
}

type UserInfo = {
  username: string
  email: string
  displayName: string
  accountId: string
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 401 Unauthorized | Print error, prompt to re-run `auth login` |
| Network timeout | Retry once, then fail with clear message |
| Config not found | Prompt to run `auth login` |
| Token missing required scopes | API returns 403 — show "token thiếu quyền, kiểm tra lại scopes" |

---

## Security

- API token stored plain text in user config directory (same approach as `gh` CLI)
- Config file permissions set to `600` on creation
- Never log token to stdout/stderr
- Env var credentials never written to config file
