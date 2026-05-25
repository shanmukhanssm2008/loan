const App = {
  currentRoute: 'home',
  currentClientId: null,
  currentLoanId: null,
  calendarDate: null,

  init() {
    this.bindNavEvents();
    this.route('home');
  },

  bindNavEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.route(item.dataset.route));
    });
    document.getElementById('back-btn').addEventListener('click', () => {
      window.history.back();
    });
  },

  route(route, params) {
    this.currentRoute = route;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-route="${route}"]`);
    if (navItem) navItem.classList.add('active');
    document.getElementById('back-btn').style.display = 'none';

    const header = document.getElementById('header-title');
    const content = document.getElementById('main-content');

    switch (route) {
      case 'home':
        header.textContent = 'Loan Ledger';
        content.innerHTML = Screens.home();
        this.attachHomeEvents();
        break;
      case 'new-loan':
        header.textContent = 'New Loan';
        document.getElementById('back-btn').style.display = 'flex';
        content.innerHTML = Screens.newLoanForm();
        this.attachNewLoanEvents();
        break;
      case 'clients':
        header.textContent = 'Existing Clients';
        content.innerHTML = Screens.clientList();
        this.attachClientListEvents();
        break;
      case 'client-detail':
        header.textContent = 'Client Details';
        document.getElementById('back-btn').style.display = 'flex';
        content.innerHTML = Screens.clientDetail(params.clientId);
        this.attachClientDetailEvents(params.clientId);
        break;
      case 'calendar':
        header.textContent = 'Calendar';
        content.innerHTML = Screens.calendar(params || {});
        this.attachCalendarEvents();
        break;
    }
  },

  attachHomeEvents() {
    document.getElementById('btn-new-loan')?.addEventListener('click', () => this.route('new-loan'));
    document.getElementById('btn-clients')?.addEventListener('click', () => this.route('clients'));
    document.getElementById('btn-calendar')?.addEventListener('click', () => this.route('calendar'));
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportData());
    document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file')?.addEventListener('change', (e) => this.importData(e));
  },

  attachNewLoanEvents() {
    const amountInput = document.getElementById('loan-amount');
    const rateInput = document.getElementById('interest-rate');
    const totalDisplay = document.getElementById('total-display');

    const calcTotal = () => {
      const p = parseFloat(amountInput.value) || 0;
      const r = parseFloat(rateInput.value) || 0;
      const total = p + (p * r / 100);
      totalDisplay.textContent = total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };
    amountInput?.addEventListener('input', calcTotal);
    rateInput?.addEventListener('input', calcTotal);

    document.getElementById('loan-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('client-name').value.trim();
      const mobile = document.getElementById('client-mobile').value.trim();
      const village = document.getElementById('client-village').value.trim();
      const principal = parseFloat(document.getElementById('loan-amount').value);
      const rate = parseFloat(document.getElementById('interest-rate').value) || 0;
      const dateGiven = document.getElementById('loan-date').value;

      if (!name) { alert('Please enter client name.'); return; }
      if (!principal || principal <= 0) { alert('Please enter a valid principal amount.'); return; }

      let client = DB.clients.getAll().find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!client) {
        client = DB.clients.create({ name, mobile, village });
      } else if (mobile && !client.mobile) {
        const clients = DB._getStore('clients');
        const existing = clients.find(c => c.id === client.id);
        existing.mobile = mobile;
        if (village) existing.village = village;
        DB._saveStore('clients', clients);
      }

      DB.loans.create({ clientId: client.id, principal, interestRate: rate, dateGiven });
      alert(`Loan created for ${client.name}!`);
      this.route('client-detail', { clientId: client.id });
    });
  },

  attachClientListEvents() {
    const searchInput = document.getElementById('client-search');
    const listContainer = document.getElementById('client-list');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        const results = query ? DB.clients.search(query) : DB.clients.getAll();
        listContainer.innerHTML = Screens._clientListItems(results);
        this._bindClientClicks();
      });
    }
    this._bindClientClicks();
  },

  _bindClientClicks() {
    document.querySelectorAll('.client-item').forEach(item => {
      item.addEventListener('click', () => {
        this.route('client-detail', { clientId: item.dataset.clientId });
      });
    });
  },

  attachClientDetailEvents(clientId) {
    this._bindClientClicks();
  },

  showAddPayment(loanId) {
    const loan = DB.loans.getById(loanId);
    if (!loan) return;
    const today = new Date().toISOString().slice(0, 10);
    const overlay = document.getElementById('payment-modal-overlay');
    const modal = document.getElementById('payment-modal');
    modal.innerHTML = `
      <h3 style="margin-bottom:12px">Add Payment</h3>
      <p class="text-sm text-muted mb-12">Loan: ₹${loan.principal.toLocaleString('en-IN')} at ₹${loan.interestRate}/₹100</p>
      <div class="form-group">
        <label for="pay-date">Date</label>
        <input type="date" id="pay-date" class="form-input" value="${today}">
      </div>
      <div class="form-group">
        <label for="pay-amount">Amount (₹) *</label>
        <input type="text" id="pay-amount" class="form-input" placeholder="1000" inputmode="numeric" required>
      </div>
      <div class="form-group">
        <label for="pay-notes">Notes (optional)</label>
        <input type="text" id="pay-notes" class="form-input" placeholder="Week 1 payment">
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline btn-sm" id="btn-cancel-payment" style="flex:1">Cancel</button>
        <button class="btn btn-accent btn-sm" id="btn-save-payment" style="flex:1">Save</button>
      </div>
    `;
    overlay.style.display = 'flex';
    document.getElementById('btn-save-payment').addEventListener('click', () => {
      const amount = parseFloat(document.getElementById('pay-amount').value);
      const date = document.getElementById('pay-date').value;
      const notes = document.getElementById('pay-notes').value.trim();
      if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
      DB.payments.create({ loanId, amount, date, notes });
      overlay.style.display = 'none';
      this.route('client-detail', { clientId: DB.loans.getById(loanId).clientId });
    });
    document.getElementById('btn-cancel-payment').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.style.display = 'none'; });
  },

  attachCalendarEvents() {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
      App.calendarDate.setMonth(App.calendarDate.getMonth() - 1);
      App.route('calendar', { date: App.calendarDate.toISOString().slice(0, 10) });
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
      App.calendarDate.setMonth(App.calendarDate.getMonth() + 1);
      App.route('calendar', { date: App.calendarDate.toISOString().slice(0, 10) });
    });

    document.querySelectorAll('.cal-day-clickable').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        document.querySelectorAll('.cal-day-clickable').forEach(d => d.classList.remove('selected'));
        el.classList.add('selected');
        this._showDateTransactions(date);
      });
    });

    const today = new Date().toISOString().slice(0, 10);
    const todayEl = document.querySelector(`.cal-day-clickable[data-date="${today}"]`);
    if (todayEl) {
      todayEl.click();
    }
  },

  _showDateTransactions(dateStr) {
    const container = document.getElementById('calendar-txns');
    const payments = DB.payments.getByDate(dateStr);
    const loans = DB.loans.getAll();
    const clients = DB.clients.getAll();

    if (payments.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No transactions on ${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN')}</p></div>`;
      return;
    }

    const getClientName = (loanId) => {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return 'Unknown';
      const client = clients.find(c => c.id === loan.clientId);
      return client ? client.name : 'Unknown';
    };

    const getLoanPrincipal = (loanId) => {
      const loan = loans.find(l => l.id === loanId);
      return loan ? loan.principal : 0;
    };

    container.innerHTML = `
      <h3 style="font-size:1rem;margin-bottom:8px">
        ${payments.length} payment${payments.length > 1 ? 's' : ''} on ${new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN')}
      </h3>
      <div class="txn-list">
        ${payments.map(p => `
          <div class="txn-item">
            <div>
              <div class="txn-client">${getClientName(p.loanId)}</div>
              <div class="txn-note">${p.notes || 'Loan: ₹' + getLoanPrincipal(p.loanId).toLocaleString('en-IN')}</div>
            </div>
            <div class="txn-amount">₹${p.amount.toLocaleString('en-IN')}</div>
          </div>
        `).join('')}
        <div class="txn-item" style="background:var(--muted)">
          <div><strong>Total</strong></div>
          <div class="txn-amount">₹${payments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  },

  exportData() {
    const blob = new Blob([DB.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `loan-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        DB.importData(e.target.result);
        alert('Data imported successfully!');
        this.route('home');
      } catch {
        alert('Invalid file format. Please select a valid backup file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
