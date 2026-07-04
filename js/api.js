async function api(action, payload = {}, token = '') {
  const response = await fetch(CONFIG.API_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      token,
      payload
    })
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Erreur API inconnue');
  }

  return data.result;
}
