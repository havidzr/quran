/* eslint-disable react-func/max-lines-per-function */
import fs from 'fs';
import path from 'path';

// In-memory cache agar tidak membaca berkas disk JSON secara berulang
const tafsirFileCache = new Map<string, Record<string, string>>();

function getTafsirData(filePath: string): Record<string, string> | null {
  if (tafsirFileCache.has(filePath)) {
    return tafsirFileCache.get(filePath)!;
  }
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      tafsirFileCache.set(filePath, parsed);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export default function handler(req, res) {
  const { tafsirId, verseKey } = req.query;

  if (!verseKey || typeof verseKey !== 'string') {
    return res.status(400).json({ error: 'verseKey is required' });
  }

  const [chapter, verse] = verseKey.split(':');

  if (!chapter || !verse) {
    return res.status(400).json({ error: 'Invalid verseKey format. Expected chapter:verse' });
  }

  if (tafsirId === 'id-tafsir-tahlili' || tafsirId === 'id-tafsir-ringkas-kemenag') {
    try {
      let text = '';

      if (tafsirId === 'id-tafsir-ringkas-kemenag') {
        const kemenagPath = path.join(
          process.cwd(),
          'public',
          'data',
          'tafsir',
          'kemenag',
          `${chapter}.json`,
        );
        const kemenagData = getTafsirData(kemenagPath);
        if (kemenagData) {
          text = kemenagData[verse] || '';
        }
      } else if (tafsirId === 'id-tafsir-tahlili') {
        const tahliliPath = path.join(
          process.cwd(),
          'public',
          'data',
          'tafsir',
          'tahlili',
          `${chapter}.json`,
        );
        const tahliliData = getTafsirData(tahliliPath);
        if (tahliliData) {
          text = tahliliData[verse] || '';
        }
      }

      // Format text with paragraph breaks if needed
      const formattedText = text.replace(/\n/g, '<br></br>');

      return res.status(200).json({
        tafsir: {
          text: formattedText,
          languageId: 67, // Indonesian language ID used by QDC
          languageName: 'indonesian',
        },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error while reading local tafsir' });
    }
  }

  // Fallback for other non-local tafsirs if they ever hit this endpoint.
  return res.status(404).json({ error: 'Tafsir not found locally' });
}
