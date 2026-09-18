/* eslint-disable no-console */
/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const BASE_SYSTEM_PROMPT = `Kamu adalah "Quran Tsirwah AI", asisten cerdas Islami resmi dari Tsirwah Pesantren Digital.
Tugas utama kamu adalah membimbing, menjawab pertanyaan, dan memberikan solusi kehidupan berbasis Al-Quran dan As-Sunnah dengan rujukan utama Tafsir Kementerian Agama RI (Kemenag RI) serta kitab-kitab tafsir mu'tabar Ahlussunnah wal Jama'ah (seperti Tafsir Jalalain dan Tafsir Ibnu Katsir).

Pedoman Menjawab:
1. Karakter & Adab: Bersikap santun, empati, ramah, dan menyejukkan hati (layaknya ustadz/penasihat bijak dari Nahdlatul Ulama / Pesantren Tsirwah).
2. Akurasi Dalil: Wajib mencantumkan referensi surah dan ayat dengan format jelas: (QS. [Nama Surah]: [Nomor Ayat]).
3. Rujukan Tafsir: Jelaskan makna ayat dengan bahasa Indonesia yang mudah dipahami orang awam. Jika ada naskah tafsir Kemenag yang dilampirkan, prioritaskan penjelasan dari naskah tersebut.
4. Kejujuran Ilmiah: Jangan pernah mengarang teks ayat atau terjemahan. Jika tidak tahu, sampaikan dengan tawadhu' (rendah hati).
5. Keamanan: Tolak dengan santun setiap pertanyaan yang provokatif, memicu perpecahan, atau melanggar syariat Islam.
`;

function getLocalTafsirContext(queryText: string): string {
  try {
    const textLower = queryText.toLowerCase().replace(/['"`]/g, '');

    // 1. Coba deteksi pola angka: "surah 2 ayat 255" atau "qs 2:255"
    const qsNumMatch = textLower.match(/(?:surat|surah|qs|q\.s\.?)\s*(\d{1,3})(?:[:\s]+ayat\s*(\d{1,3})|[:\s]+(\d{1,3}))?/i);
    let matchedSurahId: number | null = null;
    let matchedAyah: string | null = null;

    if (qsNumMatch && qsNumMatch[1]) {
      const num = parseInt(qsNumMatch[1], 10);
      if (num >= 1 && num <= 114) {
        matchedSurahId = num;
        matchedAyah = qsNumMatch[2] || qsNumMatch[3] || null;
      }
    }

    // 2. Jika belum ketemu, cari berdasarkan nama surah dari data/chapters/id.json
    if (!matchedSurahId) {
      const chaptersPath = path.join(process.cwd(), 'data', 'chapters', 'id.json');
      if (fs.existsSync(chaptersPath)) {
        const chapters = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));
        const cleanQuery = textLower.replace(/[^a-z0-9]/g, '');
        for (const [idStr, chap] of Object.entries<any>(chapters)) {
          const rawName = (chap.transliteratedName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (rawName && cleanQuery.includes(rawName)) {
            matchedSurahId = parseInt(idStr, 10);
            const ayahMatch = textLower.match(/(?:ayat|ke-?|:)\s*(\d{1,3})/i);
            if (ayahMatch) {
              matchedAyah = ayahMatch[1];
            }
            break;
          }
        }
      }
    }

    if (matchedSurahId) {
      const kemenagPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'kemenag', `${matchedSurahId}.json`);
      if (fs.existsSync(kemenagPath)) {
        const kemenagData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
        if (matchedAyah && kemenagData[matchedAyah]) {
          return `[Tafsir Kemenag RI Surah ${matchedSurahId} Ayat ${matchedAyah}]:\n${kemenagData[matchedAyah]}`;
        }
        // Jika tidak spesifik ayat, sertakan sampel 3 ayat pertama
        const sample = Object.entries(kemenagData).slice(0, 3).map(([a, txt]) => `Ayat ${a}: ${txt}`).join('\n');
        return `[Tafsir Kemenag RI Surah ${matchedSurahId}]:\n${sample}`;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca tafsir lokal:', err);
  }
  return '';
}

async function streamDeepSeek(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  res: any,
) {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: apiMessages,
      stream: true,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API Error (${response.status}): ${errText}`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') break;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        } catch {
          // Abaikan partial json
        }
      }
    }
  }

  res.end();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ message: 'Invalid messages array' });
      return;
    }

    if (!DEEPSEEK_API_KEY) {
      res.status(500).json({
        message: 'DEEPSEEK_API_KEY belum dikonfigurasi di Environment Variable Vercel.',
      });
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const localTafsir = getLocalTafsirContext(lastMessage.content);

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (localTafsir) {
      systemPrompt += `\n\n[Konteks Data Tafsir Kemenag Terkait]:\n${localTafsir}\nSilakan jadikan naskah di atas sebagai rujukan akurat.\n`;
    }

    await streamDeepSeek(systemPrompt, messages, res);
  } catch (error: any) {
    console.error('Chat API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error?.message || 'Terjadi kesalahan pada server DeepSeek AI' });
    } else {
      res.end();
    }
  }
}
