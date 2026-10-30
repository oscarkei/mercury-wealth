"use client";

/**
 * Mercury adaptation of Kokonut UI AI Input Search, MIT, v4.0.0.
 * https://kokonutui.com/r/ai-input-search.json
 * Retains its auto-resizing input and Motion transitions; uses the existing
 * Mercury request lifecycle instead of the upstream simulated tools/models.
 */
import {copy,useAppPreferences} from "../../lib/app-preferences";
import { useEffect, useRef, type RefObject } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowUp, Square } from "lucide-react";
import { useAutoResizeTextarea } from "../../hooks/use-auto-resize-textarea";

export default function MercuryComposer({
  value,
  onChange,
  onSend,
  onCancel,
  busy,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  useAppPreferences();
  const composing = useRef(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 36,
    maxHeight: 108,
  });
  useEffect(() => adjustHeight(), [value, adjustHeight]);
  return (
    <MotionConfig reducedMotion="user">
      <form
        className="chat-composer kokonut-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !composing.current && value.trim()) onSend();
        }}
      >
        <textarea
          id="chat-message"
          aria-describedby="chat-source-note"
          aria-label={copy("Your message","你的訊息","你的消息")}
          ref={(el) => {
            textareaRef.current = el;
            inputRef.current = el;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={1}
          maxLength={2500}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          placeholder={copy("Ask about your wealth…","問問你的財富狀況…","问问你的财富状况…")}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !composing.current &&
              !e.nativeEvent.isComposing &&
              e.nativeEvent.keyCode !== 229 &&
              !e.repeat
            ) {
              e.preventDefault();
              if (!busy && !composing.current && value.trim()) onSend();
            }
          }}
        />
          <button
            type={busy ? "button" : "submit"}
            className="send"
            aria-label={busy ? copy("Stop response","停止回覆","停止回复") : copy("Send message","傳送訊息","发送消息")}
            disabled={!busy && !value.trim()}
            onClick={busy ? onCancel : undefined}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={busy ? "stop" : "send"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.08 }}
              >
                {busy ? <Square size={16} fill="currentColor" strokeWidth={0} /> : <ArrowUp size={21} strokeWidth={2.5} />}
              </motion.span>
            </AnimatePresence>
          </button>
      </form>
    </MotionConfig>
  );
}
