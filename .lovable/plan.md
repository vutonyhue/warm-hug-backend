

# Kế hoạch: Tạo lại Database Schema cho Lovable Cloud

## Tổng quan

Dựa trên 60+ file migration đã có trong dự án, tôi sẽ tạo một migration tổng hợp để thiết lập toàn bộ database schema trong Lovable Cloud mới.

---

## Database Schema Chi tiết

### Enums

| Enum | Giá trị |
|------|---------|
| `app_role` | `admin`, `user` |

### Bảng chính (Tables)

```text
+---------------------------+---------------------------------------+
|         BẢNG              |               MÔ TẢ                   |
+---------------------------+---------------------------------------+
| profiles                  | Hồ sơ người dùng                      |
| user_roles                | Phân quyền admin/user                 |
| posts                     | Bài đăng                              |
| comments                  | Bình luận (hỗ trợ nested replies)     |
| reactions                 | Cảm xúc (like, love, haha, etc.)      |
| shared_posts              | Chia sẻ bài viết                      |
| friendships               | Quan hệ bạn bè                        |
| notifications             | Thông báo realtime                    |
| post_tags                 | Tag bạn bè vào bài viết               |
+---------------------------+---------------------------------------+
| transactions              | Giao dịch blockchain                  |
| search_logs               | Log tìm kiếm (rate limit)             |
| blacklisted_wallets       | Ví bị khóa                            |
| reward_approvals          | Lịch sử duyệt thưởng                  |
| reward_adjustments        | Điều chỉnh thưởng thủ công            |
| audit_logs                | Log hành động admin                   |
+---------------------------+---------------------------------------+
| conversations             | Cuộc hội thoại (direct/group)         |
| conversation_participants | Thành viên cuộc hội thoại             |
| messages                  | Tin nhắn                              |
| message_reads             | Đã đọc tin nhắn                       |
| message_reactions         | Cảm xúc tin nhắn                      |
| chat_settings             | Cài đặt chat riêng tư                 |
+---------------------------+---------------------------------------+
| oauth_clients             | OAuth clients cho SSO ecosystem       |
| oauth_codes               | Mã xác thực OAuth                     |
| otp_codes                 | Mã OTP đăng nhập                      |
| cross_platform_tokens     | Token đa nền tảng                     |
| platform_user_data        | Dữ liệu user theo platform            |
| platform_financial_data   | Dữ liệu tài chính theo platform       |
| account_merge_requests    | Yêu cầu merge account                 |
| pending_provisions        | Tài khoản chờ đặt mật khẩu            |
+---------------------------+---------------------------------------+
| soul_nfts                 | Soul NFT định danh linh hồn           |
| custodial_wallets         | Ví custodial cho user Web2            |
| livestreams               | Phiên livestream                      |
| financial_transactions    | Log giao dịch tài chính               |
| reconciliation_logs       | Log kiểm tra đối soát                 |
| rate_limit_state          | Trạng thái rate limit                 |
+---------------------------+---------------------------------------+
```

### Storage Buckets

| Bucket | Mô tả |
|--------|-------|
| `posts` | Ảnh bài đăng |
| `avatars` | Ảnh đại diện & cover |
| `videos` | Video bài đăng |
| `comment-media` | Media trong bình luận |

---

## Chi tiết các bảng quan trọng

### 1. profiles

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | Tham chiếu auth.users |
| username | TEXT UNIQUE | Tên người dùng |
| full_name | TEXT | Họ tên đầy đủ |
| avatar_url | TEXT | Ảnh đại diện |
| cover_url | TEXT | Ảnh bìa |
| bio | TEXT | Tiểu sử (max 120 ký tự) |
| fun_id | TEXT UNIQUE | FUN-ID định danh |
| wallet_address | TEXT | (Deprecated) |
| external_wallet_address | TEXT | Ví MetaMask |
| custodial_wallet_address | TEXT | Ví custodial |
| default_wallet_type | TEXT | 'custodial' hoặc 'external' |
| is_banned | BOOLEAN | Bị khóa tài khoản |
| is_restricted | BOOLEAN | Bị hạn chế |
| reward_status | TEXT | pending/approved/rejected |
| pending_reward | BIGINT | Thưởng chờ duyệt |
| approved_reward | BIGINT | Thưởng đã duyệt |
| law_of_light_accepted | BOOLEAN | Đã chấp nhận quy tắc |
| pinned_post_id | UUID | Bài ghim |
| soul_level | INTEGER | Cấp độ linh hồn |
| total_rewards | BIGINT | Tổng thưởng |
| registered_from | TEXT | Platform đăng ký |
| oauth_provider | TEXT | Phương thức đăng nhập |
| grand_total_* | BIGINT | Tổng tài chính |

