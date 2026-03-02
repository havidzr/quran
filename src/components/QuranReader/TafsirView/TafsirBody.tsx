/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable max-lines */
/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useContext, useEffect, useState } from 'react';

import classNames from 'classnames';
import { camelizeKeys } from 'humps';
import useTranslation from 'next-translate/useTranslation';
import { useSelector, shallowEqual } from 'react-redux';
import useSWR from 'swr/immutable';

import VerseTextPreview from '../VerseTextPreview';

import LanguageAndTafsirSelection from './LanguageAndTafsirSelection';
import SurahAndAyahSelection from './SurahAndAyahSelection';
import TafsirEndOfScrollingActions from './TafsirEndOfScrollingActions';
import TafsirGroupMessage from './TafsirGroupMessage';
import TafsirMessage from './TafsirMessage';
import TafsirSkeleton from './TafsirSkeleton';
import TafsirText from './TafsirText';
import styles from './TafsirView.module.scss';

import DataFetcher from '@/components/DataFetcher';
import Separator from '@/dls/Separator/Separator';
import usePersistPreferenceGroup from '@/hooks/auth/usePersistPreferenceGroup';
import { selectQuranReaderStyles } from '@/redux/slices/QuranReader/styles';
import { selectTafsirs, setSelectedTafsirs } from '@/redux/slices/QuranReader/tafsirs';
import TafsirInfo from '@/types/TafsirInfo';
import Verse from '@/types/Verse';
import { makeTafsirContentUrl, makeTafsirsUrl } from '@/utils/apiPaths';
import { textToBlob } from '@/utils/blob';
import copyText from '@/utils/copyText';
import { INDONESIAN_KEMENAG_TAFSIR } from '@/utils/customTafsirs';
import {
  logButtonClick,
  logEvent,
  logItemSelectionChange,
  logValueChange,
} from '@/utils/eventLogger';
import { getLanguageDataById } from '@/utils/locale';
import {
  fakeNavigate,
  getVerseSelectedTafsirNavigationUrl,
  // getIndonesianVerseSelectedTafsirNavigationUrl,
} from '@/utils/navigation';
import {
  getFirstTafsirOfLanguage,
  getSelectedTafsirLanguage,
  getTafsirsLanguageOptions,
} from '@/utils/tafsir';
import { getWindowOrigin } from '@/utils/url';
import {
  getVerseAndChapterNumbersFromKey,
  getVerseNumberFromKey,
  getFirstAndLastVerseKeys,
  makeVerseKey,
  isLastVerseOfSurah,
} from '@/utils/verse';
import { fetcher } from 'src/api';
import DataContext from 'src/contexts/DataContext';
import { TafsirContentResponse, TafsirsResponse } from 'types/ApiResponses';
import PreferenceGroup from 'types/auth/PreferenceGroup';

type TafsirBodyProps = {
  initialChapterId: string;
  initialVerseNumber: string;
  initialTafsirIdOrSlug?: number | string;
  scrollToTop: () => void;
  shouldRender?: boolean;
  render: (renderProps: {
    surahAndAyahSelection: JSX.Element;
    languageAndTafsirSelection: JSX.Element;
    body: JSX.Element;
  }) => JSX.Element;
};

