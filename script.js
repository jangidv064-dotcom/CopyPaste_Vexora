/* Budgetly — Student Monthly Budget Planner
   Vanilla JS + LocalStorage + Chart.js */

const STORAGE_KEY = "budgetly-data-v1";

const CATEGORIES = {
  Food: { color: "#6ec9ff", initial: "F" },
  Transport: { color: "#4fd8a6", initial: "T" },
  Education: { color: "#ffcf6b", initial: "E" },
  Entertainment: { color: "#ff7a90", initial: "N" },
  Shopping: { color: "#c9a6ff", initial: "S" },
  Other: { color: "#ffffff", initial: "O" },
};

let state = {
  budget: 0,
  dailyLimit: 0,
  expenses: []
};

let chart = null;

/* ---------- persistence ---------- */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const data = JSON.parse(raw);

      if (
        typeof data.budget === "number" &&
        Array.isArray(data.expenses)
      ) {
        state = {
          budget: data.budget || 0,
          dailyLimit: data.dailyLimit || 0,
          expenses: data.expenses
        };
      }
    }
  } catch (e) {
    console.warn("Could not load saved data", e);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- helpers ---------- */

const fmt = (n) =>
  "₹" +
  Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function totalSpent() {
  return state.expenses.reduce((sum, e) => sum + e.amount, 0);
}

function monthExpenses() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();

  return state.expenses.filter((e) => {
    const d = new Date(e.date + "T00:00:00");

    return d.getMonth() === m && d.getFullYear() === y;
  });
}

