/* eslint-disable no-console */
/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  maxDuration: 60,
};

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const BASE_SYSTEM_PROMPT = `Kamu adalah "Quran Tsirwah AI", asisten cerdas tafsir Al-Qur'an dan khazanah Islam resmi dari Tsirwah Pesantren Digital.
Tugas utama kamu adalah membimbing, menjawab pertanyaan, dan menguraikan khazanah/kisah/hukum Al-Qur'an secara MENDALAM, AKURAT, dan BERBOBOT setara kajian ulama pesantren Ahlussunnah wal Jama'ah (Nahdlatul Ulama).

Rujukan Utama:
- Tafsir Kementerian Agama RI (Tafsir Ringkas & Tafsir Tahlili)
- Kitab Tafsir Mu'tabar: Tafsir Ibnu Katsir, Tafsir Jalalain, Tafsir At-Thabari, dan Tafsir Al-Qurthubi.

PEDOMAN KUALITAS & KETELITIAN (WAJIB DIIKUTI SECARA KETAT):

1. Ketepatan Surat & Nomor Ayat (KRUSIAL):
   - JANGAN PERNAH salah mengidentifikasi atau menukar nama surat dan nomor ayat.
   - Contoh: Ayat "قَالَ يَا قَوْمِ أَرَأَيْتُمْ إِن كُنتُ عَلَىٰ بَيِّنَةٍ مِّن رَّبِّي..." adalah SURAH HUD AYAT 88, BUKAN Al-A'raf.
   - Pastikan teks Arab, nomor ayat, dan nama surat 100% cocok.

2. Kelengkapan Khazanah Sejarah (Contoh: Negeri Madyan):
   - Jika ditanya tentang suatu tempat/kaum, sampaikan seluruh dimensi sejarah Al-Qur'an terkait secara utuh:
     * Negeri Madyan mencakup 2 peristiwa besar:
       1) Kisah dakwah Nabi Syu'aib AS & azab atas kaum Madyan yang syirik serta curang dalam takaran/timbangan (QS. Hud: 84–95, QS. Al-A'raf: 85–93).
       2) Kisah hijrah Nabi Musa AS ke mata air Madyan setelah melarikan diri dari Fir'aun, menolong 2 putri shalihah, hingga menikah dan menetap di Madyan (QS. Al-Qashash: 22–28).

3. Format Jawaban Baku (Padat, Mendalam, Bernas):
   - Awali dengan salam hangat dan pengantar ringkas 1-2 kalimat (jangan bertele-tele agar jawaban tuntas tanpa terpotong).
   - Sajikan 2 poin utama dengan format:
     **[Nomor]. [Judul Pembahasan]**

     [Teks Ayat Al-Qur'an Arab Berharakat Lengkap - Rasm Uthmani]

     > "[Terjemahan resmi ayat dalam bahasa Indonesia]"
     👉 [Buka QS. NamaSurat: NomorAyat](/<nomorSurat>/<nomorAyat>)

     [Uraian Tafsir & Tadabbur: Rujukan Ibnu Katsir/Kemenag, asbabun nuzul/latar kisah, dan hikmahnya secara padat dan berbobot]

4. Kesimpulan & Ibrah:
   - Rangkuman pesan moral dan spiritual yang aplikatif bagi kehidupan.

5. Rekomendasi Lanjutan (Wajib di Baris Paling Akhir):
   - Tuliskan tepat 2 pertanyaan lanjutan untuk memicu tadabbur:
     Rekomendasi Lanjutan:
     - [Pertanyaan lanjutan 1]
     - [Pertanyaan lanjutan 2]

6. Adab & Karakter:
   - Santun, berwibawa, menyejukkan hati, dan menjaga citra ilmiah Tsirwah Digital (tanpa menyebut vendor pihak ketiga).
`;