const TafsirBody = ({
  initialChapterId,
  initialVerseNumber,
  initialTafsirIdOrSlug,
  render,
  scrollToTop,
  shouldRender,
}: TafsirBodyProps) => {
  const quranReaderStyles = useSelector(selectQuranReaderStyles, shallowEqual);
  const { lang, t } = useTranslation('common');
  const tafsirsState = useSelector(selectTafsirs);
  const { selectedTafsirs: userPreferredTafsirIds } = tafsirsState;
  const chaptersData = useContext(DataContext);
  const {
    actions: { onSettingsChange },
    isLoading,
  } = usePersistPreferenceGroup();

  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [selectedVerseNumber, setSelectedVerseNumber] = useState(initialVerseNumber);
  const [selectedLanguage, setSelectedLanguage] = useState('indonesian');
  const selectedVerseKey = makeVerseKey(Number(selectedChapterId), Number(selectedVerseNumber));
  const [selectedTafsirIdOrSlug, setSelectedTafsirIdOrSlug] = useState<number | string>(
    initialTafsirIdOrSlug || userPreferredTafsirIds?.[0],
  );
  const [tafsirData, setTafsirData] = useState(null);
  // const [tafsirText, setTafsirText] = useState('');

  // if user opened tafsirBody via a url, we will have initialTafsirIdOrSlug
  // we need to set this `initialTafsirIdOrSlug` as a selectedTafsirIdOrSlug
  // we did not use `useState(initialTafsirIdOrSlug)` because `useRouter`'s query string is undefined on first render
  useEffect(() => {
    if (initialTafsirIdOrSlug) {
      logEvent('tafsir_url_access');
      setSelectedTafsirIdOrSlug(initialTafsirIdOrSlug);
    }
  }, [initialTafsirIdOrSlug]);

  const onTafsirSelected = useCallback(
    async (id: number, slug: string) => {
      logItemSelectionChange('tafsir', id);
      setSelectedTafsirIdOrSlug(slug);
      if (id !== 820 && id !== 821) {
        fakeNavigate(
          getVerseSelectedTafsirNavigationUrl(
            Number(selectedChapterId),
            Number(selectedVerseNumber),
            slug,
          ),
          lang,
        );
      } else {
        fakeNavigate(
          getVerseSelectedTafsirNavigationUrl(
            Number(selectedChapterId),
            Number(selectedVerseNumber),
            slug,
          ),
          lang,
        );
      }
      onSettingsChange(
        'selectedTafsirs',
        [slug],
        setSelectedTafsirs({
          tafsirs: [slug],
          locale: lang,
        }),
        setSelectedTafsirs({
          tafsirs: tafsirsState.selectedTafsirs,
          locale: lang,
        }),
        PreferenceGroup.TAFSIRS,
      );
    },
    [lang, onSettingsChange, selectedChapterId, selectedVerseNumber, tafsirsState],
  );

  const { data: tafsirSelectionList } = useSWR<TafsirsResponse>(
    shouldRender ? makeTafsirsUrl(lang) : null,
    fetcher,
  );

  // selectedLanguage is based on selectedTafsir's language
  // but we need to fetch the data from the API first to know what is the language of `selectedTafsirIdOrSlug`
  // so we get the data from the API and set the selectedLanguage once it is loaded
  useEffect(() => {
    if (tafsirSelectionList) {
      setSelectedLanguage((prevSelectedLanguage) => {
        // if we haven't set the language already, we need to detect which language the current tafsir is in.
        return (
          prevSelectedLanguage ||
          getSelectedTafsirLanguage(tafsirSelectionList, selectedTafsirIdOrSlug)
        );
      });
    }
  }, [onTafsirSelected, selectedTafsirIdOrSlug, tafsirSelectionList]);

  // there's no 1:1 data that can map our locale options to the tafsir language options
  // so we're using options that's available from tafsir for now
  // TODO: update language options, to use the same options as our LanguageSelector
  const languageOptions = tafsirSelectionList
    ? getTafsirsLanguageOptions(tafsirSelectionList.tafsirs)
    : [];

  /**
   * Handle when the language of the Tafsir is changed. When it does,
   * we auto-select the first Tafsir of the new language based on the
   * response from BE.
   *
   * @param {string} newLang
   */
  const onLanguageSelected = (newLang: string) => {
    logValueChange('tafsir_locale', selectedLanguage, newLang);
    setSelectedLanguage(newLang);

    if (tafsirSelectionList) {
      let firstTafsirOfLanguage: TafsirInfo | null = null;
      if (newLang === 'indonesian') {
        firstTafsirOfLanguage = INDONESIAN_KEMENAG_TAFSIR as any;
      } else {
        firstTafsirOfLanguage = getFirstTafsirOfLanguage(tafsirSelectionList, newLang);
      }
      if (firstTafsirOfLanguage) {
        const { id, slug } = firstTafsirOfLanguage;
        onTafsirSelected(id, slug);
      }
    }
  };

  const fetchTafsirContent = useCallback(async () => {
    if (!shouldRender) return;
    const resolvedUrl = await makeTafsirContentUrl('ar-tafsir-al-wasit', selectedVerseKey, {
      lang,
      quranFont: quranReaderStyles.quranFont,
      mushafLines: quranReaderStyles.mushafLines,
    });

    const response = await fetch(resolvedUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch Tafsir content');
    }
    const apiData = await response.json();

    if (apiData?.tafsir) {
      const { verses } = camelizeKeys(apiData.tafsir);
      setTafsirData(verses);
    }
  }, [lang, selectedVerseKey, quranReaderStyles, shouldRender]);

  // Using useEffect to fetch the data on component mount or update
  useEffect(() => {
    fetchTafsirContent();
  }, [fetchTafsirContent]);

  function wrapTextUthmani(verseData) {
    let combinedText = '';

    // Loop through each verse's words and concatenate the text_uthmani
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const verseKey in verseData) {
      const { words } = verseData[verseKey];

      // eslint-disable-next-line no-loop-func
      words.forEach((word) => {
        combinedText += `${word.textUthmani} `;
      });
    }

    return combinedText.trim(); // Trim to remove any trailing spaces
  }

  let teksTafsir = '';

  const copyTafsirText = async () => {
    if (!tafsirData) return;

    const ayahText = wrapTextUthmani(tafsirData);
    const origin = getWindowOrigin('id');
    const [chapter, verse] = getVerseAndChapterNumbersFromKey(Object.keys(tafsirData)[0]);

    // const formattedTafsirText = tafsirText.replace(/<br><\/br>/g, '\n\n').replace(/<[^>]*>/g, '');
    const formattedTafsirText = teksTafsir.replace(/<br><\/br>/g, '\n\n').replace(/<[^>]*>/g, '');

    const textBlob = textToBlob(
      `${ayahText}\n\n${formattedTafsirText}\n\n🔗 Selengkapnya: ${origin}/${chapter}:${verse}\n\n📲 Download Aplikasi Pesantren Digital disini: https://play.google.com/store/apps/details?id=com.wnapp.id1694615184829`,
    );
    copyText(Promise.resolve(textBlob));
  };

  // Assuming `tafsirData` is stored in the component state

  const renderTafsir = useCallback(
    (data: TafsirContentResponse) => {
      if (!data) return <TafsirSkeleton />;

      const {
        verses: defaultVerses,
        text: defaultText,
        languageId: defaultLanguage,
      } = {
        verses: {},
        text: '',
        languageId: 0,
      };

      let verses = defaultVerses;
      let text = defaultText;
      let languageId = defaultLanguage;

      if (tafsirData) {
        verses = tafsirData as Record<string, Verse>;
      }

      if (!tafsirData) return <TafsirSkeleton />;
      if (data?.tafsir) {
        // eslint-disable-next-line prefer-destructuring
        // verses = data.tafsir.verses;
        // eslint-disable-next-line prefer-destructuring
        text = data.tafsir.text;

        // setTafsirText(text);
        // eslint-disable-next-line prefer-destructuring
        languageId = data.tafsir.languageId;
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
      teksTafsir = text;

      const langData = getLanguageDataById(languageId);

      const [firstVerseKey, lastVerseKey] = getFirstAndLastVerseKeys(verses);
      const [chapterNumber, verseNumber] = getVerseAndChapterNumbersFromKey(lastVerseKey);
      const hasNextVerseGroup = !isLastVerseOfSurah(
        chaptersData,
        chapterNumber,
        Number(verseNumber),
      );
      const hasPrevVerseGroup = getVerseNumberFromKey(firstVerseKey) !== 1;

      const loadNextVerseGroup = () => {
        logButtonClick('tafsir_next_verse');
        scrollToTop();
        const newVerseNumber = String(Number(getVerseNumberFromKey(lastVerseKey)) + 1);
        fakeNavigate(
          getVerseSelectedTafsirNavigationUrl(
            Number(selectedChapterId),
            Number(newVerseNumber),
            selectedTafsirIdOrSlug,
          ),
          lang,
        );
        setSelectedVerseNumber(newVerseNumber);
      };

      const loadPrevVerseGroup = () => {
        const newVerseNumber = String(Number(getVerseNumberFromKey(firstVerseKey)) - 1);
        logButtonClick('tafsir_prev_verse');
        scrollToTop();
        fakeNavigate(
          getVerseSelectedTafsirNavigationUrl(
            Number(selectedChapterId),
            Number(newVerseNumber),
            selectedTafsirIdOrSlug,
          ),
          lang,
        );
        setSelectedVerseNumber(newVerseNumber);
      };

      return (
        <div>
          {!text && (
            <TafsirMessage>
              {t('tafsir.no-text', {
                tafsirName: '',
              })}
            </TafsirMessage>
          )}
          {Object.values(verses).length > 1 && !!text && (
            <TafsirGroupMessage from={firstVerseKey} to={lastVerseKey} />
          )}
          <div className={styles.verseTextContainer}>
            <VerseTextPreview verses={Object.values(verses)} />
          </div>
          <div className={styles.separatorContainer}>
            <Separator />
          </div>
          <button type="button" className={styles.salinButton} onClick={copyTafsirText}>
            Salin Teks
          </button>
          {!!text && (
            <TafsirText direction={langData.direction} languageCode={langData.code} text={text} />
          )}
          <TafsirEndOfScrollingActions
            hasNextVerseGroup={hasNextVerseGroup}
            hasPrevVerseGroup={hasPrevVerseGroup}
            onNextButtonClicked={loadNextVerseGroup}
            onPreviousButtonClicked={loadPrevVerseGroup}
          />
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      chaptersData,
      lang,
      scrollToTop,
      selectedChapterId,
      selectedTafsirIdOrSlug,
      t,
      tafsirData,
      // tafsirsState,
    ],
  );

  const onChapterIdChange = (newChapterId) => {
    logItemSelectionChange('tafsir_chapter_id', newChapterId);
    fakeNavigate(
      getVerseSelectedTafsirNavigationUrl(Number(newChapterId), Number(1), selectedTafsirIdOrSlug),
      lang,
    );
    setSelectedChapterId(newChapterId.toString());
    setSelectedVerseNumber('1'); // reset verse number to 1 every time chapter changes
  };

  const onVerseNumberChange = (newVerseNumber) => {
    logItemSelectionChange('tafsir_verse_number', newVerseNumber);
    setSelectedVerseNumber(newVerseNumber);
    fakeNavigate(
      getVerseSelectedTafsirNavigationUrl(
        Number(selectedChapterId),
        Number(newVerseNumber),
        selectedTafsirIdOrSlug,
      ),
      lang,
    );
  };

  const surahAndAyahSelection = (
    <SurahAndAyahSelection
      selectedChapterId={selectedChapterId}
      selectedVerseNumber={selectedVerseNumber}
      onChapterIdChange={onChapterIdChange}
      onVerseNumberChange={onVerseNumberChange}
    />
  );

  const languageAndTafsirSelection = (
    <LanguageAndTafsirSelection
      selectedTafsirIdOrSlug={selectedTafsirIdOrSlug}
      selectedLanguage={selectedLanguage}
      onTafsirSelected={onTafsirSelected}
      onSelectLanguage={onLanguageSelected}
      languageOptions={languageOptions}
      data={tafsirSelectionList}
      isLoading={isLoading}
    />
  );

  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!shouldRender) return;
      const resolvedUrl = await makeTafsirContentUrl(selectedTafsirIdOrSlug, selectedVerseKey, {
        lang,
        quranFont: quranReaderStyles.quranFont,
        mushafLines: quranReaderStyles.mushafLines,
      });
      setUrl(resolvedUrl);
      // console.log(selectedTafsirIdOrSlug, selectedVerseKey, lang, quranReaderStyles);
    };

    fetchUrl();
  }, [selectedTafsirIdOrSlug, selectedVerseKey, lang, quranReaderStyles, shouldRender]);

  // if (!url) return <TafsirSkeleton />; // Show loading state until the URL is resolved

  const body = (
    <div
      className={classNames(
        styles.tafsirContainer,
        styles[`tafsir-font-size-${quranReaderStyles.tafsirFontScale}`],
      )}
      // disable browser translation for tafsir content
      // @see {https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/translate}
      translate="no"
    >
      <DataFetcher loading={TafsirSkeleton} queryKey={url} render={renderTafsir} />
    </div>
  );

  return render({ surahAndAyahSelection, languageAndTafsirSelection, body });
};

export default TafsirBody;
