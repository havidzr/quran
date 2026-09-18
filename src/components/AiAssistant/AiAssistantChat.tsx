/* eslint-disable */
/* eslint-disable i18next/no-literal-string */
/* eslint-disable react/no-unescaped-entities */
import React, { useState, useCallback, useRef, useEffect } from 'react';
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

const SUGGESTIONS = [
  { label: 'Tafsir Surah Al-Fatihah', query: 'Jelaskan tafsir singkat dan keutamaan Surah Al-Fatihah' },
  { label: 'Doa untuk kedua orang tua', query: 'Apa ayat dan doa di Al-Quran tentang berbakti kepada kedua orang tua?' },
  { label: 'Ayat penenang hati & sabar', query: 'Tolong carikan ayat Al-Quran penenang hati saat menghadapi ujian hidup' },
  { label: 'Keutamaan Surah Al-Mulk', query: 'Apa saja keutamaan membaca Surah Al-Mulk setiap malam?' },
];

const AiAssistantChat: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
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
          content: 'Maaf, terjadi kendala saat menghubungkan ke asisten AI. Silakan coba kembali sesaat lagi.',
        };
        setMessages((prev) => [...prev, errMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleResetChat = () => {
    setMessages([]);
  };

  return (
    <div className={styles.chatContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.botAvatar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
          <div className={styles.headerText}>
            <div className={styles.title}>Quran AI Tsirwah</div>
            <div className={styles.subtitleWrapper}>
              <span className={styles.statusIndicator} />
              <span className={styles.subtitle}>Tafsir Kemenag RI</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleResetChat}
              className={styles.actionButton}
              title="Mulai Percakapan Baru"
              aria-label="Mulai Percakapan Baru"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={styles.actionButton}
            aria-label="Tutup Chat"
            title="Tutup Chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.messageList}>
        {messages.length === 0 ? (
          <div className={styles.emptyStateCard}>
            <div className={styles.welcomeGreeting}>Assalamu'alaikum!</div>
            <p className={styles.welcomeDesc}>
              Saya asisten cerdas <strong>Quran Tsirwah</strong>. Silakan tanyakan makna ayat, tafsir Kemenag, atau panduan Al-Quran seputar kehidupan sehari-hari.
            </p>
            <div className={styles.suggestionsTitle}>Pertanyaan Populer:</div>
            <div className={styles.suggestionList}>
              {SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(item.query)}
                  className={styles.chipButton}
                >
                  <span className={styles.chipIcon}>✦</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={classNames(styles.messageLine, {
                [styles.userMessage]: m.role === 'user',
                [styles.aiMessage]: m.role === 'assistant',
              })}
            >
              {m.role === 'assistant' && (
                <div className={styles.messageAvatar}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                </div>
              )}
              <div className={styles.bubble}>{m.content}</div>
            </div>
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className={classNames(styles.messageLine, styles.aiMessage)}>
            <div className={styles.messageAvatar}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div className={classNames(styles.bubble, styles.typingBubble)}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      <footer className={styles.inputArea}>
        <form onSubmit={onSubmit} className={styles.inputForm}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan tafsir atau makna ayat..."
            className={styles.inputField}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={styles.sendButton}
            aria-label="Kirim Pesan"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <div className={styles.disclaimer}>
          Quran Tsirwah AI • Rujukan Tafsir Kemenag RI
        </div>
      </footer>
    </div>
  );
};

export default AiAssistantChat;
