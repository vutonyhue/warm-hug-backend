
# Kế hoạch: Thêm tính năng Voice Message vào packages/chat/

## Mục đích Demo

Minh họa cách **Team Chat làm việc độc lập** trong thư mục `packages/chat/` mà không ảnh hưởng đến các phần khác của dự án. Tất cả thay đổi sẽ chỉ nằm trong `packages/chat/src/`.

---

## Tổng quan tính năng Voice Message

Cho phép người dùng:
1. **Nhấn giữ nút micro** để ghi âm tin nhắn giọng nói
2. **Xem preview** trước khi gửi (có thể nghe lại, hủy, hoặc gửi)
3. **Phát lại** voice message trong cuộc hội thoại

---

## Cấu trúc files thay đổi (CHỈ trong packages/chat/)

```text
packages/chat/src/
├── components/
│   ├── ChatInput.tsx          # ← Sửa: thêm VoiceRecordButton
│   ├── VoiceRecordButton.tsx  # ← MỚI: Component ghi âm
│   ├── VoicePreview.tsx       # ← MỚI: Preview trước khi gửi
│   ├── VoicePlayer.tsx        # ← MỚI: Phát voice trong bubble
│   └── MessageBubble.tsx      # ← Sửa: hiển thị VoicePlayer
├── hooks/
│   └── useVoiceRecorder.ts    # ← MỚI: Hook quản lý ghi âm
├── types.ts                   # ← Sửa: thêm media_type 'voice'
└── index.ts                   # ← Sửa: export components mới
```

---

## Chi tiết Implementation

### 1. Hook: useVoiceRecorder.ts (MỚI)

Hook quản lý toàn bộ logic ghi âm sử dụng Web Audio API.

```typescript
// packages/chat/src/hooks/useVoiceRecorder.ts

interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  clearRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>();

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      // Cleanup stream
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    
    // Duration timer
    timerRef.current = window.setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  // ... cancelRecording, clearRecording
}
```

### 2. Component: VoiceRecordButton.tsx (MỚI)

Nút micro trong ChatInput - nhấn giữ để ghi âm.

```typescript
// packages/chat/src/components/VoiceRecordButton.tsx

interface VoiceRecordButtonProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  disabled?: boolean;
}

export function VoiceRecordButton({ 
  onRecordingComplete, 
  disabled 
}: VoiceRecordButtonProps) {
  const { state, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  
  return (
    <button
      className={cn(
        "p-2 rounded-full transition-all",
        state.isRecording 
          ? "bg-red-500 text-white animate-pulse" 
          : "hover:bg-accent"
      )}
      onMouseDown={startRecording}
      onMouseUp={() => {
        stopRecording();
        if (state.audioBlob) {
          onRecordingComplete(state.audioBlob, state.duration);
        }
      }}
      onMouseLeave={cancelRecording} // Hủy nếu kéo chuột ra
      disabled={disabled}
    >
      <Mic className="h-5 w-5" />
      {state.isRecording && (
        <span className="ml-1 text-xs">{formatDuration(state.duration)}</span>
      )}
    </button>
  );
}
```

### 3. Component: VoicePreview.tsx (MỚI)

Preview voice message trước khi gửi.

```typescript
// packages/chat/src/components/VoicePreview.tsx

interface VoicePreviewProps {
  audioUrl: string;
  duration: number;
  onSend: () => void;
  onCancel: () => void;
  isSending: boolean;
}

export function VoicePreview({
  audioUrl,
  duration,
  onSend,
  onCancel,
  isSending,
}: VoicePreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
      {/* Play/Pause button */}
      <button onClick={togglePlay} className="p-2 rounded-full bg-primary text-white">
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      
      {/* Waveform visualization (simplified) */}
      <div className="flex-1 h-8 bg-background rounded flex items-center px-2">
        <div className="w-full h-1 bg-primary/30 rounded relative">
          <div 
            className="absolute h-full bg-primary rounded" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Duration */}
      <span className="text-sm text-muted-foreground">{formatDuration(duration)}</span>
      
      {/* Actions */}
      <button onClick={onCancel} className="p-2 hover:bg-background rounded-full">
        <Trash2 className="h-4 w-4 text-destructive" />
      </button>
      <button 
        onClick={onSend} 
        disabled={isSending}
        className="p-2 bg-primary text-white rounded-full"
      >
        <Send className="h-4 w-4" />
      </button>
      
      <audio ref={audioRef} src={audioUrl} />
    </div>
  );
}
```

### 4. Component: VoicePlayer.tsx (MỚI)

Phát voice message trong MessageBubble.

```typescript
// packages/chat/src/components/VoicePlayer.tsx

interface VoicePlayerProps {
  url: string;
  duration?: number;
  isOwn: boolean;
}

export function VoicePlayer({ url, duration, isOwn }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  return (
    <div className={cn(
      "flex items-center gap-2 min-w-[200px]",
      isOwn ? "text-primary-foreground" : ""
    )}>
      <button 
        onClick={togglePlay}
        className="p-2 rounded-full bg-background/20"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      
      {/* Progress bar */}
      <div className="flex-1 h-1 bg-background/30 rounded">
        <div 
          className="h-full bg-current rounded transition-all" 
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Time */}
      <span className="text-xs opacity-70">
        {formatDuration(isPlaying ? currentTime : (duration || 0))}
      </span>
      
      <audio ref={audioRef} src={url} />
    </div>
  );
}
```

