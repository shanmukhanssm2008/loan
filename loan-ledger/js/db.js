const DB = {
  _prefix: 'll_',

  _getStore(storeName) {
    try {
      const data = localStorage.getItem(this._prefix + storeName);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  _saveStore(storeName, data) {
    localStorage.setItem(this._prefix + storeName, JSON.stringify(data));
  },

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  clients: {
    getAll() { return DB._getStore('clients'); },
    getById(id) { return DB._getStore('clients').find(c => c.id === id) || null; },
    search(query) {
      const q = query.toLowerCase();
      return DB._getStore('clients').filter(c =>
        c.name.toLowerCase().includes(q) || c.mobile.includes(q)
      );
    },
    create({ name, mobile, village }) {
      const clients = DB._getStore('clients');
      const client = { id: DB._generateId(), name, mobile, village, createdAt: new Date().toISOString() };
      clients.push(client);
      DB._saveStore('clients', clients);
      return client;
    }
  },

  loans: {
    getAll() { return DB._getStore('loans'); },
    getByClient(clientId) { return DB._getStore('loans').filter(l => l.clientId === clientId); },
    getById(id) { return DB._getStore('loans').find(l => l.id === id) || null; },
    create({ clientId, principal, interestRate, dateGiven }) {
      const totalAmount = principal + (principal * interestRate / 100);
      const loans = DB._getStore('loans');
      const loan = {
        id: DB._generateId(), clientId, principal, interestRate,
        totalAmount: Math.round(totalAmount * 100) / 100,
        dateGiven, status: 'active', createdAt: new Date().toISOString()
      };
      loans.push(loan);
      DB._saveStore('loans', loans);
      return loan;
    },
    close(id) {
      const loans = DB._getStore('loans');
      const loan = loans.find(l => l.id === id);
      if (loan) { loan.status = 'closed'; DB._saveStore('loans', loans); }
      return loan;
    }
  },

  payments: {
    getAll() { return DB._getStore('payments'); },
    getByLoan(loanId) { return DB._getStore('payments').filter(p => p.loanId === loanId); },
    getByDate(dateStr) {
      return DB._getStore('payments').filter(p => p.date === dateStr);
    },
    create({ loanId, amount, date, notes }) {
      const payments = DB._getStore('payments');
      const payment = {
        id: DB._generateId(), loanId, amount: Math.round(amount * 100) / 100,
        date, notes: notes || '', createdAt: new Date().toISOString()
      };
      payments.push(payment);
      DB._saveStore('payments', payments);
      const loan = DB.loans.getById(loanId);
      if (loan) {
        const totalPaid = DB.payments.getByLoan(loanId).reduce((s, p) => s + p.amount, 0);
        if (totalPaid >= loan.totalAmount) DB.loans.close(loanId);
      }
      return payment;
    },
    getLoanSummary(loanId) {
      const payments = DB.payments.getByLoan(loanId);
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
      const loan = DB.loans.getById(loanId);
      return { payments, totalPaid, remaining: loan ? Math.max(0, loan.totalAmount - totalPaid) : 0 };
    }
  },

  getOutstandingTotal() {
    const activeLoans = DB.loans.getAll().filter(l => l.status === 'active');
    let total = 0;
    for (const loan of activeLoans) {
      const summary = DB.payments.getLoanSummary(loan.id);
      total += summary.remaining;
    }
    return Math.round(total * 100) / 100;
  },

  exportData() {
    return JSON.stringify({
      clients: DB._getStore('clients'),
      loans: DB._getStore('loans'),
      payments: DB._getStore('payments'),
      exportedAt: new Date().toISOString()
    });
  },

  importData(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (data.clients) DB._saveStore('clients', data.clients);
    if (data.loans) DB._saveStore('loans', data.loans);
    if (data.payments) DB._saveStore('payments', data.payments);
  }
};
