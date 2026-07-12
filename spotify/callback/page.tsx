(async () => {
    const code = new URLSearchParams(location.search).get('code');
    if (!code) return;
    const res = await fetch('/api/v2/favorites/import/spotify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    console.log(await res.json());     // { jobId: "..." } if 202 Accepted
  })();
  