### 5. Cập nhật ChatInput.tsx

Thêm VoiceRecordButton và VoicePreview.

```typescript
// Thay đổi trong ChatInput.tsx

import { VoiceRecordButton } from './VoiceRecordButton';
import { VoicePreview } from './VoicePreview';

export function ChatInput({ ... }) {
  // Thêm state cho voice
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);

  const handleVoiceRecorded = (blob: Blob, duration: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(duration);
    setVoicePreviewUrl(URL.createObjectURL(blob));
  };

  const handleSendVoice = async () => {
    if (!voiceBlob || !uploadMedia) return;
    
    // Convert blob to File và upload
    const file = new File([voiceBlob], 'voice.webm', { type: 'audio/webm' });
    const { url } = await uploadMedia(file);
    
    await onSend('', [url]); // Gửi như media với type 'voice'
    clearVoice();
  };

  return (
    <div className={cn("border-t bg-card p-3", className)}>
      {/* Voice Preview (khi đã ghi âm xong) */}
      {voicePreviewUrl && (
        <VoicePreview
          audioUrl={voicePreviewUrl}
          duration={voiceDuration}
          onSend={handleSendVoice}
          onCancel={clearVoice}
          isSending={isSending}
        />
      )}

      {/* Normal input area (ẩn khi có voice preview) */}
      {!voicePreviewUrl && (
        <div className="flex items-end gap-2">
          {/* ... existing buttons ... */}
          
          {/* NEW: Voice Record Button */}
          <VoiceRecordButton
            onRecordingComplete={handleVoiceRecorded}
            disabled={isDisabled || mediaFiles.length > 0}
          />
          
          {/* ... textarea và send button ... */}
        </div>
      )}
    </div>
  );
}
```

### 6. Cập nhật MessageBubble.tsx

Hiển thị VoicePlayer cho voice messages.

```typescript
// Thêm vào MessageBubble.tsx

import { VoicePlayer } from './VoicePlayer';

// Trong phần render media:
{message.media_type === 'voice' && message.media_url && (
  <VoicePlayer 
    url={message.media_url} 
    isOwn={isOwn}
  />
)}

// Với image/video thì giữ nguyên logic cũ
{message.media_type !== 'voice' && mediaUrls.length > 0 && (
  // ... existing image rendering
)}
```

### 7. Cập nhật types.ts

Mở rộng media_type để bao gồm 'voice'.

```typescript
// Trong Message interface
export interface Message {
  // ... existing fields
  media_type: 'image' | 'video' | 'voice' | null;
  voice_duration?: number; // Optional: thời lượng voice
}
```

### 8. Cập nhật index.ts (exports)

```typescript
// Thêm exports mới
export { VoiceRecordButton } from './components/VoiceRecordButton';
export { VoicePreview } from './components/VoicePreview';
export { VoicePlayer } from './components/VoicePlayer';
export { useVoiceRecorder } from './hooks/useVoiceRecorder';
```

---

## Files được tạo/sửa (CHỈ trong packages/chat/)

| File | Hành động | Mô tả |
|------|-----------|-------|
| `packages/chat/src/hooks/useVoiceRecorder.ts` | Tạo mới | Hook ghi âm |
| `packages/chat/src/components/VoiceRecordButton.tsx` | Tạo mới | Nút ghi âm |
| `packages/chat/src/components/VoicePreview.tsx` | Tạo mới | Preview voice |
| `packages/chat/src/components/VoicePlayer.tsx` | Tạo mới | Phát voice |
| `packages/chat/src/components/ChatInput.tsx` | Sửa | Tích hợp voice |
| `packages/chat/src/components/MessageBubble.tsx` | Sửa | Hiển thị voice |
| `packages/chat/src/types.ts` | Sửa | Thêm voice type |
| `packages/chat/src/index.ts` | Sửa | Export mới |

---

## Minh họa Workflow Team Chat

Demo này thể hiện rõ:

1. **Phạm vi làm việc rõ ràng**: Tất cả thay đổi chỉ trong `packages/chat/src/`
2. **Không ảnh hưởng code khác**: Không chạm vào `src/`, `packages/core/`, hay bất kỳ module nào khác
3. **Self-contained**: Voice feature hoàn toàn nằm trong chat module
4. **Dependency Injection**: Upload function được inject từ host app qua `ChatProvider`

---

## Luồng hoạt động

```text
┌─────────────────────────────────────────────────────────────┐
│                      ChatInput                               │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ 📷 Image│  │ 😀 Emoji│  │ 🎤 Voice Btn │  │  Textarea │ │
│  └─────────┘  └─────────┘  └──────────────┘  └───────────┘ │
│                                    │                         │
│                          Nhấn giữ để ghi âm                  │
│                                    ▼                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              VoicePreview (sau khi ghi xong)            ││
│  │   ▶️ ═══════════════════════ 0:15   🗑️  📤           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Gửi
┌─────────────────────────────────────────────────────────────┐
│                    MessageBubble (voice)                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │   ▶️ ════════════════════  0:15                        ││
│  │                                      VoicePlayer        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                 10:30 ✓✓    │
└─────────────────────────────────────────────────────────────┘
```
