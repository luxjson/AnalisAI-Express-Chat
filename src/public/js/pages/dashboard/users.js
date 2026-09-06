function getPageData(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || "null");
  } catch (error) {
    console.error("Falha ao ler dados da página.");
    return null;
  }
}

const isAdmin = Boolean(getPageData("dashboard-usuarios-data"));

function openAddUserModal() {
  if (isAdmin) {
    document.getElementById("userForm").action = "/dashboard/usuarios/add";
    document.getElementById("userModalTitle").innerText = "NOVO USUÁRIO";
    document.getElementById("userId").value = "";
    document.getElementById("userName").value = "";
    document.getElementById("userEmail").value = "";
    document.getElementById("passwordField").style.display = "block";
    document.getElementById("statusField").style.display = "none";
    document.getElementById("userModal").style.display = "flex";
  } else {
    document.getElementById("permissionModal").style.display = "flex";
  }
}

function editUser(id, nome, email, cargo, status) {
  if (isAdmin) {
    document.getElementById("userForm").action = "/dashboard/usuarios/update";
    document.getElementById("userModalTitle").innerText = "EDITAR USUÁRIO";
    document.getElementById("userId").value = id;
    document.getElementById("userName").value = nome;
    document.getElementById("userEmail").value = email.toLowerCase();
    document.getElementById("userCargo").value = cargo;
    document.getElementById("userStatus").value = status;
    document.getElementById("passwordField").style.display = "none";
    document.getElementById("statusField").style.display = "block";
    document.getElementById("userModal").style.display = "flex";
  } else {
    document.getElementById("permissionModal").style.display = "flex";
  }
}

function closeUserModal() {
  document.getElementById("userModal").style.display = "none";
}

function confirmDeleteUser(id, nome) {
  if (isAdmin) {
    if (confirm(`Deseja realmente remover o acesso de ${nome}?`)) {
      fetch(`/dashboard/usuarios/delete/${id}`, {
        method: "POST",
        headers: {
          "X-CSRF-Token":
            document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
      }).then((response) => {
        if (response.ok) window.location.reload();
      });
    }
  } else {
    document.getElementById("permissionModal").style.display = "flex";
  }
}

function closePermissionModal() {
  document.getElementById("permissionModal").style.display = "none";
}

document
  .getElementById("userSearchInput")
  .addEventListener("keyup", function () {
    const filter = this.value.toLowerCase();
    document.querySelectorAll("#userTableBody tr").forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(filter) ? "" : "none";
    });
  });
