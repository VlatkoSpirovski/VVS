const form = document.getElementById("loginForm");
const errorNode = document.getElementById("loginError");
const button = document.getElementById("loginButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorNode.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!email || !password) {
    errorNode.textContent = "Внесете email и лозинка.";
    return;
  }

  button.disabled = true;
  button.textContent = "Се најавува…";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      window.location.href = "/admin/";
      return;
    }

    if (response.status === 429) errorNode.textContent = "Премногу обиди. Обидете се повторно за 15 минути.";
    else if (response.status === 401) errorNode.textContent = "Погрешен email или лозинка.";
    else errorNode.textContent = "Најавата моментално не работи. Обидете се подоцна.";
  } catch {
    errorNode.textContent = "Нема врска со серверот. Проверете ја интернет врската.";
  }
  button.disabled = false;
  button.textContent = "Најави се";
});
