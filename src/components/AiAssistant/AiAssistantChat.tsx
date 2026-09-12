/* eslint-disable */
/* eslint-disable i18next/no-literal-string */
/* eslint-disable react/no-unescaped-entities */
import React, { useState, useCallback } from 'react';

import classNames from 'classnames';

import styles from './AiAssistantWidget.module.scss';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  onClose: () => void;
};

const AiAssistantChat: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: input.trim(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput('');
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: updatedMessages }),
        });

        if (!res.ok) {
          throw new Error('Gagal menghubungi AI');
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let aiText = '';

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: '',
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (reader) {
          let done = false;
          while (!done) {
            // eslint-disable-next-line no-await-in-loop
            const result = await reader.read();
            done = result.done;
            if (result.value) {
              aiText += decoder.decode(result.value, { stream: true });
              setMessages((prev) =>
                prev.map((m) => (m.id === aiMessage.id ? { ...m, content: aiText } : m)),
              );
            }
          }
        }
      } catch {
        const errMessage: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        };
        setMessages((prev) => [...prev, errMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages],
  );

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <div className={styles.title}>Quran AI Tsirwah</div>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close Chat"
        >
          ✕
        </button>
      </div>

      <div className={styles.messageList}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <strong>Assalamu&apos;alaikum!</strong> <br />
            Silakan tanya apa saja seputar Al-Quran. AI akan membantu mencari referensi dari Tafsir
            Kemenag.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={classNames(styles.messageLine, {
              [styles.userMessage]: m.role === 'user',
              [styles.aiMessage]: m.role === 'assistant',
            })}
          >
            <div className={styles.bubble}>{m.content}</div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className={classNames(styles.messageLine, styles.aiMessage)}>
            <div className={styles.bubble}>AI sedang memikirkan jawaban...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik pertanyaan tentang ayat..."
          className={styles.inputField}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input} className={styles.sendButton}>
          Kirim
        </button>
      </form>
    </div>
  );
};

export default AiAssistantChat;
