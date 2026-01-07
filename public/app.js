const state = {
  customers: [],
  restaurants: [],
  orders: [],
  analytics: []
};

const selectors = {
  customersGrid: document.getElementById("customers-grid"),
  restaurantsGrid: document.getElementById("restaurants-grid"),
  analyticsList: document.getElementById("analytics-list"),
  ordersList: document.getElementById("orders-list"),
  customerSearch: document.getElementById("customer-search"),
  restaurantSearch: document.getElementById("restaurant-search"),
  cuisineFilter: document.getElementById("cuisine-filter"),
  filterVegan: document.getElementById("filter-vegan"),
  filterSpicy: document.getElementById("filter-spicy"),
  filterOpen: document.getElementById("filter-open")
};

const templates = {
  customer: document.getElementById("customer-card-template"),
  restaurant: document.getElementById("restaurant-card-template"),
  analytics: document.getElementById("analytics-item-template"),
  order: document.getElementById("order-item-template")
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(value || 0);

const formatDate = (iso) => new Date(iso).toLocaleString("ro-RO");

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth" });
  }
}

function renderCustomers() {
  const query = selectors.customerSearch.value.toLowerCase();
  const wantsVegan = selectors.filterVegan.checked;
  const wantsSpicy = selectors.filterSpicy.checked;

  selectors.customersGrid.innerHTML = "";

  state.customers
    .filter((customer) => customer.name.toLowerCase().includes(query))
    .filter((customer) => (!wantsVegan ? true : customer.preferences?.vegan))
    .filter((customer) => (!wantsSpicy ? true : customer.preferences?.spicy))
    .forEach((customer) => {
      const clone = templates.customer.content.cloneNode(true);
      clone.querySelector("[data-name]").textContent = customer.name;
      clone.querySelector("[data-email]").textContent = customer.email;
      clone.querySelector("[data-points]").textContent = `${customer.loyaltyPoints} pts`;

      const tags = clone.querySelector("[data-preferences]");
      const prefs = [];
      if (customer.preferences?.vegan) prefs.push("vegan");
      if (customer.preferences?.spicy) prefs.push("spicy");
      if (!prefs.length) prefs.push("chill");
      prefs.forEach((pref) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = pref;
        tags.appendChild(tag);
      });

      clone.querySelectorAll("[data-action='points']").forEach((button) => {
        button.addEventListener("click", () => updatePoints(customer._id, button.dataset.delta));
      });
      clone.querySelector("[data-action='delete']").addEventListener("click", () => deleteCustomer(customer._id));

      selectors.customersGrid.appendChild(clone);
    });
}

function renderRestaurants() {
  const query = selectors.restaurantSearch.value.toLowerCase();
  const cuisine = selectors.cuisineFilter.value;
  const openOnly = selectors.filterOpen.checked;

  selectors.restaurantsGrid.innerHTML = "";

  state.restaurants
    .filter((restaurant) => restaurant.name.toLowerCase().includes(query))
    .filter((restaurant) => (!cuisine ? true : restaurant.cuisine === cuisine))
    .filter((restaurant) => (!openOnly ? true : restaurant.isOpenLate))
    .forEach((restaurant) => {
      const clone = templates.restaurant.content.cloneNode(true);
      clone.querySelector("[data-name]").textContent = restaurant.name;
      clone.querySelector("[data-cuisine]").textContent = restaurant.cuisine;
      clone.querySelector("[data-rating]").textContent = `⭐ ${restaurant.rating || "N/A"}`;

      const tags = clone.querySelector("[data-meta]");
      const info = [];
      if (restaurant.isOpenLate) info.push("open late");
      info.push("Mongo vibe");
      info.forEach((item) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = item;
        tags.appendChild(tag);
      });

      selectors.restaurantsGrid.appendChild(clone);
    });
}

function renderAnalytics() {
  selectors.analyticsList.innerHTML = "";
  state.analytics.forEach((entry, index) => {
    const clone = templates.analytics.content.cloneNode(true);
    clone.querySelector("[data-name]").textContent = `${index + 1}. ${entry.restaurantName}`;
    clone.querySelector("[data-meta]").textContent = `${entry.cuisine} · ${entry.ordersCount} comenzi`;
    clone.querySelector("[data-revenue]").textContent = formatCurrency(entry.revenue);
    clone.querySelector("[data-orders]").textContent = `${entry.ordersCount}x`;
    selectors.analyticsList.appendChild(clone);
  });
}

function renderOrders() {
  selectors.ordersList.innerHTML = "";
  state.orders.forEach((order) => {
    const clone = templates.order.content.cloneNode(true);
    clone.querySelector("[data-title]").textContent = `${order.customerName} → ${order.restaurantName}`;
    clone.querySelector("[data-meta]").textContent = `${formatDate(order.createdAt)} · ${order.items.length} items`;
    clone.querySelector("[data-total]").textContent = formatCurrency(order.total);

    const statusSelect = clone.querySelector("[data-status]");
    statusSelect.value = order.status;
    statusSelect.addEventListener("change", () => updateOrderStatus(order._id, statusSelect.value));

    selectors.ordersList.appendChild(clone);
  });
}

async function loadCustomers() {
  state.customers = await fetchJSON("/customers");
  renderCustomers();
}

async function loadRestaurants() {
  state.restaurants = await fetchJSON("/restaurants");
  const cuisines = [...new Set(state.restaurants.map((r) => r.cuisine))].filter(Boolean);
  selectors.cuisineFilter.innerHTML = '<option value="">Toate bucătăriile</option>';
  cuisines.forEach((cuisine) => {
    const option = document.createElement("option");
    option.value = cuisine;
    option.textContent = cuisine;
    selectors.cuisineFilter.appendChild(option);
  });
  renderRestaurants();
}

async function loadAnalytics() {
  state.analytics = await fetchJSON("/analytics/top-restaurants");
  renderAnalytics();
}

async function loadOrders() {
  state.orders = await fetchJSON("/orders");
  renderOrders();
}

async function updatePoints(id, delta) {
  await fetchJSON(`/customers/${id}/points`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta: Number(delta) })
  });
  await loadCustomers();
}

async function deleteCustomer(id) {
  await fetchJSON(`/customers/${id}`, { method: "DELETE" });
  await loadCustomers();
}

async function updateOrderStatus(id, status) {
  await fetchJSON(`/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  await loadOrders();
  await loadAnalytics();
}

function bindEvents() {
  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => scrollToSection(button.dataset.scroll));
  });

  selectors.customerSearch.addEventListener("input", renderCustomers);
  selectors.filterVegan.addEventListener("change", renderCustomers);
  selectors.filterSpicy.addEventListener("change", renderCustomers);

  selectors.restaurantSearch.addEventListener("input", renderRestaurants);
  selectors.cuisineFilter.addEventListener("change", renderRestaurants);
  selectors.filterOpen.addEventListener("change", renderRestaurants);

  document.getElementById("refresh-analytics").addEventListener("click", loadAnalytics);
  document.getElementById("refresh-orders").addEventListener("click", loadOrders);
}

async function init() {
  bindEvents();
  await Promise.all([loadCustomers(), loadRestaurants(), loadAnalytics(), loadOrders()]);
}

init().catch((error) => {
  console.error(error);
});