### 2. posts

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | UUID (PK) | |
| user_id | UUID | Tác giả |
| content | TEXT | Nội dung (max 20,000 ký tự) |
| image_url | TEXT | Ảnh đơn |
| video_url | TEXT | Video đơn |
| media_urls | JSONB | Nhiều media |
| location | TEXT | Địa điểm check-in |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### 3. Chat System

- **conversations**: Cuộc hội thoại (direct/group)
- **conversation_participants**: Thành viên (role: admin/member)
- **messages**: Tin nhắn (hỗ trợ reply, media)
- **message_reads**: Đánh dấu đã đọc
- **message_reactions**: Emoji reactions
- **chat_settings**: Cài đặt riêng tư (who_can_message, read_receipts)

### 4. OAuth/SSO System

- **oauth_clients**: Fun Farm, Fun Play, Fun Planet
- **oauth_codes**: Authorization codes (PKCE support)
- **cross_platform_tokens**: Access/Refresh tokens
- **otp_codes**: Mã OTP cho login
- **platform_user_data**: Dữ liệu sync theo platform
- **account_merge_requests**: Yêu cầu gộp tài khoản

### 5. Financial System

- **platform_financial_data**: Tổng deposit/withdraw/bet/win/loss per platform
- **financial_transactions**: Log giao dịch (immutable)
- **reconciliation_logs**: Kết quả đối soát tự động

---

## Functions & Triggers chính

### Functions

| Function | Mục đích |
|----------|----------|
| `handle_new_user()` | Tạo profile + role khi đăng ký |
| `generate_fun_id()` | Tạo FUN-ID từ username |
| `create_soul_nft_for_new_user()` | Tạo Soul NFT placeholder |
| `has_role(uuid, app_role)` | Kiểm tra quyền admin |
| `get_user_rewards_v2(limit)` | Tính toán thưởng với daily caps |
| `get_app_stats()` | Thống kê tổng quan app |
| `check_rate_limit(key, limit, window_ms)` | Rate limiting |
| `run_financial_reconciliation()` | Đối soát tài chính |
| `is_conversation_participant()` | Kiểm tra thành viên chat |
| `update_conversation_last_message()` | Cập nhật preview tin nhắn |

### Triggers

| Trigger | Mục đích |
|---------|----------|
| `on_auth_user_created` | Tạo profile + Soul NFT |
| `trigger_generate_fun_id` | Tạo FUN-ID |
| `enforce_post_rate_limit` | 10 posts/hour |
| `enforce_comment_rate_limit` | 50 comments/hour |
| `notify_on_like` | Thông báo khi có reaction |
| `notify_on_comment` | Thông báo khi có comment |
| `cleanup_post_files_trigger` | Xóa files khi xóa post |
| `on_message_insert` | Cập nhật last_message |
| `trigger_update_grand_totals` | Cập nhật tổng tài chính |

---

## RLS Policies

Tất cả các bảng đều có RLS với các patterns:

1. **Public Read**: posts, comments, reactions (ai cũng xem được)
2. **Own Data**: users chỉ CRUD data của mình
3. **Admin Only**: audit_logs, blacklisted_wallets (chỉ admin)
4. **Participants Only**: messages (chỉ thành viên conversation)
5. **Service Role**: oauth_codes, otp_codes (chỉ edge functions)

---

## Realtime

Các bảng có realtime:
- `notifications`
- `comments`
- `reactions`
- `messages`
- `message_reads`
- `message_reactions`
- `conversation_participants`

---

## Views

| View | Mục đích |
|------|----------|
| `public_profiles` | Profile công khai (không có wallet) |
| `user_custodial_wallets` | Ví của user (không có private key) |

---

## Thực thi

Tôi sẽ tạo migration SQL tổng hợp bao gồm:

1. **Phase 1**: Enums, Extensions
2. **Phase 2**: Core tables (profiles, posts, comments, reactions, etc.)
3. **Phase 3**: Social features (friendships, notifications)
4. **Phase 4**: Chat system (conversations, messages)
5. **Phase 5**: OAuth/SSO system
6. **Phase 6**: Financial system
7. **Phase 7**: Storage buckets và policies
8. **Phase 8**: Functions và triggers
9. **Phase 9**: RLS policies
10. **Phase 10**: Indexes và constraints
11. **Phase 11**: Seed data (OAuth clients, default admin)

---

## Technical Notes

- Sử dụng `gen_random_uuid()` thay vì `uuid_generate_v4()`
- Validation dùng triggers thay vì CHECK constraints với `now()`
- Security Definer functions cho các thao tác nhạy cảm
- Service role policies cho edge functions
- SECURITY INVOKER views để tránh lỗi bảo mật

