// script.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// Firebase config - replace with your actual config!
const firebaseConfig = {
  apiKey: "AIzaSyCfGmPxnNw0KyiuTQLpejiC5jCAM5aMmq0",
  authDomain: "lenovoleavehub.firebaseapp.com",
  projectId: "lenovoleavehub",
  storageBucket: "lenovoleavehub.firebasestorage.app",
  messagingSenderId: "107240876517",
  appId: "1:107240876517:web:70db03cd18936890fb670c",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === ELEMENTS ===
const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const dashboard = document.getElementById("dashboard-section");
const authSection = document.getElementById("auth-section");
const logoutBtn = document.getElementById("logout");
const dashboardWelcome = document.getElementById("dashboard-welcome");
const learnerDashboard = document.getElementById("learner-dashboard");
const adminDashboard = document.getElementById("admin-dashboard");
const leaveForm = document.getElementById("leave-form");
const leaveHistory = document.getElementById("leave-history");
const adminRequests = document.getElementById("admin-requests");
const downloadBtn = document.getElementById("download-csv");

// Current logged-in user object (includes Firestore data)
let currentUserData = null;

// === SIGNUP ===
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const role = document.getElementById("signup-role").value;

  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update displayName in Auth profile
    await updateProfile(user, { displayName: name });

    // Add user data in Firestore (users collection)
    await addDoc(collection(db, "users"), {
      uid: user.uid,
      name,
      email,
      role,
    });

    alert("Sign-up successful. Please login.");
    signupForm.reset();
  } catch (error) {
    alert("Error signing up: " + error.message);
  }
});

// === LOGIN ===
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch user role and data from Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("User data not found. Contact admin.");
      await signOut(auth);
      return;
    }

    querySnapshot.forEach((doc) => {
      currentUserData = { id: doc.id, ...doc.data() };
    });

    showDashboard(currentUserData);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});

// === AUTH STATE CHANGED ===
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is logged in, fetch Firestore user data
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        currentUserData = { id: doc.id, ...doc.data() };
      });
      showDashboard(currentUserData);
    }
  } else {
    // User logged out
    currentUserData = null;
    dashboard.classList.add("hidden");
    authSection.classList.remove("hidden");
    learnerDashboard.classList.add("hidden");
    adminDashboard.classList.add("hidden");
  }
});

// === LOGOUT ===
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.reload();
});

// === DASHBOARD DISPLAY ===
function showDashboard(user) {
  authSection.classList.add("hidden");
  dashboard.classList.remove("hidden");
  dashboardWelcome.textContent = `Hello, ${user.name}`;

  if (user.role === "learner") {
    learnerDashboard.classList.remove("hidden");
    adminDashboard.classList.add("hidden");
    renderLeaveHistory(user);
    subscribeLeaveRequests(user.email);
  } else {
    learnerDashboard.classList.add("hidden");
    adminDashboard.classList.remove("hidden");
    renderAdminRequests();
    subscribeAllLeaveRequests();
  }
}

// === LEAVE FORM SUBMISSION ===
leaveForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const type = document.getElementById("leave-type").value;
  const days = parseFloat(document.getElementById("leave-days").value);
  const date = document.getElementById("leave-date").value;

  if (!currentUserData) {
    alert("User not logged in.");
    return;
  }

  try {
    await addDoc(collection(db, "leaveRequests"), {
      uid: currentUserData.uid,
      email: currentUserData.email,
      type,
      days,
      date,
      status: "Pending",
      requestedAt: new Date().toISOString(),
    });
    alert("Leave request submitted.");
    leaveForm.reset();
  } catch (error) {
    alert("Error submitting leave request: " + error.message);
  }
});

