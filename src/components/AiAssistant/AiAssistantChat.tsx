/* eslint-disable */
/* eslint-disable i18next/no-literal-string */
/* eslint-disable react/no-unescaped-entities */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames';
import styles from './AiAssistantWidget.module.scss';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
};

type Props = {
  onClose: () => void;
  audioService?: any;
};

const SESSIONS_STORAGE_KEY = 'quran_tsirwah_ai_sessions';
const OLD_STORAGE_KEY = 'quran_tsirwah_ai_history';
const MAX_SESSIONS_SAVED = 30; // Simpan hingga 30 sesi obrolan
const MAX_CONTEXT_SENT = 8;    // Kirim 8 pesan terakhir ke API

const SUGGESTIONS = [
  { label: 'Tafsir Surah Al-Fatihah', query: 'Jelaskan tafsir singkat dan keutamaan Surah Al-Fatihah' },
  { label: 'Doa untuk kedua orang tua', query: 'Apa ayat dan doa di Al-Quran tentang berbakti kepada kedua orang tua?' },
  { label: 'Ayat penenang hati & sabar', query: 'Tolong carikan ayat Al-Quran penenang hati saat menghadapi ujian hidup' },
  { label: 'Keutamaan Surah Al-Mulk', query: 'Apa saja keutamaan membaca Surah Al-Mulk setiap malam?' },
];

