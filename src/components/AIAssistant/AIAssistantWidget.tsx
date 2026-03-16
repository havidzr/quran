import React, { useState } from 'react';
import AIAssistantChat from './AIAssistantChat';
import styles from './AIAssistantWidget.module.scss';

const AIAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.container}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <AIAssistantChat onClose={() => setIsOpen(false)} />
        </div>
      )}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={styles.fabButton}
          aria-label="Tanya AI"
        >
          {/* Simple Sparkle / Bot Icon */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default AIAssistantWidget;
