const themeToggle = document.getElementById('themeToggle');

function applySavedTheme() {
  const savedTheme = localStorage.getItem('garage-theme');
  document.body.classList.toggle('light', savedTheme === 'light');

  if (themeToggle) {
    themeToggle.textContent = savedTheme === 'light' ? '☾' : '☀';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('garage-theme', isLight ? 'light' : 'dark');

  if (themeToggle) {
    themeToggle.textContent = isLight ? '☾' : '☀';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

applySavedTheme();