// Kamus Tematik Sejarah & Kisah Al-Qur'an untuk Konteks Otomatis
const THEMATIC_TOPICS: Array<{
  keywords: string[];
  surah: number;
  ayah: number;
  note: string;
}> = [
  {
    keywords: ['madyan', 'syuaib', 'syu\'aib', 'aikah'],
    surah: 11,
    ayah: 84,
    note: "Kisah Nabi Syu'aib & Penduduk Madyan (QS. Hud: 84-95). Catatan penting: Madyan juga merupakan tempat hijrah Nabi Musa AS saat bertemu 2 putri di mata air Madyan (QS. Al-Qashash: 22-28).",
  },
  {
    keywords: ['kahfi', 'ashabul kahfi', 'gua'],
    surah: 18,
    ayah: 10,
    note: "Kisah Pemuda Ashabul Kahfi (QS. Al-Kahf: 9-26).",
  },
  {
    keywords: ['dzulkarnain', 'zulkarnain', 'yajuj', "ya'juj"],
    surah: 18,
    ayah: 83,
    note: "Kisah Zulkarnain dan Ya'juj Ma'juj (QS. Al-Kahf: 83-98).",
  },
  {
    keywords: ['luqman', 'wasiat luqman'],
    surah: 31,
    ayah: 13,
    note: "Wasiat Luqman Al-Hakim kepada anaknya (QS. Luqman: 12-19).",
  },
  {
    keywords: ['maryam', 'isa lahir'],
    surah: 19,
    ayah: 16,
    note: "Kisah Maryam dan Kelahiran Nabi Isa AS (QS. Maryam: 16-34).",
  },
  {
    keywords: ['yusuf', 'sumur', 'zulaikha'],
    surah: 12,
    ayah: 19,
    note: "Kisah Nabi Yusuf AS (QS. Yusuf).",
  },
  {
    keywords: ['firaun', 'laut merah', 'tongkat musa'],
    surah: 20,
    ayah: 24,
    note: "Dakwah Nabi Musa AS kepada Fir'aun (QS. Thaha: 24-79 & QS. Asy-Syu'ara: 10-68).",
  },
];

function getLocalTafsirContext(queryText: string): string {
  try {
    const textLower = queryText.toLowerCase().replace(/['"`]/g, '');

    // 1. Coba deteksi pola angka: "surah 2 ayat 255" atau "qs 2:255"
    const qsNumMatch = textLower.match(/(?:surat|surah|qs|q\.s\.?)\s*(\d{1,3})(?:[:\s]+ayat\s*(\d{1,3})|[:\s]+(\d{1,3}))?/i);
    let matchedSurahId: number | null = null;
    let matchedAyah: string | null = null;
    let thematicNote = '';

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

    // 3. Pencarian Tematik Sejarah / Kisah Tokoh
    if (!matchedSurahId) {
      for (const topic of THEMATIC_TOPICS) {
        if (topic.keywords.some((kw) => textLower.includes(kw))) {
          matchedSurahId = topic.surah;
          matchedAyah = String(topic.ayah);
          thematicNote = topic.note;
          break;
        }
      }
    }

    if (matchedSurahId) {
      const tahliliPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'tahlili', `${matchedSurahId}.json`);
      const kemenagPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'kemenag', `${matchedSurahId}.json`);

      let tafsirData: any = null;
      if (fs.existsSync(tahliliPath)) {
        tafsirData = JSON.parse(fs.readFileSync(tahliliPath, 'utf8'));
      } else if (fs.existsSync(kemenagPath)) {
        tafsirData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
      }

      if (tafsirData) {
        let result = '';
        if (thematicNote) {
          result += `[Catatan Tematik Khazanah Al-Qur'an]: ${thematicNote}\n\n`;
        }
        if (matchedAyah && tafsirData[matchedAyah]) {
          result += `[Tafsir Kemenag RI Surah ${matchedSurahId} Ayat ${matchedAyah}]:\n${tafsirData[matchedAyah]}`;
          return result;
        }
        const sample = Object.entries(tafsirData).slice(0, 3).map(([a, txt]) => `Ayat ${a}: ${txt}`).join('\n');
        result += `[Tafsir Kemenag RI Surah ${matchedSurahId}]:\n${sample}`;
        return result;
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
      temperature: 0.3,
      max_tokens: 2500,
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
      systemPrompt += `\n\n[Konteks Naskah Tafsir Kemenag & Khazanah Tematik]:\n${localTafsir}\nSilakan jadikan rujukan resmi di atas sebagai pedoman akurat nama surah, ayat, dan tafsirnya.\n`;
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
