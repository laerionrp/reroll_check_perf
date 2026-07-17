const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const errorBox = document.getElementById('error');

const loginMessage = sessionStorage.getItem('garage_login_message');

if (loginMessage) {
  errorBox.textContent = loginMessage;
  sessionStorage.removeItem('garage_login_message');
}

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

    localStorage.removeItem('rcp_garage_data');
    localStorage.removeItem('rcp_garage_data_time');
    localStorage.removeItem('rcp_garage_data_token');
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
