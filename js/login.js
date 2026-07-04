const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const errorBox = document.getElementById('error');

async function login() {
  errorBox.textContent = '';
  loginButton.disabled = true;
  loginButton.textContent = 'Connexion...';

  try {
    const result = await api('loginGarage', {
      password: passwordInput.value
    });

    if (!result || !result.token) {
      throw new Error('Token non reçu depuis l’API');
    }

    localStorage.setItem('garage_token', result.token);
    window.location.href = 'garage.html';

  } catch (error) {
    errorBox.textContent = 'Erreur : ' + error.message;
    loginButton.disabled = false;
    loginButton.textContent = 'Connexion';
  }
}

loginButton.addEventListener('click', login);

passwordInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') login();
});