function formatSessionTime(timestamp: number) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hari ini, ${timeStr}`;
    return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  } catch {
    return '';
  }
}

// Helper parsing dan rendering teks dengan format Al-Quran
const FormattedMessage: React.FC<{
  content: string;
  onPlayAyah?: (surah: number, ayah: number) => void;
  onSelectFollowUp?: (q: string) => void;
}> = ({ content, onPlayAyah, onSelectFollowUp }) => {
  let mainContent = content;
  const followUps: string[] = [];

  const recIndex = content.indexOf('Rekomendasi Lanjutan:');
  if (recIndex !== -1) {
    mainContent = content.slice(0, recIndex).trim();
    const followUpSection = content.slice(recIndex);
    const lines = followUpSection.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-*•]\s*\[?([^\]\n]+)\]?/);
      if (match && match[1] && !match[1].toLowerCase().includes('rekomendasi')) {
        followUps.push(match[1].trim());
      }
    }
  }

  const lines = mainContent.split('\n');

  const renderFormattedLine = (line: string, lineIdx: number) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={lineIdx} className={styles.emptyLine} />;

    const arabicMatch = trimmed.match(/[\u0600-\u06FF]/g);
    const isArabicVerse = arabicMatch && arabicMatch.length > 8 && !trimmed.startsWith('>') && !trimmed.startsWith('**');

    if (isArabicVerse) {
      return (
        <div key={lineIdx} className={styles.arabicVerse} dir="rtl">
          {trimmed}
        </div>
      );
    }

    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '').replace(/^"|"$/g, '');
      return (
        <blockquote key={lineIdx} className={styles.quoteBlock}>
          "{quoteText}"
        </blockquote>
      );
    }

    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;

    const inlineRegex = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineRegex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.substring(lastIndex, match.index));
      }

      if (match[2]) {
        parts.push(<strong key={keyIdx++} className={styles.boldText}>{match[2]}</strong>);
      } else if (match[3] && match[4]) {
        const linkText = match[3];
        const linkUrl = match[4];

        const verseMatch = linkUrl.match(/\/(\d{1,3})\/(\d{1,3})/);
        const chapterNum = verseMatch ? parseInt(verseMatch[1], 10) : null;
        const ayahNum = verseMatch ? parseInt(verseMatch[2], 10) : null;

        parts.push(
          <span key={keyIdx++} className={styles.verseLinkGroup}>
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.verseLink}
              title={`Buka ${linkText} di Mushaf`}
            >
              <span>{linkText}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
            {chapterNum && ayahNum && onPlayAyah && (
              <button
                type="button"
                onClick={() => onPlayAyah(chapterNum, ayahNum)}
                className={styles.playAudioBtn}
                title={`Dengarkan Tilawah QS. ${chapterNum}:${ayahNum}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Putar</span>
              </button>
            )}
          </span>
        );
      }

      lastIndex = inlineRegex.lastIndex;
    }

    if (lastIndex < remaining.length) {
      parts.push(remaining.substring(lastIndex));
    }

    return (
      <div key={lineIdx} className={styles.textLine}>
        {parts}
      </div>
    );
  };

  return (
    <div className={styles.messageContent}>
      {lines.map((l, i) => renderFormattedLine(l, i))}

      {followUps.length > 0 && onSelectFollowUp && (
        <div className={styles.followUpCard}>
          <div className={styles.followUpLabel}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span>Pertanyaan Lanjutan:</span>
          </div>
          <div className={styles.followUpList}>
            {followUps.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectFollowUp(q)}
                className={styles.followUpButton}
              >
                ✦ {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AiAssistantChat: React.FC<Props> = ({ onClose, audioService }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadedFromStorage, setIsLoadedFromStorage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // 1. Ambil daftar sesi percakapan dari localStorage saat widget dibuka
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        let loadedSessions: ChatSession[] = [];
        const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            loadedSessions = parsed;
          }
        }

        // Migrasi otomatis dari chat tunggal lama jika ada
        const oldHistory = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldHistory) {
          try {
            const parsedOld = JSON.parse(oldHistory);
            if (Array.isArray(parsedOld) && parsedOld.length > 0) {
              const firstUserText = parsedOld.find((m) => m.role === 'user')?.content || 'Percakapan Sebelumnya';
              const migratedSession: ChatSession = {
                id: `session-${Date.now()}`,
                title: firstUserText.slice(0, 45),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: parsedOld,
              };
              loadedSessions.unshift(migratedSession);
              localStorage.removeItem(OLD_STORAGE_KEY);
            }
          } catch (_) {}
        }

        setSessions(loadedSessions);

        // Jika belum ada sesi sama sekali, langsung buka obrolan baru
        if (loadedSessions.length === 0) {
          setActiveSessionId('new');
        } else {
          // Jika ada riwayat, buka halaman daftar riwayat sesi (session hub)
          setActiveSessionId(null);
        }
      }
    } catch (err) {
      console.warn('Gagal memuat riwayat sesi', err);
    } finally {
      setIsLoadedFromStorage(true);
    }
  }, []);

  // 2. Simpan setiap pembaruan sesi ke localStorage
  useEffect(() => {
    if (!isLoadedFromStorage) return;
    try {
      if (typeof window !== 'undefined') {
        const trimmed = sessions.slice(0, MAX_SESSIONS_SAVED);
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
      }
    } catch (err) {
      console.warn('Gagal menyimpan sesi', err);
    }
  }, [sessions, isLoadedFromStorage]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;
  const currentMessages = activeSession ? activeSession.messages : [];

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      scrollToBottom();
    }
  }, [currentMessages, isLoading, activeSessionId, scrollToBottom]);

  const handlePlayAyah = useCallback(
    (surah: number, ayahNumber: number) => {
      if (audioService) {
        audioService.send({
          type: 'PLAY_AYAH',
          surah,
          ayahNumber,
        });
      }
    },
    [audioService],
  );

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (_) {}
  }, []);

  // Buat sesi obrolan baru
  const handleStartNewChat = () => {
    setActiveSessionId('new');
    setInput('');
  };

  // Hapus satu sesi tertentu
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const confirmed = window.confirm('Hapus riwayat obrolan ini?');
    if (confirmed) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    }
  };

  const handleSend = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };

      // Tentukan sesi yang sedang dipakai
      let currentSessionId = activeSessionId;
      let existingMessages: Message[] = [];

      if (!currentSessionId || currentSessionId === 'new') {
        // Buat sesi baru
        const newId = `session-${Date.now()}`;
        const newSession: ChatSession = {
          id: newId,
          title: trimmed.slice(0, 45),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [userMessage],
        };
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newId);
        currentSessionId = newId;
        existingMessages = [userMessage];
      } else {
        // Tambahkan ke sesi yang sudah ada
        const found = sessions.find((s) => s.id === currentSessionId);
        existingMessages = found ? [...found.messages, userMessage] : [userMessage];
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, updatedAt: Date.now(), messages: existingMessages }
              : s,
          ),
        );
      }

      setInput('');
      setIsLoading(true);

      try {
        const recentContext = existingMessages.slice(-MAX_CONTEXT_SENT);

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: recentContext }),
        });

        if (!res.ok) {
          let errMsg = 'Gagal menghubungi AI';
          try {
            const errJson = await res.json();
            if (errJson.message) errMsg = errJson.message;
          } catch (_) {}
          throw new Error(errMsg);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let aiText = '';

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: '',
        };

        // Tambah pesan AI kosong dulu untuk streaming
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: [...s.messages, aiMessage] }
              : s,
          ),
        );

        if (reader) {
          let done = false;
          while (!done) {
            // eslint-disable-next-line no-await-in-loop
            const result = await reader.read();
            done = result.done;
            if (result.value) {
              aiText += decoder.decode(result.value, { stream: true });
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === currentSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === aiMessage.id ? { ...m, content: aiText } : m,
                        ),
                      }
                    : s,
                ),
              );
            }
          }
        }
      } catch (err: any) {
        const errMessage: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: err?.message || 'Maaf, terjadi kendala saat menghubungkan ke asisten AI. Silakan coba kembali sesaat lagi.',
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, messages: [...s.messages, errMessage] }
              : s,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, isLoading, sessions],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  // TAMPILAN 1: DAFTAR KARTU RIWAYAT OBROLAN (SESSION HUB)
  if (!activeSessionId) {
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
                <span className={styles.subtitle}>Riwayat Percakapan Anda</span>
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
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

        <div className={styles.sessionsHub}>
          {/* Tombol Utama: Mulai Obrolan Baru */}
          <button
            type="button"
            onClick={handleStartNewChat}
            className={styles.newChatBanner}
          >
            <div className={styles.newChatBannerLeft}>
              <div className={styles.newChatIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className={styles.newChatText}>
                <div className={styles.newChatTitle}>Mulai Obrolan Baru</div>
                <div className={styles.newChatSubtitle}>Tanyakan topik atau ayat Al-Quran baru</div>
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Daftar Kartu Riwayat */}
          <div className={styles.sessionsSectionHeader}>
            <span>Riwayat Sebelumnya ({sessions.length})</span>
          </div>

          {sessions.length === 0 ? (
            <div className={styles.emptySessionsCard}>
              <p>Belum ada riwayat obrolan sebelumnya.</p>
              <button
                type="button"
                onClick={handleStartNewChat}
                className={styles.emptyStartBtn}
              >
                Mulai Tanya Sekarang
              </button>
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((sess) => {
                const lastMsg = sess.messages[sess.messages.length - 1]?.content || 'Percakapan kosong';
                return (
                  <div
                    key={sess.id}
                    onClick={() => setActiveSessionId(sess.id)}
                    className={styles.sessionCard}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.sessionCardLeft}>
                      <div className={styles.sessionCardIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div className={styles.sessionCardInfo}>
                        <div className={styles.sessionCardTitle}>{sess.title}</div>
                        <div className={styles.sessionCardSnippet}>{lastMsg}</div>
                        <div className={styles.sessionCardDate}>{formatSessionTime(sess.updatedAt)}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, sess.id)}
                      className={styles.sessionDeleteBtn}
                      title="Hapus Obrolan Ini"
                      aria-label="Hapus Obrolan"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // TAMPILAN 2: RUANG CHAT SESI AKTIF
  return (
    <div className={styles.chatContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            onClick={() => setActiveSessionId(null)}
            className={styles.backButton}
            title="Kembali ke Daftar Riwayat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Riwayat</span>
          </button>
          <div className={styles.headerText}>
            <div className={styles.title}>
              {activeSession ? activeSession.title : 'Obrolan Baru'}
            </div>
            <div className={styles.subtitleWrapper}>
              <span className={styles.statusIndicator} />
              <span className={styles.subtitle}>Asisten Tafsir Kemenag RI</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleStartNewChat}
            className={styles.actionButton}
            title="Mulai Obrolan Baru (+)"
            aria-label="Mulai Obrolan Baru"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
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
        {currentMessages.length === 0 ? (
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
          currentMessages.map((m) => (
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
              <div className={styles.bubble}>
                {m.role === 'assistant' ? (
                  <>
                    <FormattedMessage
                      content={m.content}
                      onPlayAyah={handlePlayAyah}
                      onSelectFollowUp={handleSend}
                    />
                    {m.content && !isLoading && (
                      <div className={styles.bubbleFooter}>
                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, m.content)}
                          className={styles.copyButton}
                          title="Salin Pesan"
                        >
                          {copiedId === m.id ? (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span style={{ color: '#10b981' }}>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              <span>Salin</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && currentMessages[currentMessages.length - 1]?.role === 'user' && (
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
