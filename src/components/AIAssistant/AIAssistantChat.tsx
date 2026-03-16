import React from 'react';
import classNames from 'classnames';
// @ts-ignore
import { useChat } from 'ai/react';
import styles from './AIAssistantWidget.module.scss';

type Props = {
  onClose: () => void;
};

const AIAssistantChat: React.FC<Props> = ({ onClose }) => {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    initialMessages: [],
  });

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <div className={styles.title}>Quran AI Tsirwah</div>
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close Chat">
          ✕
        </button>
      </div>

      <div className={styles.messageList}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <strong>Assalamu'alaikum!</strong> <br />
            Silakan tanya apa saja seputar Al-Quran. AI akan membantu mencari referensi dari Tafsir Kemenag dan menerbitkannya untuk Anda.
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
        {isLoading && (
          <div className={classNames(styles.messageLine, styles.aiMessage)}>
            <div className={styles.bubble}>AI sedang memikirkan jawaban...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
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

export default AIAssistantChat;
