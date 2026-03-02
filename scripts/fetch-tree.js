const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/renomureza/quran-api-id/git/trees/master?recursive=1',
  headers: { 'User-Agent': 'node.js' },
};

https
  .get(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      const json = JSON.parse(data);
      if (json.tree) {
        const files = json.tree.filter((t) => t.path.includes('tafsir'));
        console.log(
          'Tafsir files found:',
          files.slice(0, 10).map((f) => f.path),
        );
      } else {
        console.log(json);
      }
    });
  })
  .on('error', console.error);
