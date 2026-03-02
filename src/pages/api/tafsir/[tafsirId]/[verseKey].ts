import fs from 'fs';
import path from 'path';

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
            const kemenagPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'kemenag', `${chapter}.json`);
            const tahliliPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'tahlili', `${chapter}.json`);

            let kemenagText = '';
            let tahliliText = '';

            if (fs.existsSync(kemenagPath)) {
                const kemenagData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
                kemenagText = kemenagData[verse] || '';
            }

            if (fs.existsSync(tahliliPath)) {
                const tahliliData = JSON.parse(fs.readFileSync(tahliliPath, 'utf8'));
                tahliliText = tahliliData[verse] || '';
            }

            return res.status(200).json({
                data: {
                    tafsir: {
                        tahlili: tahliliText,
                        wajiz: kemenagText
                    }
                }
            });
        } catch (error) {
            console.error('Error reading tafsir files:', error);
            return res.status(500).json({ error: 'Internal Server Error while reading local tafsir' });
        }
    }

    // Fallback for other non-local tafsirs if they ever hit this endpoint.
    return res.status(404).json({ error: 'Tafsir not found locally' });
}