function todayExpenses() {
  const today = new Date();

  const todayString =
    today.getFullYear() +
    "-" +
    String(today.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(today.getDate()).padStart(2, "0");

  return state.expenses.filter(
    (e) => e.date === todayString
  );
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");

  const today = new Date();

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return "Today";
  }

  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

/* ---------- render ---------- */

function render() {

  const spent = totalSpent();
  const budget = state.budget;
  const dailyLimit = state.dailyLimit;

  const remaining = budget - spent;

  const pct =
    budget > 0
      ? (spent / budget) * 100
      : 0;


  /* ---------- Daily Limit Display ---------- */

  document.getElementById("dailyInput").value =
    dailyLimit > 0 ? dailyLimit : "";

  document.getElementById("dailyBtn").textContent =
    dailyLimit > 0
      ? "Update limit"
      : "Set limit";

  document.getElementById("dailySub").textContent =
    dailyLimit > 0
      ? "Your daily spending limit is " +
        fmt(dailyLimit) +
        "."
      : "Optional — get warned when a day goes over.";


  /* ---------- Budget Display ---------- */

  document.getElementById("budgetInput").value =
    budget > 0 ? budget : "";

  document.getElementById("budgetBtn").textContent =
    budget > 0
      ? "Update"
      : "Set budget";

  document.getElementById("budgetSub").textContent =
    budget > 0
      ? "Your monthly budget is " +
        fmt(budget) +
        "."
      : "Set your monthly budget to start tracking.";


  /* ---------- Stats ---------- */

  document.getElementById("statSpent").textContent =
    fmt(spent);

  const remEl =
    document.getElementById("statRemaining");

  remEl.textContent =
    (remaining < 0 ? "-" : "") +
    fmt(Math.abs(remaining));

  remEl.className =
    "stat-value " +
    (remaining < 0 ? "coral" : "mint");

  document.getElementById("statPercent").textContent =
    Math.round(pct) + "%";


  /* ---------- Progress Bar ---------- */

  const fill =
    document.getElementById("progressFill");

  fill.style.width =
    Math.min(pct, 100) + "%";

  fill.classList.toggle(
    "danger",
    pct >= 80
  );

  document.getElementById("progressPct").textContent =
    Math.round(pct) + "%";


  /* ---------- Monthly Budget Warnings ---------- */

  const warn =
    document.getElementById("bannerWarning");

  const danger =
    document.getElementById("bannerDanger");

  if (budget > 0 && pct > 100) {

    warn.classList.add("hidden");
    danger.classList.remove("hidden");

    document.getElementById("overAmount").textContent =
      fmt(spent - budget);

  } else if (budget > 0 && pct >= 80) {

    danger.classList.add("hidden");
    warn.classList.remove("hidden");

    document.getElementById("warningPct").textContent =
      Math.round(pct) + "%";

  } else {

    warn.classList.add("hidden");
    danger.classList.add("hidden");
  }


  /* ---------- Daily Limit Warning ---------- */

  const dailyBanner =
    document.getElementById("bannerDaily");

  if (dailyBanner && dailyLimit > 0) {

    const todaySpent =
      todayExpenses().reduce(
        (sum, expense) =>
          sum + expense.amount,
        0
      );

    if (todaySpent > dailyLimit) {

      dailyBanner.classList.remove("hidden");

      const dailySpentEl =
        document.getElementById("dailySpent");

      const dailyLimitEchoEl =
        document.getElementById("dailyLimitEcho");

      if (dailySpentEl) {
        dailySpentEl.textContent =
          fmt(todaySpent);
      }

      if (dailyLimitEchoEl) {
        dailyLimitEchoEl.textContent =
          fmt(dailyLimit);
      }

    } else {

      dailyBanner.classList.add("hidden");
    }

  } else if (dailyBanner) {

    dailyBanner.classList.add("hidden");
  }


  renderChart();
  renderHistory();
  renderInsights();
}


/* ---------- Chart ---------- */

function renderChart() {

  const thisMonth = monthExpenses();

  const totals = {};

  thisMonth.forEach((e) => {

    totals[e.category] =
      (totals[e.category] || 0) +
      e.amount;

  });

  const labels =
    Object.keys(totals);

  const empty =
    labels.length === 0;


  document
    .getElementById("chartEmpty")
    .classList.toggle(
      "hidden",
      !empty
    );


  const legend =
    document.getElementById("legend");

  legend.innerHTML = "";


  labels
    .sort(
      (a, b) =>
        totals[b] - totals[a]
    )
    .forEach((cat) => {

      const li =
        document.createElement("li");

      li.innerHTML =
        '<span class="legend-left">' +
        '<span class="legend-dot" style="background:' +
        CATEGORIES[cat].color +
        '"></span>' +
        cat +
        '</span>' +
        '<span class="legend-amt">' +
        fmt(totals[cat]) +
        "</span>";

      legend.appendChild(li);
    });


  const ctx =
    document.getElementById(
      "categoryChart"
    );


  const data = {

    labels: labels,

    datasets: [
      {
        data: labels.map(
          (c) => totals[c]
        ),

        backgroundColor:
          labels.map(
            (c) =>
              CATEGORIES[c].color
          ),

        borderWidth: 0,

        hoverOffset: 6,
      },
    ],
  };


  if (chart) {

    chart.data =
      empty
        ? {
            labels: [],
            datasets: [
              {
                data: [],
                backgroundColor: []
              }
            ]
          }
        : data;

    chart.update();

    return;
  }


  chart = new Chart(ctx, {

    type: "doughnut",

    data:
      empty
        ? {
            labels: [],
            datasets: [
              {
                data: [],
                backgroundColor: []
              }
            ]
          }
        : data,

    options: {

      cutout: "68%",

      responsive: true,

      maintainAspectRatio: true,

      plugins: {

        legend: {
          display: false
        },

        tooltip: {

          callbacks: {

            label: (item) =>
              " " +
              item.label +
              ": " +
              fmt(item.parsed),

          },

        },

      },

    },

  });

}


/* ---------- Expense History ---------- */

function renderHistory() {

  const list =
    document.getElementById("historyList");

  const empty =
    document.getElementById("historyEmpty");

  list.innerHTML = "";


  const sorted =
    [...state.expenses].sort(
      (a, b) =>
        a.date < b.date
          ? 1
          : a.date > b.date
          ? -1
          : b.id - a.id
    );


  document.getElementById(
    "historyCount"
  ).textContent =
    sorted.length +
    (sorted.length === 1
      ? " entry"
      : " entries");


  empty.classList.toggle(
    "hidden",
    sorted.length > 0
  );


  sorted.forEach((e) => {

    const cat =
      CATEGORIES[e.category] ||
      CATEGORIES.Other;


    const li =
      document.createElement("li");


    li.innerHTML =
      '<span class="cat-badge" style="background:' +
      cat.color +
      '26;color:' +
      cat.color +
      '">' +
      cat.initial +
      '</span>' +

      '<div class="item-main">' +

      '<p class="item-desc"></p>' +

      '<p class="item-meta">' +
      e.category +
      " · " +
      formatDate(e.date) +
      "</p>" +

      "</div>" +

      '<div class="item-right">' +

      '<p class="item-amt">' +
      fmt(e.amount) +
      "</p>" +

      '<button class="delete-btn" type="button">' +
      "Delete" +
      "</button>" +

      "</div>";


    li.querySelector(
      ".item-desc"
    ).textContent =
      e.description;


    li.querySelector(
      ".delete-btn"
    ).addEventListener(
      "click",
      () => {

        state.expenses =
          state.expenses.filter(
            (x) => x.id !== e.id
          );

        save();

        render();

      }
    );


    list.appendChild(li);

  });

}


/* ---------- Insights ---------- */

function renderInsights() {

  const ul =
    document.getElementById(
      "insightsList"
    );

  ul.innerHTML = "";


  const insights = [];


  const spent =
    totalSpent();

  const budget =
    state.budget;

  const thisMonth =
    monthExpenses();


  if (
    thisMonth.length === 0 &&
    budget === 0
  ) {

    insights.push({
      tag: "Getting started",
      cls: "accent",
      text:
        "Set a monthly budget, then add your first expense to unlock insights."
    });

  }


  if (thisMonth.length > 0) {

    const totals = {};

    thisMonth.forEach((e) => {

      totals[e.category] =
        (totals[e.category] || 0) +
        e.amount;

    });


    const top =
      Object.entries(totals)
        .sort(
          (a, b) =>
            b[1] - a[1]
        )[0];


    const topPct =
      Math.round(
        (top[1] /
          thisMonth.reduce(
            (s, e) =>
              s + e.amount,
            0
          )) *
          100
      );


    insights.push({

      tag: "Top spend",

      cls: "accent",

      text:
        top[0] +
        " is " +
        topPct +
        "% of your spend this month — your largest category."

    });

  }


  if (budget > 0) {

    const pct =
      (spent / budget) * 100;

    const now =
      new Date();

    const daysInMonth =
      new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).getDate();

    const day =
      now.getDate();

    const daysLeft =
      daysInMonth -
      day +
      1;

    const remaining =
      budget -
      spent;


    if (pct > 100) {

      insights.push({

        tag: "Over budget",

        cls: "coral",

        text:
          "You're " +
          fmt(spent - budget) +
          " over. Pause non-essential spending until next month."

      });

    } else if (pct >= 80) {

      const perDay =
        remaining /
        daysLeft;


      insights.push({

        tag: "Pace check",

        cls: "amber",

        text:
          "You have " +
          fmt(remaining) +
          " left for " +
          daysLeft +
          " day" +
          (daysLeft === 1 ? "" : "s") +
          " — keep spending under " +
          fmt(Math.max(perDay, 0)) +
          "/day to stay safe."

      });

    } else if (spent > 0) {

      const projected =
        (spent / day) *
        daysInMonth;


      if (projected > budget) {

        insights.push({

          tag: "Pace check",

          cls: "amber",

          text:
            "On pace to spend ~" +
            fmt(projected) +
            " this month — " +
            fmt(projected - budget) +
            " over budget if you keep going."

        });

      } else {

        insights.push({

          tag: "On track",

          cls: "mint",

          text:
            "Projected to spend ~" +
            fmt(projected) +
            " this month — comfortably under your " +
            fmt(budget) +
            " budget."

        });

      }

    }


    if (spent === 0) {

      insights.push({

        tag: "Tip",

        cls: "mint",

        text:
          "Log every coffee and snack — small purchases are where budgets quietly leak."

      });

    } else {

      const totals = {};

      thisMonth.forEach((e) => {

        totals[e.category] =
          (totals[e.category] || 0) +
          e.amount;

      });


      const top =
        Object.entries(totals)
          .sort(
            (a, b) =>
              b[1] - a[1]
          )[0];


      const saving =
        top[1] * 0.1;


      insights.push({

        tag: "Tip",

        cls: "mint",

        text:
          "Cutting " +
          top[0] +
          " spending by just 10% would save you " +
          fmt(saving) +
          " this month."

      });

    }

  }


  insights.forEach((i) => {

    const li =
      document.createElement("li");


    li.innerHTML =
      '<p class="insight-tag ' +
      i.cls +
      '">' +
      i.tag +
      "</p><p></p>";


    li.querySelector(
      "p:last-child"
    ).textContent =
      i.text;


    ul.appendChild(li);

  });

}


