// Helper function to convert snake_case to camelCase
const toCamel = (str) =>
  str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', ''));

// Recursively camelize object keys
const camelizeKeys = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((v) => camelizeKeys(v));
  }
  if (obj !== null && obj.constructor === Object) {
    // eslint-disable-next-line unicorn/no-array-reduce
    return Object.keys(obj).reduce((result, key) => {
      // eslint-disable-next-line no-param-reassign
      result[toCamel(key)] = camelizeKeys(obj[key]);
      return result;
    }, {});
  }
  return obj;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url: targetUrl } = req.body || {};
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ message: 'Missing target url parameter' });
  }

  // Validasi Keamanan SSRF: Hanya izinkan domain Quran API resmi
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return res.status(400).json({ message: 'Invalid URL protocol' });
    }

    const allowedHosts = [
      'api.quran.com',
      'api.qurancdn.com',
      'api.quran.foundation',
      'quran.com',
    ];

    if (process.env.NEXT_PUBLIC_SEARCH_BASE_URL) {
      try {
        const envHost = new URL(process.env.NEXT_PUBLIC_SEARCH_BASE_URL).hostname;
        if (envHost && !allowedHosts.includes(envHost)) {
          allowedHosts.push(envHost);
        }
      } catch (_) {}
    }

    // Tolak request berbahaya ke domain asing / internal server
    if (!allowedHosts.includes(parsed.hostname)) {
      return res.status(403).json({ message: 'Target domain is not allowed' });
    }

    const response = await fetch(parsed.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_SEARCH_API_KEY || '',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ message: data.message || 'Search request failed' });
    }

    // Camelize keys in the response data
    const camelizedData = camelizeKeys(data);

    // Send the camelized data back to the client
    return res.status(200).json(camelizedData);
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Error processing search proxy' });
  }
}
