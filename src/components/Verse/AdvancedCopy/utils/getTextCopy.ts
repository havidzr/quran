// eslint-disable-next-line import/no-cycle

import { MushafLines } from '@/types/QuranReader';
import { getMushafId } from '@/utils/api';
import { getWindowOrigin } from '@/utils/url';
import { getVerseAndChapterNumbersFromKey } from '@/utils/verse';
import { getAdvancedCopyRawResult } from 'src/api';

/**
 * Given these parameters, get the `text to be copied` from API
 *
 * @returns {string} textToCopy
 */
const getTextToCopy = ({
  verseKey,
  showRangeOfVerses,
  rangeStartVerse,
  rangeEndVerse,
  translations,
  shouldCopyFootnotes,
  shouldIncludeTranslatorName,
  shouldCopyFont,
}) => {
  // by default the from and to will be the current verse.
  let fromVerse = verseKey;
  let toVerse = verseKey;
  // if range of verse was selected
  if (showRangeOfVerses) {
    fromVerse = rangeStartVerse;
    toVerse = rangeEndVerse;
  }
  // copy the link
  const origin = getWindowOrigin('id');
  const [chapter, verse] = getVerseAndChapterNumbersFromKey(verseKey);
  // filter the translations
  const toBeCopiedTranslations = Object.keys(translations).filter(
    (translationId) => translations[translationId].shouldBeCopied === true,
  );
  return getAdvancedCopyRawResult({
    raw: true,
    from: fromVerse,
    to: toVerse,
    footnote: shouldCopyFootnotes,
    translatorName: shouldIncludeTranslatorName,
    ...(toBeCopiedTranslations.length > 0 && {
      translations: toBeCopiedTranslations.join(','),
    }), // only include the translations when at least 1 translation has been selected.
    ...(shouldCopyFont && {
      ...getMushafId(shouldCopyFont, MushafLines.SixteenLines),
    }), // only include the fonts when at least 1 font has been selected.
  }).then(
    (res) =>
      `${res.result}🔗 Selengkapnya: ${origin}/${chapter}/${verse}\n\n📲 Download Aplikasi Pesantren Digital disini: https://play.google.com/store/apps/details?id=com.wnapp.id1694615184829`,
  );
};

export default getTextToCopy;
