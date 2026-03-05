const API_BASE = window.API_URL || "https://kgl-project-3g6j.onrender.com";

function getToken()  { return localStorage.getItem('token'); }

function decodeToken(token) {
  try   { return JSON.parse(atob(token.split('.')[1])); }
  catch { return null; }
}

// ADDED: XSS guard â€” used instead of raw innerHTML with server data
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();

  if (!token) {
    alert('Please log in first');
    window.location.href = '/loginform/html/login.html';
    return;
  }

  const decodedToken = decodeToken(token);
  if (!decodedToken || !decodedToken.id) {
    alert('Invalid token. Please log in again.');
    window.location.href = '/loginform/html/login.html';
    return;
  }

  currentUserId = decodedToken.id;

  try {
    const response = await fetch(`${API_BASE}/users/${currentUserId}`, {
      method:  'GET',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token
      }
    });

    if (!response.ok) throw new Error('Failed to fetch user details');

    const user = await response.json();
    displayUserProfile(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    displayUserProfile({
      name:           decodedToken.name  || 'Unknown User',
      email:          'Not available',
      role:           decodedToken.role  || 'User',
      phone:          'Not available',
      branch:         decodedToken.branch || 'Not available',
      bio:            '',
      profilePicture: ''
    });
  }

  setupProfilePictureUpload();
  setupBioEdit();
});

function displayUserProfile(user) {
  const nameEl = document.querySelector('h3');
  if (nameEl) nameEl.textContent = user.name || 'Unknown User';

  const roleEl = document.querySelector('.role');
  if (roleEl) {
    roleEl.textContent = user.role === 'Sales-agent' ? 'Sales Agent' : (user.role || 'User');
  }

  // FIXED (SECURITY-07 / XSS): Was using innerHTML with raw server data:
  //   profileInfo.innerHTML = `<p><strong>Branch:</strong> ${user.branch}</p>...`
  // If branch/email/phone contained <script> or <img onerror=...> it would execute.
  // Now builds DOM nodes with textContent â€” no HTML parsing of user data.
  const profileInfo = document.querySelector('.profile--info');
  if (profileInfo) {
    profileInfo.innerHTML = '';

    const fields = [
      { label: 'Branch', value: user.branch || 'Not specified' },
      { label: 'Email',  value: user.email  || 'Not available' },
      { label: 'Phone',  value: user.phone  || 'Not available' }
    ];

    fields.forEach(({ label, value }) => {
      const p      = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = label + ':';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(' ' + value));
      profileInfo.appendChild(p);
    });
  }

  const bioParagraph = document.querySelector('.profile--bio p');
  if (bioParagraph) {
    bioParagraph.textContent = user.bio || 'No bio yet. Click Edit to add one.';
  }

  const profileImg = document.querySelector('.profile--avatar-wrapper img');
  if (profileImg && user.profilePicture) {
    profileImg.src = user.profilePicture;
  }
}

function setupProfilePictureUpload() {
  const avatarWrapper = document.querySelector('.profile--avatar-wrapper');
  const fileInput     = document.getElementById('profile-pic-input');
  if (!avatarWrapper || !fileInput) return;

  avatarWrapper.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB.');
      return;
    }

    const reader   = new FileReader();
    reader.onload  = async (e) => {
      const base64   = e.target.result;
      const profileImg = document.querySelector('.profile--avatar-wrapper img');
      if (profileImg) profileImg.src = base64;

      try {
        const token = getToken();
        const res   = await fetch(`${API_BASE}/users/${currentUserId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body:    JSON.stringify({ profilePicture: base64 })
        });
        if (!res.ok) throw new Error('Failed to save profile picture');
        showSaveMessage('Profile picture updated!');
      } catch (err) {
        console.error(err);
        alert('Could not save profile picture. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  });
}

function setupBioEdit() {
  const editBtn      = document.getElementById('bio-edit-btn');
  const bioParagraph = document.querySelector('.profile--bio p');
  const bioControls  = document.getElementById('bio-edit-controls');
  const bioTextarea  = document.getElementById('bio-textarea');
  const saveBioBtn   = document.getElementById('bio-save-btn');
  const cancelBioBtn = document.getElementById('bio-cancel-btn');

  if (!editBtn || !bioParagraph || !bioControls || !bioTextarea) return;

  editBtn.addEventListener('click', () => {
    bioTextarea.value = bioParagraph.textContent === 'No bio yet. Click Edit to add one.'
      ? ''
      : bioParagraph.textContent;
    bioParagraph.classList.add('bio--edit-controls--hidden');
    editBtn.classList.add('bio--edit-controls--hidden');
    bioControls.classList.remove('bio--edit-controls--hidden');
    bioTextarea.focus();
  });

  cancelBioBtn.addEventListener('click', () => {
    bioParagraph.classList.remove('bio--edit-controls--hidden');
    editBtn.classList.remove('bio--edit-controls--hidden');
    bioControls.classList.add('bio--edit-controls--hidden');
  });

  saveBioBtn.addEventListener('click', async () => {
    const newBio = bioTextarea.value.trim();
    try {
      const token = getToken();
      const res   = await fetch(`${API_BASE}/users/${currentUserId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify({ bio: newBio })
      });
      if (!res.ok) throw new Error('Failed to save bio');
      bioParagraph.textContent   = newBio || 'No bio yet. Click Edit to add one.';
      bioParagraph.style.display = '';
      editBtn.style.display      = '';
      bioControls.style.display  = 'none';
      showSaveMessage('Bio saved!');
    } catch (err) {
      console.error(err);
      alert('Could not save bio. Please try again.');
    }
  });
}

function showSaveMessage(msg) {
  let msgEl = document.querySelector('.profile--save-msg');
  if (!msgEl) {
    msgEl           = document.createElement('p');
    msgEl.className = 'profile--save-msg';
    const card = document.querySelector('.profile--card');
    if (card) card.appendChild(msgEl);
  }
  msgEl.textContent = msg;
  setTimeout(() => { msgEl.textContent = ''; }, 3000);
}

