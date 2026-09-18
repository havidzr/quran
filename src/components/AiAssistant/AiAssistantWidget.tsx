import React, { useState, useContext } from 'react';
import { useSelector } from '@xstate/react';
import classNames from 'classnames';
import { AudioPlayerMachineContext } from 'src/xstate/AudioPlayerMachineContext';
import AiAssistantChat from './AiAssistantChat';
import styles from './AiAssistantWidget.module.scss';

const AiAssistantWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const audioService = useContext(AudioPlayerMachineContext);
  const isAudioPlayerHidden = useSelector(audioService, (state) =>
    audioService ? state?.matches('HIDDEN') : true,
  );

  return (
    <aside
      aria-label="Quran AI Assistant Tsirwah"
      className={classNames(styles.container, {
        [styles.audioPlayerOpen]: !isAudioPlayerHidden,
      })}
    >
      {isOpen ? (
        <div className={styles.chatWindow}>
          <AiAssistantChat onClose={() => setIsOpen(false)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={styles.fabButton}
          aria-label="Tanya Quran AI Tsirwah"
          title="Tanya Quran AI Tsirwah"
        >
          <div className={styles.fabIconWrapper}>
            <svg
              className={styles.sparkleIcon}
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              <path d="M12 7l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="currentColor" />
            </svg>
          </div>
          <span className={styles.fabLabel}>Tanya AI</span>
          <span className={styles.onlinePulse} />
        </button>
      )}
    </aside>
  );
};

export default AiAssistantWidget;
