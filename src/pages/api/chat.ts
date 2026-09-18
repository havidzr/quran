/* eslint-disable no-console */
/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const BASE_SYSTEM_PROMPT = `Kamu adalah "Quran Tsirwah AI", asisten cerdas tafsir Al-Qur'an dan khazanah Islam resmi dari Tsirwah Pesantren Digital.
Tugas utama kamu adalah membimbing, menjawab pertanyaan, dan menguraikan kisah/hukum/hikmah Al-Qur'an secara MENDALAM, AKURAT, dan BERBOBOT setara kajian ulama pesantren Ahlussunnah wal Jama'ah (Nahdlatul Ulama).

Rujukan Utama Kamu:
- Tafsir Kementerian Agama RI (Tafsir Ringkas & Tafsir Tahlili)
- Kitab Tafsir Mu'tabar: Tafsir Ibnu Katsir, Tafsir Jalalain, Tafsir At-Thabari, dan Tafsir Al-Qurthubi.

PEDOMAN KUALITAS KONTEN & FORMAT (WAJIB DIIKUTI SECARA KETAT):

1. Bobot Penjelasan (Jangan Dangkal / Jangan Basa-Basi Umum):
   - Jika ditanya kisah/sejarah: Uraikan konteks asbabun nuzul, latar geografis/sosial, intrik dakwah para nabi, bentuk penyimpangan kaum terdahulu, dan detail bentuk azab/pertolongan Allah.
   - Jika ditanya hukum/akhlak: Jelaskan makna lafaz (analisis bahasa/balaghah), pendapat mufassirin muktabar, dan korelasinya dengan kehidupan nyata modern.
   - Hindari jawaban yang terlalu singkat atau terasa normatif. Berikan wawasan yang menambah ilmu dan menggetarkan hati (tadabbur).

2. Teks Asli Ayat Al-Qur'an (WAJIB):
   - Setiap kali mengutip ayat, WAJIB menuliskan teks ayat asli dalam BAHASA ARAB BERHARAKAT LENGKAP (Rasm Uthmani) yang indah dan benar.

3. Tautan Link ke Mushaf Tsirwah (WAJIB):
   - Tepat di bawah terjemahan, cantumkan tautan ke mushaf dengan format:
     👉 [Buka QS. NamaSurat: NomorAyat](/<nomorSurat>/<nomorAyat>)
     Contoh: 👉 [Buka QS. Hud: 85](/11/85) atau 👉 [Buka QS. Asy-Syu'ara: 189](/26/189).

4. Struktur Baku Setiap Poin Pembahasan:
   Awali jawaban dengan salam dan pengantar hikmah yang hangat, lalu sajikan 2–3 poin utama dengan struktur rapi:

   **[Nomor]. [Judul Pembahasan yang Kuat]**

   [Teks Ayat Al-Qur'an Arab Berharakat Lengkap]

   > "[Terjemahan resmi ayat dalam bahasa Indonesia]"
   👉 [Buka QS. NamaSurat: NomorAyat](/<nomorSurat>/<nomorAyat>)

   [Uraian Tafsir & Tadabbur Mendalam: Jelaskan konteks ayat, apa kata Ibnu Katsir/Kemenag, detail kisah, dan pelajaran pentingnya]

5. Kesimpulan (Ibrah):
   - Berikan rangkuman inti pesan moral dan spiritual yang aplikatif bagi pembaca.

6. Rekomendasi Lanjutan (Wajib di Baris Paling Akhir):
   - Tuliskan tepat 2 pertanyaan lanjutan yang menarik dan memancing tadabbur lebih dalam:
     Rekomendasi Lanjutan:
     - [Pertanyaan mendalam 1]
     - [Pertanyaan mendalam 2]

7. Adab & Karakter:
   - Nada bicara: Menyejukkan hati, santun, ilmiah, berwibawa, dan menentramkan.
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
      // Prioritaskan Tafsir Tahlili jika ada untuk konten mendalam, fallback ke Kemenag Ringkas
      const tahliliPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'tahlili', `${matchedSurahId}.json`);
      const kemenagPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'kemenag', `${matchedSurahId}.json`);

      let tafsirData: any = null;
      if (fs.existsSync(tahliliPath)) {
        tafsirData = JSON.parse(fs.readFileSync(tahliliPath, 'utf8'));
      } else if (fs.existsSync(kemenagPath)) {
        tafsirData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
      }

      if (tafsirData) {
        if (matchedAyah && tafsirData[matchedAyah]) {
          return `[Tafsir Kemenag RI Surah ${matchedSurahId} Ayat ${matchedAyah}]:\n${tafsirData[matchedAyah]}`;
        }
        const sample = Object.entries(tafsirData).slice(0, 3).map(([a, txt]) => `Ayat ${a}: ${txt}`).join('\n');
        return `[Tafsir Kemenag RI Surah ${matchedSurahId}]:\n${sample}`;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca tafsir lokal:', err);
  }
  return '';
}

// Handler streaming DeepSeek (Mesin Utama - Cepat, Tuntas, Tanpa Sensor Palsu)
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
      temperature: 0.3, // Lebih presisi, akademis, dan terarah
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

// Handler streaming Gemini (Cadangan)
async function streamGemini(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  res: any,
) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  const chatHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1]?.content || '';
  const chat = model.startChat({ history: chatHistory });
  const geminiStream = await chat.sendMessageStream(lastMessage);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  for await (const chunk of geminiStream.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      res.write(chunkText);
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

    const lastMessage = messages[messages.length - 1];
    const localTafsir = getLocalTafsirContext(lastMessage.content);

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (localTafsir) {
      systemPrompt += `\n\n[Konteks Naskah Tafsir Kemenag Terkait]:\n${localTafsir}\nSilakan jadikan naskah resmi di atas sebagai rujukan mendalam.\n`;
    }

    // Prioritas Utama: DeepSeek (Cepat, Tuntas, Rapi, Format Disiplin)
    if (DEEPSEEK_API_KEY) {
      await streamDeepSeek(systemPrompt, messages, res);
      return;
    }

    // Cadangan: Google Gemini
    if (GEMINI_API_KEY) {
      await streamGemini(systemPrompt, messages, res);
      return;
    }

    res.status(500).json({
      message: 'DEEPSEEK_API_KEY atau GEMINI_API_KEY belum dikonfigurasi di Environment Variable Vercel.',
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error?.message || 'Terjadi kesalahan pada server AI' });
    } else {
      res.end();
    }
  }
}
