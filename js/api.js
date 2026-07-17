async function api(action, payload = {}, token = '') {
  let response;

  try {
    response = await fetch(CONFIG.API_URL, {
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
  } catch (error) {
    throw new Error('Serveur injoignable. Vérifie ta connexion.');
  }

  if (!response.ok) {
    throw new Error('Le serveur a répondu avec une erreur.');
  }

  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch (error) {
    throw new Error('Réponse invalide reçue depuis le serveur.');
  }

  if (!data.ok) {
    throw new Error(data.error || 'Erreur API inconnue');
  }

  return data.result;
}
