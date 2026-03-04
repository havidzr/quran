/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';

import useTranslation from 'next-translate/useTranslation';

import styles from './Trigger.module.scss';

import Button, { ButtonShape, ButtonVariant } from '@/dls/Button/Button';
import Modal from '@/dls/Modal/Modal';
import MicrophoneIcon from '@/icons/microphone.svg';

interface Props {
  isCommandBar?: boolean;
  onClick?: (startFlow: boolean) => void;
}

const TarteelVoiceSearchTrigger: React.FC<Props> = ({ isCommandBar, onClick }) => {
  const { t } = useTranslation('common');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onMicClicked = () => {
    if (onClick) {
      onClick(true);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <Button
        onClick={onMicClicked}
        shape={ButtonShape.Circle}
        variant={ButtonVariant.Ghost}
        className={styles.button}
        tooltip={t('command-bar.search-by-voice')}
        hasSidePadding={false}
        ariaLabel={t('command-bar.search-by-voice')}
      >
        <MicrophoneIcon />
      </Button>

      <Modal isOpen={isModalOpen} onClickOutside={closeModal} onEscapeKeyDown={closeModal}>
        <Modal.Body>
          <Modal.Header>
            <Modal.Title>Beralih ke Quran.com?</Modal.Title>
          </Modal.Header>
          <div style={{ padding: '10px 0', lineHeight: '1.6' }}>
            <p>Fitur pencarian suara saat ini didukung oleh Tarteel via Quran.com.</p>
            <div
              style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: 'var(--color-background-alternate)',
                borderRadius: '8px',
                fontSize: '0.9rem',
              }}
            >
              <strong>💡 Tips:</strong> Setelah menemukan ayat yang Anda cari di sana,{' '}
              <strong>kembali lagi ke Quran Tsirwah ya!</strong> Di sini Anda bisa menikmati Tafsir
              Kemenag & Tahlili berbahasa Indonesia dengan tampilan yang lebih simpel.
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Modal.CloseAction onClick={closeModal}>Batal</Modal.CloseAction>
          <a
            href="https://quran.com/search?page"
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeModal}
            style={{ textDecoration: 'none' }}
          >
            <Button>Lanjutkan ke Tarteel 🎙️</Button>
          </a>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default TarteelVoiceSearchTrigger;
