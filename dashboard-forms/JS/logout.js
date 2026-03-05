document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // FIXED (LOGIC-02): Only 'token' and 'role' were cleared but login stores
      // 'userRole', 'userName', and 'userBranch' — leaving stale data after logout.
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('userBranch');
      window.location.href = '/index.html';
    });
  }
});