/* ---------- Events ---------- */


/* Monthly Budget */

document
  .getElementById("budgetForm")
  .addEventListener(
    "submit",
    (e) => {

      e.preventDefault();

      const input =
        document.getElementById(
          "budgetInput"
        );

      const value =
        parseFloat(input.value);


      if (!value || value <= 0) {
        return;
      }


      state.budget =
        value;


      save();

      render();

    }
  );


/* Daily Limit */

document
  .getElementById("dailyForm")
  .addEventListener(
    "submit",
    (e) => {

      e.preventDefault();

      const input =
        document.getElementById(
          "dailyInput"
        );

      const value =
        parseFloat(input.value);


      if (!value || value <= 0) {
        return;
      }


      state.dailyLimit =
        value;


      save();

      render();

    }
  );


/* Add Expense */

document
  .getElementById("expenseForm")
  .addEventListener(
    "submit",
    (e) => {

      e.preventDefault();


      const amount =
        parseFloat(
          document.getElementById(
            "amount"
          ).value
        );


      const category =
        document.getElementById(
          "category"
        ).value;


      const description =
        document
          .getElementById(
            "description"
          )
          .value
          .trim();


      const date =
        document.getElementById(
          "date"
        ).value;


      if (
        !amount ||
        amount <= 0 ||
        !description ||
        !date
      ) {
        return;
      }


      state.expenses.push({

        id:
          Date.now() +
          Math.floor(
            Math.random() * 1000
          ),

        amount,

        category,

        description,

        date,

      });


      save();


      e.target.reset();


      document.getElementById(
        "date"
      ).valueAsDate =
        new Date();


      render();

    }
  );


/* ---------- Init ---------- */

load();

document.getElementById(
  "date"
).valueAsDate =
  new Date();


const now =
  new Date();


const monthLabel =
  now.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric"
    }
  );


document.getElementById(
  "currentMonth"
).textContent =
  monthLabel;


document.getElementById(
  "chartMonth"
).textContent =
  now.toLocaleDateString(
    "en-US",
    {
      month: "long"
    }
  );


render();