// === RENDER LEAVE HISTORY (for learner) ===
async function renderLeaveHistory(user) {
  const leaveRef = collection(db, "leaveRequests");
  const q = query(leaveRef, where("email", "==", user.email));
  const querySnapshot = await getDocs(q);

  leaveHistory.innerHTML = `<h4>Your Leave History</h4>`;

  if (querySnapshot.empty) {
    leaveHistory.innerHTML += `<p>No leave requests found.</p>`;
    return;
  }

  querySnapshot.forEach((doc) => {
    const r = doc.data();
    leaveHistory.innerHTML += `<p>${r.date} - ${r.type} - ${r.days} days - <span class="status-${r.status.toLowerCase()}">${r.status}</span></p>`;
  });
}

// === RENDER ADMIN REQUESTS ===
async function renderAdminRequests() {
  const leaveRef = collection(db, "leaveRequests");
  const querySnapshot = await getDocs(leaveRef);

  adminRequests.innerHTML = "";

  if (querySnapshot.empty) {
    adminRequests.innerHTML = "<p>No leave requests found.</p>";
    return;
  }

  querySnapshot.forEach((doc) => {
    const r = doc.data();
    const idx = doc.id;

    adminRequests.innerHTML += `
      <div>
        <strong>${r.email}</strong> - ${r.type} - ${r.days} days - ${r.date} - 
        <span class="status-${r.status.toLowerCase()}">${r.status}</span>
        <button onclick="updateStatus('${doc.id}', 'Approved')">Approve</button>
        <button onclick="updateStatus('${doc.id}', 'Declined')">Decline</button>
      </div>
    `;
  });
}

// === UPDATE STATUS (ADMIN ACTION) ===
window.updateStatus = async function (docId, status) {
  try {
    const leaveDocRef = doc(db, "leaveRequests", docId);
    await updateDoc(leaveDocRef, { status });
    renderAdminRequests();
  } catch (error) {
    alert("Error updating status: " + error.message);
  }
};

// === SUBSCRIBE TO LEAVE REQUESTS (Real-time updates) ===
function subscribeLeaveRequests(userEmail) {
  const leaveRef = collection(db, "leaveRequests");
  const q = query(leaveRef, where("email", "==", userEmail));
  onSnapshot(q, (snapshot) => {
    leaveHistory.innerHTML = `<h4>Your Leave History</h4>`;
    if (snapshot.empty) {
      leaveHistory.innerHTML += "<p>No leave requests found.</p>";
      return;
    }
    snapshot.forEach((doc) => {
      const r = doc.data();
      leaveHistory.innerHTML += `<p>${r.date} - ${r.type} - ${r.days} days - <span class="status-${r.status.toLowerCase()}">${r.status}</span></p>`;
    });
  });
}

function subscribeAllLeaveRequests() {
  const leaveRef = collection(db, "leaveRequests");
  onSnapshot(leaveRef, (snapshot) => {
    adminRequests.innerHTML = "";
    if (snapshot.empty) {
      adminRequests.innerHTML = "<p>No leave requests found.</p>";
      return;
    }
    snapshot.forEach((doc) => {
      const r = doc.data();
      adminRequests.innerHTML += `
        <div>
          <strong>${r.email}</strong> - ${r.type} - ${r.days} days - ${r.date} - 
          <span class="status-${r.status.toLowerCase()}">${r.status}</span>
          <button onclick="updateStatus('${doc.id}', 'Approved')">Approve</button>
          <button onclick="updateStatus('${doc.id}', 'Declined')">Decline</button>
        </div>
      `;
    });
  });
}

// === DOWNLOAD CSV BUTTON ===
downloadBtn.addEventListener("click", async () => {
  const leaveRef = collection(db, "leaveRequests");
  const querySnapshot = await getDocs(leaveRef);
  if (querySnapshot.empty) {
    alert("No data to download.");
    return;
  }

  let csv = "Email,Leave Type,Days,Date,Status,Requested At\n";
  querySnapshot.forEach((doc) => {
    const r = doc.data();
    csv += `"${r.email}","${r.type}","${r.days}","${r.date}","${r.status}","${r.requestedAt}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "leave_requests.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
