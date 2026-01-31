
# Kế hoạch: Sửa lỗi trang Law of Light bị kẹt "Đang xử lý..."

## Nguyên nhân

Sau khi phân tích code và network logs, tôi đã xác định được nguyên nhân:

### Vấn đề 1: Race condition giữa useEffect và handleAccept

Khi user đã đăng nhập và đã chấp nhận Law of Light:
1. Trang `/law-of-light` load và render UI ngay lập tức
2. `useEffect` chạy async `checkAuth()` để kiểm tra trạng thái
3. Trong khi đợi response từ database, **user có thể click nút** (vì UI đã hiển thị đầy đủ)
4. Nếu user click → `setLoading(true)` → nút hiển thị "Đang xử lý..."
5. `checkAuth()` hoàn thành → thấy đã accepted → gọi `navigate('/')`
6. Trang navigate đi nhưng có thể xảy ra xung đột state

### Vấn đề 2: Không có loading state khi kiểm tra auth

Trang render ngay checkboxes và nút submit mà không đợi kết quả kiểm tra auth. Điều này cho phép user tương tác trước khi biết trạng thái thực sự.

### Vấn đề 3: Không handle error từ update profile

```typescript
await supabase.from('profiles').update({...}).eq('id', session.user.id);
// Không destructure error → không biết có lỗi hay không
```

---

## Giải pháp

### A) Thêm loading state khi kiểm tra auth (ưu tiên)

Thêm state `isCheckingAuth` để ngăn user tương tác khi đang kiểm tra:

```typescript
const [isCheckingAuth, setIsCheckingAuth] = useState(true);

useEffect(() => {
  const checkAuth = async () => {
    setIsCheckingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('law_of_light_accepted')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.law_of_light_accepted) {
          navigate('/');
          return; // Early return - không cần set isCheckingAuth
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };
  checkAuth();
}, [location, navigate]);
```

Sau đó disable button khi đang check:

```typescript
<Button
  onClick={handleAccept}
  disabled={!allChecked || loading || isCheckingAuth}
  ...
>
```

### B) Cải thiện error handling trong handleAccept

```typescript
const handleAccept = async () => {
  if (!allChecked) return;
  setLoading(true);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const { error } = await supabase.from('profiles').update({
        law_of_light_accepted: true,
        law_of_light_accepted_at: new Date().toISOString()
      }).eq('id', session.user.id);
      
      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Có lỗi xảy ra, vui lòng thử lại');
        return; // Exit early nếu có lỗi
      }
      
      toast.success('🌟 Con đã sẵn sàng bước vào Ánh Sáng!');
      navigate('/');
    } else {
      localStorage.setItem('law_of_light_accepted_pending', 'true');
      toast.success('🌟 Con đã sẵn sàng bước vào Ánh Sáng!');
      navigate('/auth');
    }
  } catch (error) {
    console.error('Error accepting law of light:', error);
    toast.error('Có lỗi xảy ra, vui lòng thử lại');
  } finally {
    setLoading(false);
  }
};
```

### C) Hiển thị loading screen trong khi kiểm tra auth

Thay vì render UI đầy đủ ngay lập tức, hiển thị loading spinner cho đến khi biết trạng thái user:

```typescript
if (isCheckingAuth) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-yellow-700">Đang kiểm tra...</p>
      </div>
    </div>
  );
}
```

---

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/pages/LawOfLight.tsx` | 1. Thêm state `isCheckingAuth` với giá trị mặc định `true` |
| | 2. Update useEffect để set `isCheckingAuth` phù hợp |
| | 3. Thêm loading screen khi `isCheckingAuth = true` |
| | 4. Disable button khi `isCheckingAuth = true` |
| | 5. Cải thiện error handling trong `handleAccept` |

---

## Kết quả mong đợi

1. Khi vào trang `/law-of-light`, user thấy loading spinner ngắn trong khi kiểm tra trạng thái
2. Nếu đã đăng nhập + đã accepted → redirect về `/` ngay lập tức (không thấy form)
3. Nếu chưa accepted → hiển thị form để user tick và submit
4. Nút không bị kẹt "Đang xử lý..." vì không có race condition
5. Có thông báo lỗi rõ ràng nếu update profile thất bại
