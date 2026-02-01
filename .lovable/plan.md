
# Kế hoạch sửa lỗi "column reference 'created_at' is ambiguous"

## Vấn đề

Function `get_user_rewards_v2` đang bị lỗi khi gọi từ frontend (TopRanking component). Lỗi xảy ra do PostgreSQL không phân biệt được `created_at` trong ORDER BY clause đang refer đến:
1. Cột `created_at` của bảng `reward_approvals`
2. Cột output `created_at` được định nghĩa trong RETURNS TABLE của function

## Giải pháp

Chạy database migration để cập nhật function, thêm table qualifier vào ORDER BY:

```sql
-- Sửa ORDER BY created_at thành ORDER BY reward_approvals.created_at
CREATE OR REPLACE FUNCTION public.get_user_rewards_v2(limit_count integer DEFAULT 100)
RETURNS TABLE(
  id uuid, 
  username text, 
  full_name text, 
  avatar_url text, 
  is_banned boolean, 
  is_restricted boolean, 
  claimable bigint, 
  status text, 
  admin_notes text, 
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.is_banned,
    p.is_restricted,
    COALESCE(p.pending_reward, 0) AS claimable,
    COALESCE(p.reward_status, 'pending') AS status,
    (SELECT notes FROM public.reward_approvals ra 
     WHERE ra.user_id = p.id 
     ORDER BY ra.created_at DESC 
     LIMIT 1) AS admin_notes,
    p.created_at
  FROM public.profiles p
  WHERE p.pending_reward > 0 OR p.reward_status != 'pending'
  ORDER BY p.pending_reward DESC NULLS LAST
  LIMIT limit_count;
END;
$function$;
```

## Thay đổi chính

1. **Thêm alias `ra`** cho bảng `reward_approvals` trong subquery
2. **Qualify `ra.user_id`** thay vì chỉ `user_id`
3. **Qualify `ra.created_at`** trong ORDER BY để PostgreSQL biết rõ đang sort theo cột của bảng nào

## Kết quả mong đợi

- TopRanking component sẽ hiển thị danh sách users đúng
- Không còn lỗi 400 khi gọi `get_user_rewards_v2`
- AppHonorBoard và các component khác liên quan sẽ hoạt động bình thường

## Files bị ảnh hưởng

- Database function: `get_user_rewards_v2` (cần migration)
- Không cần sửa code frontend (đã gọi đúng)
