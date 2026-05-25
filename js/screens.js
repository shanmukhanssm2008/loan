const Screens = {
  home() {
    const outstanding = DB.getOutstandingTotal();
    const clients = DB.clients.getAll();
    const activeLoans = DB.loans.getAll().filter(l => l.status === 'active');
    return `
      <div class="card card-accent">
        <div class="card-title">Total Outstanding</div>
        <div class="value">₹${outstanding.toLocaleString('en-IN')}</div>
      </div>
      <div class="card card-accent-green" id="btn-new-loan" style="cursor:pointer">
        <div class="card-title">New Loan</div>
        <div class="value-sm">Issue a new loan →</div>
      </div>
      <div class="card-outline" id="btn-clients">
        <div class="card-title">Existing Clients</div>
        <div class="value-sm">${clients.length} clients</div>
      </div>
      <div class="card-outline" id="btn-calendar">
        <div class="card-title">Calendar</div>
        <div class="value-sm">View transactions by date</div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="num">${clients.length}</div>
          <div class="lbl">Total Clients</div>
        </div>
        <div class="stat-box">
          <div class="num">${activeLoans.length}</div>
          <div class="lbl">Active Loans</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline btn-sm" id="btn-export" style="flex:1">Export</button>
        <button class="btn btn-outline btn-sm" id="btn-import" style="flex:1">Import</button>
        <input type="file" id="import-file" accept=".json" style="display:none">
      </div>
    `;
  },

  newLoanForm() {
    const today = new Date().toISOString().slice(0, 10);
    return `
      <form id="loan-form">
        <div class="form-group">
          <label for="client-name">Client Name *</label>
          <input type="text" id="client-name" class="form-input" placeholder="Full name" required autocomplete="name" list="client-suggestions">
          <datalist id="client-suggestions">
            ${DB.clients.getAll().map(c => `<option value="${c.name}">`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label for="client-mobile">Mobile Number</label>
          <input type="tel" id="client-mobile" class="form-input" placeholder="9876543210" inputmode="numeric" autocomplete="tel">
        </div>
        <div class="form-group">
          <label for="client-village">Village / Area</label>
          <input type="text" id="client-village" class="form-input" placeholder="Village name">
        </div>
        <div class="form-group">
          <label for="loan-amount">Principal Amount (₹) *</label>
          <input type="text" id="loan-amount" class="form-input" placeholder="10000" inputmode="numeric" required>
        </div>
        <div class="form-group">
          <label for="interest-rate">Interest Rate (₹ per ₹100)</label>
          <input type="text" id="interest-rate" class="form-input" placeholder="2 (means ₹2 per ₹100)" inputmode="numeric" value="2">
        </div>
        <div id="total-calc" class="form-hint" style="margin-bottom:16px">
          Total to repay: ₹<span id="total-display">0</span>
        </div>
        <div class="form-group">
          <label for="loan-date">Date Given</label>
          <input type="date" id="loan-date" class="form-input" value="${today}">
        </div>
        <button type="submit" class="btn btn-primary">Create Loan</button>
      </form>
    `;
  },

  clientList() {
    const clients = DB.clients.getAll();
    if (clients.length === 0) {
      return `
        <div class="empty-state">
          <div class="icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <p>No clients yet. Add your first loan to get started.</p>
        </div>
      `;
    }
    return `
      <div class="search-container">
        <span class="search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input type="text" class="search-input" id="client-search" placeholder="Search by name or mobile..." inputmode="search">
      </div>
      <div id="client-list">
        ${this._clientListItems(clients)}
      </div>
    `;
  },

  _clientListItems(clients) {
    const activeLoans = DB.loans.getAll().filter(l => l.status === 'active');
    const outstandingByClient = {};
    for (const loan of activeLoans) {
      const summary = DB.payments.getLoanSummary(loan.id);
      if (!outstandingByClient[loan.clientId]) outstandingByClient[loan.clientId] = 0;
      outstandingByClient[loan.clientId] += summary.remaining;
    }
    return clients.map(c => `
      <div class="client-item" data-client-id="${c.id}">
        <div>
          <div class="name">${c.name}</div>
          <div class="mobile">${c.mobile || 'No mobile'}</div>
        </div>
        <div class="outstanding">₹${(outstandingByClient[c.id] || 0).toLocaleString('en-IN')}</div>
      </div>
    `).join('');
  },

  clientDetail(clientId) {
    const client = DB.clients.getById(clientId);
    if (!client) return `<div class="empty-state"><p>Client not found.</p></div>`;

    const loans = DB.loans.getByClient(clientId);
    let totalGiven = 0, totalRepaid = 0;

    const loanCards = loans.map(loan => {
      const summary = DB.payments.getLoanSummary(loan.id);
      totalGiven += loan.totalAmount;
      totalRepaid += summary.totalPaid;
      const progress = loan.totalAmount > 0 ? (summary.totalPaid / loan.totalAmount * 100) : 0;
      const recentPayments = summary.payments.slice(-5).reverse();
      const isActive = loan.status === 'active';

      return `
        <div class="loan-card" data-loan-id="${loan.id}">
          <div class="loan-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
            <div>
              <div class="loan-principal">₹${loan.principal.toLocaleString('en-IN')}</div>
              <div class="loan-rate">₹${loan.interestRate}/₹100 • ${new Date(loan.dateGiven).toLocaleDateString('en-IN')}</div>
            </div>
            <span class="status-badge ${isActive ? 'status-active' : 'status-closed'}">${isActive ? 'Active' : 'Closed'}</span>
          </div>
          <div class="loan-body" style="display:none">
            <div class="flex-between text-sm">
              <span>Total: ₹${loan.totalAmount.toLocaleString('en-IN')}</span>
              <span>Rate: ${loan.interestRate}%</span>
            </div>
            <div class="loan-progress">
              <div class="loan-progress-bar" style="width:${Math.min(progress, 100)}%"></div>
            </div>
            <div class="loan-stats">
              <span class="paid">Paid: ₹${summary.totalPaid.toLocaleString('en-IN')}</span>
              <span class="remaining">Remaining: ₹${summary.remaining.toLocaleString('en-IN')}</span>
            </div>
            ${recentPayments.length > 0 ? `
              <div class="pay-history-title">Recent Payments</div>
              ${recentPayments.map(p => `
                <div class="payment-item">
                  <span class="pay-date">${new Date(p.date).toLocaleDateString('en-IN')}</span>
                  <span class="pay-amount">₹${p.amount.toLocaleString('en-IN')}</span>
                </div>
              `).join('')}
            ` : ''}
            ${isActive ? `<button class="btn btn-accent btn-sm mt-8" onclick="App.showAddPayment('${loan.id}')">Add Payment</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const outstanding = loans
      .filter(l => l.status === 'active')
      .reduce((s, l) => s + DB.payments.getLoanSummary(l.id).remaining, 0);

    return `
      <div class="card">
        <h2>${client.name}</h2>
        <div class="text-muted text-sm">${client.mobile || 'No mobile'}${client.village ? ' • ' + client.village : ''}</div>
      </div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="num">₹${totalGiven.toLocaleString('en-IN')}</div>
          <div class="lbl">Total Given</div>
        </div>
        <div class="summary-item">
          <div class="num">₹${totalRepaid.toLocaleString('en-IN')}</div>
          <div class="lbl">Total Repaid</div>
        </div>
        <div class="summary-item">
          <div class="num">₹${outstanding.toLocaleString('en-IN')}</div>
          <div class="lbl">Outstanding</div>
        </div>
      </div>
      ${loans.length === 0 ? `<div class="empty-state"><p>No loans for this client yet.</p></div>` : loanCards}
      <div id="payment-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100;align-items:center;justify-content:center;padding:16px">
        <div id="payment-modal" style="background:#fff;border-radius:12px;padding:20px;max-width:360px;width:100%"></div>
      </div>
    `;
  },

  calendar(params) {
    const now = params?.date ? new Date(params.date + 'T00:00:00') : new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    App.calendarDate = new Date(year, month, 1);

    return `
      <div class="cal-header">
        <button class="cal-nav" id="cal-prev">←</button>
        <h2>${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <button class="cal-nav" id="cal-next">→</button>
      </div>
      ${this._calendarGrid(year, month)}
      <div id="calendar-txns"></div>
    `;
  },

  _calendarGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);

    const payments = DB.payments.getAll();
    const datesWithPayments = new Set(payments.map(p => p.date));

    let html = '<div class="cal-grid">';
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
      html += `<div class="cal-day-header">${d}</div>`;
    });

    for (let i = firstDay - 1; i >= 0; i--) {
      html += `<div class="cal-day other-month">${daysInPrevMonth - i}</div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const classes = ['cal-day'];
      if (dateStr === today) classes.push('today');
      if (datesWithPayments.has(dateStr)) classes.push('has-payments');
      classes.push('cal-day-clickable');
      html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}</div>`;
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += `<div class="cal-day other-month">${i}</div>`;
    }

    html += '</div>';
    return html;
  }
};
