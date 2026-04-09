async function test() {
  const url = 'https://attendance-site-two.vercel.app/api/auth/login';
  
  console.log(`Testing admin login...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    console.log('admin status:', res.status, await res.text());
  } catch(e) { console.error('admin failed', e); }

  console.log(`\nTesting worker login...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '홍길동', password: '5678' }) // Assuming 홍길동 and 5678 is a valid worker that we saw locally
    });
    console.log('worker status:', res.status, await res.text());
  } catch(e) { console.error('worker failed', e); }

  console.log(`\nTesting Site Manager login...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'TestSite', password: '5678' })
    });
    console.log('TestSite status:', res.status, await res.text());
  } catch(e) { console.error('TestSite failed', e); }
}

test();
